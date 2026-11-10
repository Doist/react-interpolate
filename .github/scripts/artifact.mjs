import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const packageName = '@todoist/react-interpolate'
const repository = 'https://github.com/todoist/react-interpolate'
const registries = { npm: 'https://registry.npmjs.org/', github: 'https://npm.pkg.github.com/' }
const json = (path) => JSON.parse(readFileSync(path, 'utf8'))
const hash = (bytes, algorithm, encoding) => createHash(algorithm).update(bytes).digest(encoding)

function validatePackage(pkg, version) {
    assert.match(version, /^\d+\.\d+\.\d+$/, 'Only stable semver releases are supported')
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
    assert.match(version, /^\d+\.\d+\.\d+$/, 'Only stable semver releases are supported')
    assert.match(sourceSha, /^[a-f0-9]{40}$/)
    const release = json(join(directory, 'release.json'))
    assert.equal(
        release.schema,
        1,
        'Unsupported schema: keep the original artifact for reviewed manual recovery; never repack an immutable version',
    )
    assert.equal(release.name, packageName)
    assert.equal(release.version, version)
    assert.equal(release.sourceSha, sourceSha)
    if (sourceRef) assert.equal(release.sourceRef, sourceRef)
    assert.ok(['refs/heads/main'].includes(release.sourceRef))
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
    return { ...release, tarball }
}

export function pack(directory, sourceSha, sourceRef) {
    const pkg = json('package.json')
    validatePackage(pkg, pkg.version)
    assert.match(sourceSha, /^[a-f0-9]{40}$/)
    assert.equal(sourceRef, 'refs/heads/main', 'Stable artifacts must come from main')
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
                !/^(npm_config_|npm_token$|node_auth_token$|gh_token$|github_token$|gh_packages_token$)/i.test(
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

// This repository already has a public GitHub mirror. Require direct target access:
// GitHub can hide unauthorized packages with 404 or omit them from an inventory.
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

export function githubVisibility() {
    assert.ok(process.env.GH_PACKAGES_TOKEN, 'GitHub package read token is required')
    const pkg = JSON.parse(
        execFileSync('gh', ['api', 'orgs/todoist/packages/npm/react-interpolate'], {
            encoding: 'utf8',
            env: { ...process.env, GH_TOKEN: process.env.GH_PACKAGES_TOKEN },
        }),
    )
    return validateGithubMirror(pkg)
}

export function preflightRegistries(release) {
    githubVisibility()
    withRegistry('github', (run, registry) => {
        const auth = run(['whoami', `--registry=${registry}`])
        assert.equal(auth.status, 0, 'GitHub registry authentication failed; absence is ambiguous')
    })
    preflight(release, (destination) =>
        withRegistry(destination, (run, registry) =>
            registryMetadata(run, registry, `${release.name}@${release.version}`),
        ),
    )
}

export function publish(
    release,
    destination,
    run,
    registry,
    tag = 'latest',
    publishOptions = {},
    beforeWrite = () => preflightRegistries(release),
) {
    assert.ok(['latest', 'recovery'].includes(tag), 'Expected latest or recovery dist-tag')
    const spec = `${release.name}@${release.version}`
    const existing = registryMetadata(run, registry, spec)
    if (existing) {
        assertSameArtifact(existing, release)
        console.log(`${destination}: identical ${spec} already exists; skipped`)
        return
    }
    if (tag === 'latest') {
        const latest = registryMetadata(run, registry, release.name, 'dist-tags')?.latest
        if (latest) {
            assert.match(
                latest,
                /^\d+\.\d+\.\d+$/,
                'Non-stable latest requires explicit recovery tag',
            )
            const current = latest.split('.').map(Number)
            const target = release.version.split('.').map(Number)
            const firstDifference = current.findIndex((part, index) => part !== target[index])
            assert.ok(
                firstDifference === -1 || current[firstDifference] < target[firstDifference],
                `Registry latest ${latest} is newer than ${release.version}; use recovery tag to preserve latest`,
            )
        }
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
    tag = 'latest',
    beforeWrite = () => preflightRegistries(release),
) {
    const login = run(['login', `--registry=${registry}`], { stdio: 'inherit' })
    assert.equal(login.status, 0, 'Interactive npm login failed; publication was not attempted')
    // Publishing can ask for a fresh 2FA challenge even after login.
    publish(release, 'npm', run, registry, tag, { stdio: 'inherit' }, beforeWrite)
}
