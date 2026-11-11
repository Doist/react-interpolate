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
import { api, sourceRun, validateMainBase, validateRetainedContext } from './release-source.mjs'

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
    validateRetainedContext(release, runId, attempt, version, source)
    validateMainBase(release, (base, head) => api(`compare/${base}...${head}`))
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
