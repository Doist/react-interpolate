import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { completeRecord } from './record-release.mjs'
import { recordGit } from './record-git.mjs'
import { verifyRecordFiles, verifyGeneratedFiles } from './record-data.mjs'
import { channelFor, validateChannel, assertNoDowngrade } from './release-policy.mjs'
import { validateSourceRun, validateMainBase, migrationBase } from './release-source.mjs'
import { publish } from './artifact.mjs'

const sourceSha = 'a'.repeat(40)
const targetSha = 'b'.repeat(40)
const success = (value) => ({ status: 0, stdout: JSON.stringify(value) })
const missing = { status: 1, stdout: JSON.stringify({ error: { code: 'E404' } }) }

function fixture(prerelease = false) {
    const directory = mkdtempSync(join(tmpdir(), 'interpolate-record-fixture-'))
    const version = prerelease ? '2.3.0-next.1' : '2.2.5'
    const release = {
        schema: 2,
        name: '@todoist/react-interpolate',
        version,
        sourceSha,
        mainBase: migrationBase,
        sourceRef: `refs/heads/${prerelease ? 'next' : 'main'}`,
        channel: prerelease ? 'next' : 'latest',
        prerelease,
        gitTag: `v${version}`,
        filename: `todoist-react-interpolate-${version}.tgz`,
        semanticNotes: `# ${version}\n\nRelease notes`,
        recordFiles: {},
    }
    release.notes = `[Posted by Jarvis]\n\n${release.semanticNotes}`
    const pkg = { name: release.name, version: '2.2.4', peerDependencies: { react: '>=17.0.2' } }
    const lock = { name: pkg.name, version: pkg.version, packages: { '': { ...pkg } } }
    const sourceFiles = {
        'package.json': JSON.stringify(pkg),
        'package-lock.json': JSON.stringify(lock),
        'CHANGELOG.md': '# 2.2.4\n\nHistorical notes\n',
    }
    const files = prerelease
        ? {}
        : {
              'package.json': JSON.stringify({ ...pkg, version }),
              'package-lock.json': JSON.stringify({
                  ...lock,
                  version,
                  packages: { '': { ...pkg, version } },
              }),
              'CHANGELOG.md': `${release.semanticNotes}\n\n${sourceFiles['CHANGELOG.md']}`,
          }
    for (const [path, bytes] of Object.entries(files)) {
        const filename = `record-${path}`
        writeFileSync(join(directory, filename), bytes)
        release.recordFiles[path] = {
            filename,
            sha256: createHash('sha256').update(bytes).digest('hex'),
        }
    }
    writeFileSync(join(directory, release.filename), 'synthetic tarball, never published')
    writeFileSync(join(directory, 'release.json'), JSON.stringify(release))
    return {
        release,
        directory,
        files,
        sourceFiles,
        cleanup: () => rmSync(directory, { recursive: true, force: true }),
    }
}

function remote(f, options = {}) {
    const calls = []
    const blobs = new Map()
    let state = options.record ? structuredClone(options.record) : null
    const io = {
        requireCompletedRegistries: () => {
            calls.push('registry-gate')
            if (options.missingRegistry) throw Error('missing mirror')
        },
        recordGit: () => {
            calls.push('git-record')
            return f.release.prerelease ? sourceSha : targetSha
        },
        listReleases: () => [...(state ? [state] : []), ...(options.otherReleases ?? [])],
        tagCommit: () => options.wrongTag ?? (f.release.prerelease ? sourceSha : targetSha),
        createDraft: (body) => {
            calls.push('create-draft')
            state = { ...body, id: 1, html_url: 'fixture', assets: [] }
            return state
        },
        uploadAsset: (tag, path) => {
            calls.push(`upload:${path.split('/').at(-1)}`)
            const asset = {
                id: state.assets.length + 1,
                name: path.split('/').at(-1),
                state: 'uploaded',
            }
            state.assets.push(asset)
            blobs.set(asset.id, readFileSync(path))
            if (options.interruptUpload) {
                options.interruptUpload = false
                throw Error('interrupted upload')
            }
        },
        readAsset: (asset) => (options.badAsset ? Buffer.from('mismatched') : blobs.get(asset.id)),
        getRelease: () => state,
        publishDraft: (id, patch) => {
            calls.push({ publish: patch })
            Object.assign(state, patch)
        },
    }
    return { io, calls, state: () => state }
}

