import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
    verify,
    preflightRegistries,
    withRegistry,
    registryMetadata,
    assertSameArtifact,
} from './artifact.mjs'
import { stableFiles, verifyRecordFiles, verifyGeneratedFiles } from './record-data.mjs'
import { repository, migrationBase, sourceRun, validateMainBase, api } from './release-source.mjs'

export function requirePublishedBaseline(record, version) {
    assert.ok(
        record,
        'Prior new-scope tag lacks a completed release record; recover its original artifact before another pack',
    )
    assert.equal(record.tag_name, `v${version}`)
    assert.equal(
        record.draft,
        false,
        'Prior release draft is incomplete; finish original-asset recovery before another pack',
    )
    assert.equal(record.prerelease, version.includes('-next.'), 'Prior release channel differs')
}

// Read-only gate: a tag pushed before interrupted asset uploads is not a completed baseline.
// Old-scope tags on the original base are history only, not historical mirror repair targets.
export function verifyPreviousRelease(lastTag) {
    assert.ok(lastTag, 'Existing semantic lineage is missing; do not start a new 1.0.0 line')
    const git = (...args) =>
        execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
    const legacy = spawnSync('git', ['merge-base', '--is-ancestor', lastTag, migrationBase])
    if (legacy.status === 0) return
    assert.equal(legacy.status, 1, 'Cannot classify the previous tag')
    const records = JSON.parse(
        execFileSync(
            'gh',
            ['api', '--paginate', '--slurp', `repos/${repository}/releases?per_page=100`],
            { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
        ),
    ).flat()
    const matches = records.filter((record) => record.tag_name === lastTag)
    assert.equal(
        matches.length,
        1,
        'Missing/ambiguous prior release; recover original record before another pack',
    )
    const record = matches[0]
    const version = lastTag.slice(1)
    requirePublishedBaseline(record, version)
    const read = (name) => {
        const assets = record.assets.filter((asset) => asset.name === name)
        assert.equal(
            assets.length,
            1,
            `Prior release lacks original asset ${name}; recover before another pack`,
        )
        const asset = assets[0]
        assert.equal(asset.state, 'uploaded')
        assert.match(
            asset.digest,
            /^sha256:[a-f0-9]{64}$/,
            'Prior release asset API digest is required',
        )
        const bytes = execFileSync(
            'gh',
            [
                'api',
                `repos/${repository}/releases/assets/${asset.id}`,
                '--header',
                'Accept: application/octet-stream',
            ],
            { maxBuffer: 32 * 1024 * 1024 },
        )
        assert.equal(`sha256:${createHash('sha256').update(bytes).digest('hex')}`, asset.digest)
        return bytes
    }
    const directory = mkdtempSync(join(tmpdir(), 'interpolate-baseline-'))
    try {
        const metadata = read('release.json')
        const release = JSON.parse(metadata)
        assert.equal(release.version, version)
        assert.equal(release.gitTag, lastTag)
        assert.equal(release.filename, `todoist-react-interpolate-${version}.tgz`)
        const source = sourceRun(release.runId, release.runAttempt)
        validateMainBase(release, (base, head) => api(`compare/${base}...${head}`))
        const names = [
            release.filename,
            ...(release.prerelease ? [] : stableFiles.map((path) => `record-${path}`)),
        ]
        writeFileSync(join(directory, 'release.json'), metadata)
        for (const name of names) writeFileSync(join(directory, name), read(name))
        const retained = verify(directory, source.sha, version, source.ref)
        const files = verifyRecordFiles(directory, retained)
        const target = git('rev-parse', `${lastTag}^{commit}`).trim()
        if (release.prerelease) assert.equal(target, source.sha)
        else {
            const parents = git('rev-list', '--parents', '-n', '1', lastTag).trim().split(' ')
            assert.deepEqual(
                parents,
                [target, source.sha],
                'Prior stable tag has a different source parent',
            )
            const changed = git('diff', '--name-only', source.sha, target).trim().split('\n').sort()
            assert.deepEqual(
                changed,
                [...stableFiles].sort(),
                'Prior record changed more than normal generated files',
            )
            const originals = {}
            for (const path of stableFiles) {
                originals[path] = git('show', `${source.sha}:${path}`)
                assert.equal(git('show', `${lastTag}:${path}`), files[path])
            }
            verifyGeneratedFiles(release, files, originals)
        }
        const note = JSON.parse(
            git('notes', `--ref=refs/notes/semantic-release-${lastTag}`, 'show', target),
        )
        assert.deepEqual(note, { channels: [release.prerelease ? 'next' : null] })
        preflightRegistries(retained)
        for (const destination of ['npm', 'github'])
            withRegistry(destination, (run, registry) =>
                assertSameArtifact(
                    registryMetadata(run, registry, `${retained.name}@${version}`),
                    retained,
                ),
            )
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
}
