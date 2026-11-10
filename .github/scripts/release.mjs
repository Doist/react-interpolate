import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
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
import { api, sourceRun, validateMainBase } from './release-source.mjs'

import { downloadOriginal } from './artifact-source.mjs'
import { channelFor, parseVersion } from './release-policy.mjs'
import { completeRecord, githubRecordIO } from './record-release.mjs'

const [command, runId, attempt, version, destination = 'both', tag = ''] = process.argv.slice(2)
assert.ok(['verify', 'bootstrap', 'publish', 'record'].includes(command))
parseVersion(version)
assert.ok(['npm', 'github', 'both'].includes(destination))
const publicationTag = tag || channelFor(version)
assert.ok(['latest', 'next', 'recovery'].includes(publicationTag))
const source = sourceRun(runId, attempt)
const directory = mkdtempSync(join(tmpdir(), 'react-interpolate-retained-'))
try {
    // Original successful attempt + immutable archive ID/API digest + local ZIP entry bytes.
    const archive = downloadOriginal(source, runId, attempt, version, directory)
    console.log(`Verified Actions artifact ${archive.id}: ${archive.digest}`)
    const release = verify(directory, source.sha, version, source.ref)
    if (release.schema === 1) assert.equal(source.ref, 'refs/heads/main')
    validateMainBase(release, (base, head) => api(`compare/${base}...${head}`))
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
        withRegistry('npm', (run, registry) => bootstrap(release, run, registry, publicationTag))
    } else if (command === 'publish') {
        for (const target of destination === 'both' ? ['npm', 'github'] : [destination])
            withRegistry(target, (run, registry) =>
                publish(release, target, run, registry, publicationTag),
            )
    } else if (command === 'record') {
        const completed = (retained) => {
            preflightRegistries(retained)
            for (const target of ['npm', 'github'])
                withRegistry(target, (run, registry) =>
                    assertSameArtifact(
                        registryMetadata(run, registry, `${retained.name}@${retained.version}`),
                        retained,
                    ),
                )
        }
        const record = completeRecord(release, directory, githubRecordIO(completed))
        console.log(`Verified normal release record: ${record.html_url}`)
    }
    console.log(`Verified original ${release.filename}: ${release.integrity}`)
} finally {
    rmSync(directory, { recursive: true, force: true })
}
