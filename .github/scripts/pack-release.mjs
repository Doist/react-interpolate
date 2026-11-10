import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { appendFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import semanticRelease from 'semantic-release'
import { verifyPreviousRelease } from './baseline.mjs'
import changelog from '@semantic-release/changelog'
import {
    pack,
    withRegistry,
    registryMetadata,
    githubVisibility,
    requireGithubRegistryMetadata,
} from './artifact.mjs'
import { checkPackSource } from './release-source.mjs'
import { channelFor, parseVersion, validateChannel } from './release-policy.mjs'
import { retainRecordFiles, verifyRecordFiles } from './record-data.mjs'

const [directory, expectedVersion = ''] = process.argv.slice(2)
if (expectedVersion) parseVersion(expectedVersion)
const source = checkPackSource()
const result = await semanticRelease({ dryRun: true })
if (!result) {
    console.log('No releasable Conventional Commits; no artifact or release record')
    process.exit(0)
}
verifyPreviousRelease(result.lastRelease.gitTag)
const version = result.nextRelease.version
parseVersion(version)
if (expectedVersion)
    assert.equal(
        version,
        expectedVersion,
        'Version differs from reviewed target; stop and reconcile',
    )
const channel = validateChannel(version, source.ref)
assert.equal(result.nextRelease.channel ?? 'latest', channel)
assert.equal(result.nextRelease.gitTag, `v${version}`)
// Already-published versions must use the original run; never repack for a mirror retry.
githubVisibility()
for (const destination of ['npm', 'github']) {
    withRegistry(destination, (run, registry) => {
        if (destination === 'github') requireGithubRegistryMetadata(run, registry)
        assert.equal(
            registryMetadata(run, registry, `@todoist/react-interpolate@${version}`),
            null,
            'Version already exists: use the original retained artifact, never repack',
        )
    })
}
// These changes exist only in the ephemeral checkout/artifact until both registries pass.
if (channel === 'latest')
    await changelog.prepare(
        {},
        { cwd: process.cwd(), nextRelease: result.nextRelease, logger: console },
    )
execFileSync('npm', ['version', version, '--no-git-tag-version', '--ignore-scripts'], {
    stdio: 'inherit',
})
execFileSync('npm', ['run', 'build'], { stdio: 'inherit' })
const release = pack(resolve(directory), source.sha, source.ref)
Object.assign(release, {
    schema: 2,
    mainBase: source.mainBase,
    channel: channelFor(version),
    prerelease: channel === 'next',
    runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    lastTag: result.lastRelease.gitTag,
    gitTag: result.nextRelease.gitTag,
    semanticNotes: result.nextRelease.notes,
    notes: `[Posted by Jarvis]\n\n${result.nextRelease.notes}`,
})
assert.match(release.runId, /^[1-9][0-9]*$/)
assert.match(release.runAttempt, /^[1-9][0-9]*$/)
retainRecordFiles(directory, release)
verifyRecordFiles(directory, release)
writeFileSync(join(directory, 'release.json'), `${JSON.stringify(release, null, 2)}\n`)
writeFileSync(join(directory, 'release-notes.md'), `${release.notes}\n`)
if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\nprepared=true\n`)
console.log(
    `Retained ${release.filename} (${release.integrity}) from ${source.sha}; no publication, tag or commitback`,
)
