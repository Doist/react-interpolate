import assert from 'node:assert/strict'
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
    bootstrap,
    pack,
    preflight,
    publish,
    registryMetadata,
    verify,
    withRegistry,
    validateGithubMirror,
} from './artifact.mjs'
import { validateSourceRun } from './release-source.mjs'

const registry = 'https://registry.npmjs.org/'
const release = {
    name: '@todoist/react-interpolate',
    version: '2.2.5',
    tarball: '/retained/package.tgz',
    integrity: 'sha512-original',
    shasum: 'original',
}
const success = (value) => ({ status: 0, stdout: JSON.stringify(value) })
const missing = { status: 1, stdout: JSON.stringify({ error: { code: 'E404' } }) }
const noop = () => {}

test('one-mirror publication rejects a conflict in either registry before any write', () => {
    for (const conflict of ['npm', 'github']) {
        const calls = []
        const results = [missing, success({ latest: '2.2.4' })]
        assert.throws(
            () =>
                publish(
                    release,
                    'npm',
                    (args) => {
                        calls.push(args)
                        return results.shift()
                    },
                    registry,
                    'latest',
                    {},
                    () =>
                        preflight(release, (target) =>
                            target === conflict ? { integrity: 'sha512-other' } : null,
                        ),
                ),
            /integrity differs/,
        )
        assert.ok(calls.every((args) => args[0] !== 'publish'))
    }
    const checked = []
    preflight(release, (target) => {
        checked.push(target)
        return target === 'npm' ? release : null
    })
    assert.deepEqual(checked, ['npm', 'github'])
})

test('same artifact is skipped; auth, transport and invalid registry responses fail closed', () => {
    const calls = []
    publish(
        release,
        'npm',
        (args) => {
            calls.push(args)
            return success(release)
        },
        registry,
    )
    assert.equal(calls.length, 1)
    for (const code of ['E401', 'E403', 'ETIMEDOUT', 'ECONNRESET'])
        assert.throws(
            () =>
                registryMetadata(
                    () => ({ status: 1, stdout: JSON.stringify({ error: { code } }) }),
                    registry,
                    release.name,
                ),
            /lookup failed/,
        )
    assert.throws(() =>
        registryMetadata(
            () => ({ status: 0, stdout: '<html>bad gateway</html>' }),
            registry,
            release.name,
        ),
    )
})

test('missing older mirror requires recovery tag and publishes original bytes without provenance or lifecycles', () => {
    const results = [missing, success({ latest: '2.2.6' })]
    assert.throws(
        () => publish(release, 'npm', () => results.shift(), registry, 'latest', {}, noop),
        /use recovery tag/,
    )
    const calls = []
    const recovery = [missing, success({}), success(release)]
    let checked = false
    publish(
        release,
        'npm',
        (args) => {
            if (args[0] === 'publish') assert.equal(checked, true)
            calls.push(args)
            return recovery.shift()
        },
        registry,
        'recovery',
        {},
        () => {
            checked = true
        },
    )
    assert.deepEqual(calls[1], [
        'publish',
        release.tarball,
        '--ignore-scripts',
        '--tag=recovery',
        `--registry=${registry}`,
        '--access=public',
        '--provenance=false',
    ])
})

test('terminal bootstrap logs in, rechecks both registries, and preserves terminal at publish-time 2FA', () => {
    const calls = []
    const results = [
        success({}),
        missing,
        success({ latest: '2.2.4' }),
        success({}),
        success(release),
    ]
    bootstrap(
        release,
        (args, options) => {
            calls.push({ args, options })
            return results.shift()
        },
        registry,
        'latest',
        () => {
            assert.equal(calls[0].args[0], 'login')
            preflight(release, (target) => {
                calls.push({ preflight: target })
                return null
            })
        },
    )
    for (const command of ['login', 'publish'])
        assert.deepEqual(calls.find((call) => call.args?.[0] === command).options, {
            stdio: 'inherit',
        })
    assert.ok(
        calls
            .filter((call) => call.args?.[0] === 'view')
            .every((call) => call.options === undefined),
    )
    assert.deepEqual(
        calls.filter((call) => call.preflight).map((call) => call.preflight),
        ['npm', 'github'],
    )
    assert.throws(() => bootstrap(release, () => ({ status: 1 }), registry), /login failed/)
})

test('npmjs receives no GitHub read/publish credentials or inherited registry configuration', () => {
    const saved = { ...process.env }
    try {
        process.env.npm_config_registry = 'https://wrong.invalid/'
        process.env.GH_PACKAGES_TOKEN = 'synthetic-read-token'
        process.env.GH_TOKEN = 'synthetic-api-token'
        process.env.NODE_AUTH_TOKEN = 'synthetic-wrong-token'
        withRegistry('npm', (run, expected) => {
            assert.equal(run(['config', 'get', '@todoist:registry']).stdout.trim(), expected)
            // npm exec --call runs only local node; it never installs a package.
            const result = run([
                'exec',
                '--offline',
                '--',
                'node',
                '-e',
                'console.log(JSON.stringify([process.env.GH_PACKAGES_TOKEN, process.env.GH_TOKEN, process.env.NODE_AUTH_TOKEN]))',
            ])
            assert.equal(result.status, 0)
            assert.deepEqual(JSON.parse(result.stdout), [null, null, null])
        })
    } finally {
        for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]
        Object.assign(process.env, saved)
    }
})

