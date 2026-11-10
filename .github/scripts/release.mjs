import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
    bootstrap,
    verify,
    preflightRegistries,
    publish,
    withRegistry,
    registryMetadata,
    assertSameArtifact,
} from './artifact.mjs'
import { api, repository, sourceRun } from './release-source.mjs'

const [command, runId, attempt, version, destination = 'both', tag = 'latest'] =
    process.argv.slice(2)
assert.ok(['verify', 'bootstrap', 'publish', 'record'].includes(command))
assert.match(version, /^\d+\.\d+\.\d+$/)
assert.ok(['npm', 'github', 'both'].includes(destination))
assert.ok(['latest', 'recovery'].includes(tag))
const source = sourceRun(runId, attempt)
const directory = mkdtempSync(join(tmpdir(), 'react-interpolate-retained-'))
try {
    // Always fetch the original successful run's artifact, including for terminal bootstrap.
    // A locally invented release.json is not a publication authority.
    execFileSync(
        'gh',
        [
            'run',
            'download',
            runId,
            '--repo',
            repository,
            '--name',
            `react-interpolate-${version}-${runId}-${attempt}`,
            '--dir',
            directory,
        ],
        { stdio: 'inherit' },
    )
    const release = verify(directory, source.sha, version, source.ref)
    assert.equal(release.runId, runId)
    assert.equal(release.runAttempt, attempt)
    assert.equal(release.gitTag, `v${version}`)
    assert.ok(release.notes?.startsWith('[Posted by Jarvis]\n\n'))
    preflightRegistries(release)
    if (command === 'bootstrap') {
        assert.equal(destination, 'npm')
        assert.ok(
            process.stdin.isTTY && process.stdout.isTTY,
            'Bootstrap needs an interactive terminal for login and publish-time 2FA',
        )
        withRegistry('npm', (run, registry) => bootstrap(release, run, registry, tag))
    } else if (command === 'publish') {
        for (const target of destination === 'both' ? ['npm', 'github'] : [destination])
            withRegistry(target, (run, registry) => publish(release, target, run, registry, tag))
    } else if (command === 'record') {
        // Both copies must exist and match before establishing the next semantic baseline.
        for (const target of ['npm', 'github'])
            withRegistry(target, (run, registry) =>
                assertSameArtifact(
                    registryMetadata(run, registry, `${release.name}@${version}`),
                    release,
                ),
            )
        const tags = api(`git/matching-refs/tags/v${version}`)
        const existing = tags.find((ref) => ref.ref === `refs/tags/v${version}`)
        if (existing)
            assert.equal(
                api(`commits/v${version}`).sha,
                source.sha,
                'Never move an existing release tag',
            )
        const records = api('releases?per_page=100')
        const recorded = records.find((item) => item.tag_name === `v${version}`)
        if (recorded) {
            assert.equal(recorded.draft, false)
            assert.equal(recorded.prerelease, false)
            console.log(`Existing release record preserved: ${recorded.html_url}`)
        } else {
            const notes = join(directory, 'release-notes.md')
            writeFileSync(notes, release.notes)
            execFileSync(
                'gh',
                [
                    'release',
                    'create',
                    `v${version}`,
                    '--repo',
                    repository,
                    '--target',
                    source.sha,
                    '--title',
                    `v${version}`,
                    '--notes-file',
                    notes,
                    '--latest=false',
                    release.tarball,
                    join(directory, 'release.json'),
                ],
                { stdio: 'inherit' },
            )
        }
    }
    console.log(`Verified original ${release.filename}: ${release.integrity}`)
} finally {
    rmSync(directory, { recursive: true, force: true })
}
