import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { channelFor, validateChannel } from './release-policy.mjs'

export const stableFiles = ['CHANGELOG.md', 'package.json', 'package-lock.json']
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')

export function retainRecordFiles(directory, release) {
    release.recordFiles = {}
    if (channelFor(release.version) === 'latest') {
        for (const path of stableFiles) {
            const filename = `record-${path}`
            const bytes = readFileSync(path)
            writeFileSync(join(directory, filename), bytes)
            release.recordFiles[path] = { filename, sha256: digest(bytes) }
        }
    }
}

export function verifyRecordFiles(directory, release) {
    assert.equal(
        release.schema,
        2,
        'Schema-1 publication remains retryable; release-record recovery needs an original-byte manual record plan, never repack',
    )
    const channel = validateChannel(release.version, release.sourceRef)
    assert.equal(release.channel, channel)
    assert.equal(release.gitTag, `v${release.version}`)
    assert.equal(release.prerelease, channel === 'next')
    assert.equal(typeof release.semanticNotes, 'string')
    assert.equal(release.notes, `[Posted by Jarvis]\n\n${release.semanticNotes}`)
    assert.deepEqual(
        Object.keys(release.recordFiles).sort(),
        channel === 'latest' ? [...stableFiles].sort() : [],
    )
    const files = {}
    for (const [path, record] of Object.entries(release.recordFiles)) {
        assert.equal(record.filename, `record-${path}`)
        const bytes = readFileSync(join(directory, record.filename))
        assert.equal(digest(bytes), record.sha256, `Retained ${path} differs`)
        files[path] = bytes.toString('utf8')
    }
    if (channel === 'latest') {
        const pkg = JSON.parse(files['package.json'])
        const lock = JSON.parse(files['package-lock.json'])
        for (const value of [pkg, lock, lock.packages['']]) {
            assert.equal(value.name, release.name)
            assert.equal(value.version, release.version)
        }
    }
    return files
}

// Commitback may change only the same generated fields as the old semantic pipeline.
export function verifyGeneratedFiles(release, files, sourceFiles) {
    if (release.channel === 'next') {
        assert.deepEqual(files, {})
        return
    }
    const pkg = JSON.parse(sourceFiles['package.json'])
    pkg.version = release.version
    assert.deepEqual(JSON.parse(files['package.json']), pkg)
    const lock = JSON.parse(sourceFiles['package-lock.json'])
    lock.version = release.version
    lock.packages[''].version = release.version
    assert.deepEqual(JSON.parse(files['package-lock.json']), lock)
    const previous = sourceFiles['CHANGELOG.md'].trim()
    assert.equal(
        files['CHANGELOG.md'],
        `${release.semanticNotes.trim()}\n${previous ? `\n${previous}\n` : ''}`,
        'Changelog must contain the original calculated notes and historical contents',
    )
}