test('trusted historical run survives later main maintenance; PR, foreign, mismatched and unreviewed sources fail', () => {
    const run = {
        repository: { full_name: 'todoist/react-interpolate' },
        head_repository: { full_name: 'todoist/react-interpolate' },
        workflow_id: 12,
        path: '.github/workflows/pack.yml',
        event: 'workflow_dispatch',
        status: 'completed',
        conclusion: 'success',
        head_branch: 'main',
        head_sha: 'a'.repeat(40),
    }
    for (const status of ['identical', 'ahead'])
        assert.equal(validateSourceRun(run, 12, () => ({ status })).sha, run.head_sha)
    for (const change of [
        { event: 'pull_request' },
        { head_branch: 'feature' },
        { path: '.github/workflows/other.yml' },
        { workflow_id: 13 },
        { conclusion: 'failure' },
        { head_repository: { full_name: 'fork/react-interpolate' } },
    ])
        assert.throws(() =>
            validateSourceRun({ ...run, ...change }, 12, () => ({ status: 'ahead' })),
        )
    assert.throws(() => validateSourceRun(run, 12, () => ({ status: 'diverged' })), /reviewed main/)
})

test('synthetic packing rejects stale locks, wrong schema/source and corrupt bytes', () => {
    const directory = mkdtempSync(join(tmpdir(), 'interpolate-fixture-'))
    const cwd = process.cwd()
    const sha = 'a'.repeat(40)
    const pkg = {
        name: release.name,
        version: release.version,
        repository: 'https://github.com/todoist/react-interpolate',
        main: 'dist/react-interpolate.cjs',
        module: 'dist/react-interpolate.mjs',
        types: 'dist/react-interpolate.d.ts',
        peerDependencies: { 'prop-types': '15.8.1', react: '>=17.0.2', 'react-dom': '>=17.0.2' },
        files: ['dist'],
        devDependencies: { '@todoist/prettier-config': '4.0.2' },
    }
    try {
        mkdirSync(join(directory, 'dist'))
        for (const suffix of ['cjs', 'mjs', 'min.cjs', 'min.mjs', 'd.ts'])
            writeFileSync(join(directory, `dist/react-interpolate.${suffix}`), 'fixture\n')
        for (const name of ['README.md', 'LICENSE'])
            writeFileSync(join(directory, name), 'fixture\n')
        writeFileSync(join(directory, 'package.json'), JSON.stringify(pkg))
        const lock = {
            name: pkg.name,
            version: pkg.version,
            packages: { '': { ...pkg, devDependencies: {} } },
        }
        writeFileSync(join(directory, 'package-lock.json'), JSON.stringify(lock))
        process.chdir(directory)
        assert.throws(() => pack('artifact', sha, 'refs/heads/main'), /Lockfile devDependencies/)
        lock.packages[''] = pkg
        writeFileSync('package-lock.json', JSON.stringify(lock))
        const packed = pack('artifact', sha, 'refs/heads/main')
        verify('artifact', sha, pkg.version)
        assert.throws(() => verify('artifact', 'b'.repeat(40), pkg.version))
        writeFileSync('artifact/release.json', JSON.stringify({ ...packed, schema: 99 }))
        assert.throws(() => verify('artifact', sha, pkg.version), /never repack/)
        writeFileSync('artifact/release.json', JSON.stringify(packed))
        appendFileSync(join('artifact', packed.filename), 'tampered')
        assert.throws(() => verify('artifact', sha, pkg.version))
    } finally {
        process.chdir(cwd)
        rmSync(directory, { recursive: true, force: true })
    }
})

// Target package access is essential; a successful login alone is insufficient.
test('a hidden or private GitHub mirror cannot authorize an npm write', () => {
    const valid = {
        name: 'react-interpolate',
        visibility: 'public',
        repository: { full_name: 'todoist/react-interpolate' },
    }
    assert.equal(validateGithubMirror(valid), valid)
    for (const pkg of [
        undefined,
        { ...valid, visibility: 'private' },
        { ...valid, repository: { full_name: 'other/react-interpolate' } },
    ]) {
        const results = [missing, success({ latest: '2.2.4' })]
        const calls = []
        assert.throws(() =>
            publish(
                release,
                'npm',
                (args) => {
                    calls.push(args)
                    return results.shift()
                },
                registry,
                'latest',
                {},
                () => validateGithubMirror(pkg),
            ),
        )
        assert.ok(calls.every((args) => args[0] !== 'publish'))
    }
})
