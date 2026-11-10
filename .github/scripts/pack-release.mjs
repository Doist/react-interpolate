import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import semanticRelease from 'semantic-release'
import { pack, withRegistry, registryMetadata, githubVisibility } from './artifact.mjs'
import { checkPackSource } from './release-source.mjs'

const [directory, expectedVersion] = process.argv.slice(2)
assert.match(expectedVersion, /^\d+\.\d+\.\d+$/)
const sha = checkPackSource()
const result = await semanticRelease({ dryRun: true })
assert.ok(result, 'No releasable Conventional Commits; do not invent a release')
assert.equal(
    result.nextRelease.version,
    expectedVersion,
    'Version differs from reviewed target; stop and reconcile',
)
assert.equal(result.nextRelease.gitTag, `v${expectedVersion}`)
assert.ok(!result.nextRelease.channel, 'Only stable main releases are enabled during migration')
// A partially published version must be recovered from its original run, never repacked.
githubVisibility()
for (const destination of ['npm', 'github']) {
    withRegistry(destination, (run, registry) => {
        if (destination === 'github')
            assert.equal(
                run(['whoami', `--registry=${registry}`]).status,
                0,
                'GitHub package authentication required',
            )
        assert.equal(
            registryMetadata(run, registry, `@todoist/react-interpolate@${expectedVersion}`),
            null,
            'Version already exists: use the original retained artifact for recovery, never repack',
        )
    })
}
// npm version only changes the ephemeral checkout; no tag, commit or publish lifecycle.
execFileSync('npm', ['version', expectedVersion, '--no-git-tag-version', '--ignore-scripts'], {
    stdio: 'inherit',
})
execFileSync('npm', ['run', 'build'], { stdio: 'inherit' })
const release = pack(resolve(directory), sha, 'refs/heads/main')
release.runId = process.env.GITHUB_RUN_ID
release.runAttempt = process.env.GITHUB_RUN_ATTEMPT
release.lastTag = result.lastRelease.gitTag
release.gitTag = result.nextRelease.gitTag
release.notes = `[Posted by Jarvis]\n\n${result.nextRelease.notes}`
assert.match(release.runId, /^[1-9][0-9]*$/)
assert.match(release.runAttempt, /^[1-9][0-9]*$/)
writeFileSync(join(directory, 'release.json'), `${JSON.stringify(release, null, 2)}\n`)
// Keep notes beside the tarball for the normal v<version> GitHub release record.
writeFileSync(join(directory, 'release-notes.md'), `${release.notes}\n`)
console.log(
    `Retained ${release.filename} (${release.integrity}) from ${sha}; no registry or GitHub writes`,
)
