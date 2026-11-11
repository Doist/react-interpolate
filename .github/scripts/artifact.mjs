import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { verifyRecordFiles } from './record-data.mjs'
import { parseVersion, channelFor, validateChannel, assertNoDowngrade } from './release-policy.mjs'

const packageName = '@todoist/react-interpolate'
const repository = 'https://github.com/todoist/react-interpolate'
const registries = { npm: 'https://registry.npmjs.org/', github: 'https://npm.pkg.github.com/' }
const json = (path) => JSON.parse(readFileSync(path, 'utf8'))
const hash = (bytes, algorithm, encoding) => createHash(algorithm).update(bytes).digest(encoding)

function validatePackage(pkg, version) {
    parseVersion(version)
    assert.equal(pkg.name, packageName)
    assert.equal(pkg.version, version)
    assert.equal(pkg.repository, repository)
    assert.ok(!pkg.private, 'The npm package must remain public')
    assert.equal(pkg.publishConfig, undefined, 'Packed publishConfig must not override routing')
    assert.equal(pkg.main, 'dist/react-interpolate.cjs')
    assert.equal(pkg.module, 'dist/react-interpolate.mjs')
    assert.equal(pkg.types, 'dist/react-interpolate.d.ts')
    assert.deepEqual(pkg.peerDependencies, {
        'prop-types': '15.8.1',
        react: '>=17.0.2',
        'react-dom': '>=17.0.2',
    })
    for (const key of [
        'dependencies',
        'devDependencies',
        'peerDependencies',
        'optionalDependencies',
    ]) {
        for (const [name, spec] of Object.entries(pkg[key] ?? {})) {
            assert.ok(!name.startsWith('@doist/'), `Unmigrated dependency: ${name}`)
            assert.ok(
                !/^(?:file:|link:|workspace:|npm:)/.test(spec),
                `Non-registry dependency: ${name}`,
            )
        }
    }
}

export function verify(directory, sourceSha, version, sourceRef) {
    parseVersion(version)
    assert.match(sourceSha, /^[a-f0-9]{40}$/)
    const release = json(join(directory, 'release.json'))
    assert.ok(
        [1, 2].includes(release.schema),
        'Unsupported schema: keep the original artifact for reviewed manual recovery; never repack an immutable version',
    )
    assert.equal(release.name, packageName)
    assert.equal(release.version, version)
    assert.equal(release.sourceSha, sourceSha)
    if (sourceRef) assert.equal(release.sourceRef, sourceRef)
    validateChannel(version, release.sourceRef)
    if (release.schema === 2) {
        assert.equal(release.channel, channelFor(version))
        assert.equal(release.prerelease, release.channel === 'next')
    }
    assert.equal(release.filename, `todoist-react-interpolate-${version}.tgz`)
    const tarball = resolve(directory, release.filename)
    const bytes = readFileSync(tarball)
    assert.equal(release.integrity, `sha512-${hash(bytes, 'sha512', 'base64')}`)
    assert.equal(release.shasum, hash(bytes, 'sha1', 'hex'))
    const files = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' }).trim().split('\n')
    for (const file of [
        'react-interpolate.cjs',
        'react-interpolate.mjs',
        'react-interpolate.min.cjs',
        'react-interpolate.min.mjs',
        'react-interpolate.d.ts',
    ])
        assert.ok(files.includes(`package/dist/${file}`), `Build output is missing: ${file}`)
    for (const file of ['package/package.json', 'package/README.md', 'package/LICENSE']) {
        assert.ok(files.includes(file), `Missing packed file: ${file}`)
    }
    assert.ok(
        files.every(
            (file) =>
                /^(?:package\/(?:package\.json|README\.md|LICENSE|CHANGELOG\.md)|package\/(?:dist|src)\/[\w./-]+)$/.test(
                    file,
                ) && !file.split('/').includes('..'),
        ),
        'Unexpected packed files',
    )
    const pkg = JSON.parse(
        execFileSync('tar', ['-xOzf', tarball, 'package/package.json'], { encoding: 'utf8' }),
    )
    validatePackage(pkg, version)
    if (release.schema === 2) {
        const records = verifyRecordFiles(directory, release)
        if (release.channel === 'latest') assert.deepEqual(JSON.parse(records['package.json']), pkg)
    }
    return { ...release, tarball }
}