function gitMock(f, options = {}) {
    const calls = []
    const git = (args) => {
        calls.push(args)
        const ok = (stdout = '') => ({ status: 0, stdout })
        if (args[0] === 'show') return ok(f.sourceFiles[args[1].split(':')[1]])
        if (args[0] === 'rev-list')
            return ok(
                `${options.existing} ${sourceSha}${
                    options.extraParent ? ' ' + options.extraParent : ''
                }`,
            )
        if (args[0] === 'rev-parse' && args[1] === '--verify')
            return options.existing ? ok(`${options.existing}\n`) : { status: 1, stdout: '' }
        if (args[0] === 'rev-parse') {
            const ref = args[1]
            if (ref.endsWith('^')) return ok(sourceSha)
            if (ref.endsWith('^{tree}')) return ok('same-generated-tree')
            if (ref.startsWith('origin/'))
                return ok(options.maintenance ? 'c'.repeat(40) : sourceSha)
            return ok(targetSha)
        }
        if (args[0] === 'merge-base') return { status: options.existing ? 0 : 1, stdout: '' }
        if (args[0] === 'merge' && options.conflict) return { status: 1, stdout: '' }
        if (args[0] === 'ls-remote') return ok(options.existing ? 'retained-note-ref' : '')
        if (args[0] === 'notes' && args[2] === 'show')
            return options.existing
                ? ok(JSON.stringify({ channels: [f.release.prerelease ? 'next' : null] }))
                : { status: 1, stdout: '' }
        return ok()
    }
    return { git, calls }
}

test('stable commitback restores exactly version/lock/changelog and atomic tag/channel records', () => {
    const f = fixture()
    try {
        assert.deepEqual(verifyRecordFiles(f.directory, f.release), f.files)
        const m = gitMock(f)
        assert.equal(
            recordGit(f.release, f.files, m.git, (files) => assert.deepEqual(files, f.files)),
            targetSha,
        )
        assert.ok(
            m.calls.some(
                (args) =>
                    args[0] === 'commit' && args[2].startsWith('chore(release): 2.2.5 [skip ci]'),
            ),
        )
        const push = m.calls.find((args) => args[0] === 'push')
        assert.ok(push.includes('--atomic'))
        assert.ok(push.includes('HEAD:refs/heads/main'))
        assert.ok(push.includes('refs/tags/v2.2.5:refs/tags/v2.2.5'))
        assert.ok(
            m.calls.some((args) => args[0] === 'notes' && args.includes('{"channels":[null]}')),
        )
        assert.ok(!m.calls.flat().includes('--force'))
        const tampered = {
            ...f.files,
            'package.json': JSON.stringify({
                name: f.release.name,
                version: '2.2.5',
                dependencies: { unwanted: '*' },
            }),
        }
        assert.throws(() => verifyGeneratedFiles(f.release, tampered, f.sourceFiles))
    } finally {
        f.cleanup()
    }
})

test('next tags the exact source with next channel notes and no generated commitback', () => {
    const f = fixture(true)
    try {
        const m = gitMock(f)
        assert.equal(
            recordGit(f.release, f.files, m.git, () =>
                assert.fail('prerelease must not write source files'),
            ),
            sourceSha,
        )
        assert.ok(!m.calls.some((args) => ['commit', 'add', 'merge'].includes(args[0])))
        assert.ok(
            m.calls.some((args) => args[0] === 'notes' && args.includes('{"channels":["next"]}')),
        )
        assert.ok(
            !m.calls.find((args) => args[0] === 'push').some((arg) => arg.includes('refs/heads/')),
        )
    } finally {
        f.cleanup()
    }
})

test('later workflow maintenance merges retained generated files; a conflict stops before any push', () => {
    const f = fixture()
    try {
        const m = gitMock(f, { maintenance: true })
        recordGit(f.release, f.files, m.git, () => {})
        assert.ok(m.calls.some((args) => args[0] === 'merge' && args.at(-1) === targetSha))
        const conflict = gitMock(f, { maintenance: true, conflict: true })
        assert.throws(() => recordGit(f.release, f.files, conflict.git, () => {}), /never repack/)
        assert.ok(!conflict.calls.some((args) => args[0] === 'push'))
        const retry = gitMock(f, { existing: targetSha })
        assert.equal(
            recordGit(f.release, f.files, retry.git, () => {}),
            targetSha,
        )
        assert.ok(!retry.calls.some((args) => ['push', 'tag'].includes(args[0])))
        const mergeTag = gitMock(f, { existing: targetSha, extraParent: 'd'.repeat(40) })
        assert.throws(() => recordGit(f.release, f.files, mergeTag.git, () => {}), /source parents/)
        assert.ok(!mergeTag.calls.some((args) => ['push', 'tag'].includes(args[0])))
    } finally {
        f.cleanup()
    }
})

test('no release record writes occur until both required registries have completed', () => {
    const f = fixture()
    try {
        const r = remote(f, { missingRegistry: true })
        assert.throws(() => completeRecord(f.release, f.directory, r.io), /missing mirror/)
        assert.deepEqual(r.calls, ['registry-gate'])
    } finally {
        f.cleanup()
    }
})

test('interrupted draft uploads resume original assets; completed records are idempotent and preserve body', () => {
    for (const prerelease of [false, true]) {
        const f = fixture(prerelease)
        try {
            const r = remote(f, { interruptUpload: true })
            assert.throws(() => completeRecord(f.release, f.directory, r.io), /interrupted/)
            assert.equal(r.state().draft, true)
            r.state().body += '\n\nMaintainer-edited explanation'
            const body = r.state().body
            const result = completeRecord(f.release, f.directory, r.io)
            assert.equal(result.draft, false)
            assert.equal(result.prerelease, prerelease)
            assert.equal(result.body, body)
            assert.equal(r.calls.filter((call) => call === 'create-draft').length, 1)
            assert.equal(
                r.calls.filter((call) => call === `upload:${f.release.filename}`).length,
                1,
            )
            const writes = r.calls.filter(
                (call) => typeof call === 'object' || call.startsWith('upload:'),
            ).length
            completeRecord(f.release, f.directory, r.io)
            assert.equal(
                r.calls.filter((call) => typeof call === 'object' || call.startsWith('upload:'))
                    .length,
                writes,
            )
            assert.equal(
                r.calls.find((call) => call.publish).publish.make_latest,
                prerelease ? 'false' : 'true',
            )
        } finally {
            f.cleanup()
        }
    }
})

test('wrong tag, conflicting assets, incomplete published records and changed channel fail closed', () => {
    const f = fixture()
    try {
        const r = remote(f)
        completeRecord(f.release, f.directory, r.io)
        const count = r.calls.length
        const saved = r.state().assets.pop()
        assert.throws(
            () => completeRecord(f.release, f.directory, r.io),
            /original-byte manual recovery/,
        )
        assert.ok(
            !r.calls
                .slice(count)
                .some((call) => typeof call === 'object' || call.startsWith('upload:')),
        )
        r.state().assets.push(saved)
        r.state().prerelease = true
        assert.throws(() => completeRecord(f.release, f.directory, r.io), /channel differs/)
        r.state().prerelease = false
        r.io.tagCommit = () => 'wrong'
        assert.throws(() => completeRecord(f.release, f.directory, r.io), /tag differs/)
        r.io.tagCommit = () => targetSha
        r.io.readAsset = () => Buffer.from('other-build')
        assert.throws(() => completeRecord(f.release, f.directory, r.io), /never overwrite/)
    } finally {
        f.cleanup()
    }
})

test('prerelease publication preserves next and blocks latest promotion or older next downgrade', () => {
    const f = fixture(true)
    try {
        assert.equal(channelFor(f.release.version), 'next')
        assert.throws(
            () => validateChannel(f.release.version, f.release.sourceRef, 'latest'),
            /never promote latest/,
        )
        assert.throws(
            () => assertNoDowngrade(f.release.version, '2.3.0-next.2', 'next'),
            /preserve next/,
        )
        const calls = []
        const results = [
            missing,
            success({ next: '2.2.5-next.2', latest: '2.2.4' }),
            success({}),
            success({ integrity: 'same' }),
        ]
        publish(
            { ...f.release, tarball: '/original.tgz', integrity: 'same' },
            'npm',
            (args) => {
                calls.push(args)
                return results.shift()
            },
            'https://registry.npmjs.org/',
            undefined,
            {},
            () => {},
        )
        assert.ok(calls.find((args) => args[0] === 'publish').includes('--tag=next'))
        assert.ok(!calls.flat().includes('--tag=latest'))
    } finally {
        f.cleanup()
    }
})

test('older stable release record cannot replace a newer GitHub latest', () => {
    const f = fixture()
    try {
        const r = remote(f, {
            otherReleases: [{ tag_name: 'v2.2.6', draft: false, prerelease: false }],
        })
        completeRecord(f.release, f.directory, r.io)
        assert.equal(r.calls.find((call) => call.publish).publish.make_latest, 'false')
    } finally {
        f.cleanup()
    }
})

test('next source remains anchored to reviewed main and the trusted next branch after maintenance', () => {
    const f = fixture(true)
    try {
        const run = {
            repository: { full_name: 'todoist/react-interpolate' },
            head_repository: { full_name: 'todoist/react-interpolate' },
            workflow_id: 12,
            path: '.github/workflows/pack.yml',
            event: 'push',
            status: 'completed',
            conclusion: 'success',
            head_branch: 'next',
            head_sha: sourceSha,
        }
        const compare = (base, head) => ({
            status: base === sourceSha && head === 'main' ? 'behind' : 'ahead',
        })
        assert.equal(validateSourceRun(run, 12, compare).ref, 'refs/heads/next')
        validateMainBase(f.release, compare)
        assert.throws(
            () => validateMainBase(f.release, () => ({ status: 'diverged' })),
            /forward migration line/,
        )
        assert.throws(() => validateSourceRun({ ...run, event: 'pull_request' }, 12, compare))
    } finally {
        f.cleanup()
    }
})