export function pack(directory, sourceSha, sourceRef) {
    const pkg = json('package.json')
    validatePackage(pkg, pkg.version)
    assert.match(sourceSha, /^[a-f0-9]{40}$/)
    validateChannel(pkg.version, sourceRef)
    const lock = json('package-lock.json')
    for (const entry of [lock, lock.packages['']]) {
        assert.equal(entry.name, pkg.name)
        assert.equal(entry.version, pkg.version)
    }
    for (const key of [
        'dependencies',
        'devDependencies',
        'peerDependencies',
        'optionalDependencies',
    ]) {
        assert.deepEqual(
            lock.packages[''][key],
            pkg[key],
            `Lockfile ${key} must be finalized from the real registry`,
        )
    }
    mkdirSync(directory, { recursive: true })
    const [packed] = JSON.parse(
        execFileSync(
            'npm',
            ['pack', '--ignore-scripts', '--json', '--pack-destination', resolve(directory)],
            { encoding: 'utf8' },
        ),
    )
    const release = {
        schema: 1,
        name: pkg.name,
        version: pkg.version,
        sourceSha,
        sourceRef,
        filename: packed.filename,
        integrity: packed.integrity,
        shasum: packed.shasum,
    }
    writeFileSync(join(directory, 'release.json'), `${JSON.stringify(release, null, 2)}\n`)
    verify(directory, sourceSha, pkg.version)
    return release
}

// A temporary cwd and explicit scope mapping prevent project/user npmrc routing leaks.
// Never log config contents or token values. npm uses OIDC for npmjs, GITHUB_TOKEN for GitHub.
export function withRegistry(destination, callback) {
    assert.ok(Object.hasOwn(registries, destination), 'Unknown registry')
    if (destination === 'github')
        assert.ok(process.env.GH_PACKAGES_TOKEN, 'GitHub package token is required')
    const registry = registries[destination]
    const directory = mkdtempSync(join(tmpdir(), 'react-interpolate-publish-'))
    const env = Object.fromEntries(
        Object.entries(process.env).filter(
            ([key]) =>
                !/^(npm_config_|npm_token$|node_auth_token$|gh_token$|github_token$|gh_packages_token$|gh_record_token$)/i.test(
                    key,
                ),
        ),
    )
    env.NPM_CONFIG_USERCONFIG = join(directory, 'user.npmrc')
    env.NPM_CONFIG_GLOBALCONFIG = join(directory, 'global.npmrc')
    writeFileSync(env.NPM_CONFIG_GLOBALCONFIG, '')
    let config = `registry=${registry}\n@todoist:registry=${registry}\n`
    if (destination === 'github') {
        env.NODE_AUTH_TOKEN = process.env.GH_PACKAGES_TOKEN
        // npm expands the token only at runtime.
        config += '//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}\n'
    }
    writeFileSync(env.NPM_CONFIG_USERCONFIG, config, { mode: 0o600 })
    try {
        return callback(
            (args, options = {}) =>
                spawnSync('npm', args, { cwd: directory, env, encoding: 'utf8', ...options }),
            registry,
        )
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
}

export function registryMetadata(run, registry, spec, field = 'dist') {
    const result = run(['view', spec, field, '--json', `--registry=${registry}`])
    if (result.status === 0) return JSON.parse(result.stdout)
    // Authentication, networking and other failures must not be mistaken for absence.
    let error
    try {
        error = JSON.parse(result.stdout).error
    } catch {
        /* fail closed below */
    }
    if (error?.code === 'E404') return null
    throw new Error(`Registry lookup failed: ${result.stderr || result.error || result.stdout}`)
}

export function assertSameArtifact(dist, release) {
    assert.ok(dist, 'Published version is missing')
    if (dist.integrity)
        assert.equal(
            dist.integrity,
            release.integrity,
            'Registry integrity differs; do not overwrite or bump',
        )
    else
        assert.equal(
            dist.shasum,
            release.shasum,
            'Registry checksum differs; do not overwrite or bump',
        )
}

// Validate BOTH destinations before any write, including a single missing-mirror retry.
// A successful pack run at the same source SHA need not have byte-identical tar output.
export function preflight(release, lookup) {
    for (const destination of ['npm', 'github']) {
        const dist = lookup(destination)
        if (dist) assertSameArtifact(dist, release)
    }
}

// Existing new-scope mirrors must be public and directly readable.
export function validateGithubMirror(pkg) {
    assert.ok(
        pkg,
        'The existing transferred GitHub mirror is not readable; stop for administrator access/transfer verification, not package bootstrap',
    )
    assert.equal(pkg.name, 'react-interpolate')
    assert.equal(
        pkg.visibility,
        'public',
        'Preserve the independently verified public GitHub mirror; an administrator must restore visibility',
    )
    assert.equal(
        pkg.repository?.full_name.toLowerCase(),
        'todoist/react-interpolate',
        'GitHub mirror belongs to a different repository',
    )
    return pkg
}

function githubPackageRequest(path) {
    assert.ok(process.env.GH_PACKAGES_TOKEN, 'GitHub package read token is required')
    const result = spawnSync('gh', ['api', '--include', path], {
        encoding: 'utf8',
        env: { ...process.env, GH_TOKEN: process.env.GH_PACKAGES_TOKEN },
    })
    const [headers, ...body] = result.stdout.split(/\r?\n\r?\n/)
    const status = Number(headers.match(/^HTTP\/\S+ (\d{3})/)?.[1])
    assert.ok([200, 404].includes(status), 'GitHub package access failed; absence is ambiguous')
    assert.ok(result.status === 0 || status === 404, 'GitHub package request failed')
    return {
        status,
        data: JSON.parse(body.join('\n\n')),
        scopes:
            headers
                .match(/^x-oauth-scopes:\s*(.*)$/im)?.[1]
                .trim()
                .split(/,\s*/) ?? [],
    }
}

export function githubVisibility(request = githubPackageRequest) {
    const response = request('orgs/todoist/packages/npm/react-interpolate')
    if (response.status === 200) return validateGithubMirror(response.data)
    assert.equal(response.status, 404, 'GitHub package access failed; absence is ambiguous')
    // A filtered inventory or ordinary repository-token 404 cannot prove absence.
    // Only a same-token active organization owner with explicit package-read rights
    // may bootstrap this exact new identity. Workflows cannot bypass this gate.
    assert.ok(
        response.scopes.some((scope) => ['read:packages', 'write:packages'].includes(scope)),
        'First mirror requires an owner token with package-read scope',
    )
    const membership = request('user/memberships/orgs/todoist')
    assert.equal(membership.status, 200, 'Cannot verify organization owner for first mirror')
    assert.equal(membership.data.state, 'active', 'First mirror requires active organization owner')
    assert.equal(membership.data.role, 'admin', 'First mirror requires organization owner')
    return null
}

export function requireGithubRegistryMetadata(run, registry, name = packageName, absent = false) {
    const auth = run(['whoami', `--registry=${registry}`])
    assert.equal(auth.status, 0, 'GitHub registry authentication failed; absence is ambiguous')
    const tags = registryMetadata(run, registry, name, 'dist-tags')
    if (absent) {
        assert.equal(tags, null, 'Registry package exists despite owner-confirmed REST absence')
        return null
    }
    assert.ok(
        tags &&
            typeof tags === 'object' &&
            !Array.isArray(tags) &&
            Object.values(tags).every((value) => typeof value === 'string'),
        'Known GitHub registry package metadata is not readable; version404 is ambiguous',
    )
    return tags
}

export function preflightRegistries(release, io = { githubVisibility, withRegistry }) {
    const mirror = io.githubVisibility()
    io.withRegistry('github', (run, registry) =>
        requireGithubRegistryMetadata(run, registry, packageName, mirror === null),
    )
    preflight(release, (destination) =>
        io.withRegistry(destination, (run, registry) =>
            registryMetadata(run, registry, `${release.name}@${release.version}`),
        ),
    )
}

export function publish(
    release,
    destination,
    run,
    registry,
    tag = channelFor(release.version),
    publishOptions = {},
    beforeWrite = () => preflightRegistries(release),
) {
    validateChannel(
        release.version,
        release.sourceRef ??
            (channelFor(release.version) === 'latest' ? 'refs/heads/main' : 'refs/heads/next'),
        tag,
    )
    const spec = `${release.name}@${release.version}`
    const existing = registryMetadata(run, registry, spec)
    if (existing) {
        assertSameArtifact(existing, release)
        console.log(`${destination}: identical ${spec} already exists; skipped`)
        return
    }
    if (tag !== 'recovery') {
        const current = registryMetadata(run, registry, release.name, 'dist-tags')?.[tag]
        assertNoDowngrade(release.version, current, tag)
    }
    const args = [
        'publish',
        release.tarball,
        '--ignore-scripts',
        `--tag=${tag}`,
        `--registry=${registry}`,
    ]
    // GitHub visibility is administered independently; do not infer it from npm access.
    // The tarball comes from an earlier run; GITHUB_SHA would attest the publisher commit.
    // Disable even OIDC's automatic provenance rather than claim the wrong build source.
    if (destination === 'npm') args.push('--access=public', '--provenance=false')
    beforeWrite()
    const result = run(args, publishOptions)
    if (result.status !== 0)
        throw new Error(`Publish failed: ${result.stderr || result.error || result.stdout}`)
    assertSameArtifact(registryMetadata(run, registry, spec), release)
    console.log(`${destination}: verified ${spec}`)
}

// Operator-only first publication: interactive authentication in the same isolated config,
// followed by exactly the same collision/integrity/latest checks as automated publication.
export function bootstrap(
    release,
    run,
    registry,
    tag = channelFor(release.version),
    beforeWrite = () => preflightRegistries(release),
) {
    const login = run(['login', `--registry=${registry}`], { stdio: 'inherit' })
    assert.equal(login.status, 0, 'Interactive npm login failed; publication was not attempted')
    // Publishing can ask for a fresh 2FA challenge even after login.
    publish(release, 'npm', run, registry, tag, { stdio: 'inherit' }, beforeWrite)
}
