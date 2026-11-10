import assert from 'node:assert/strict'

export function requirePublishedRecord(record) {
    assert.equal(record.draft, false, 'Release publication did not complete; retry original artifact')
    const timestamp = record.published_at
    assert.ok(
        typeof timestamp === 'string' &&
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(timestamp) &&
            Number.isFinite(Date.parse(timestamp)) &&
            new Date(timestamp).toISOString() === timestamp.replace(/(?<=:\d{2})Z$/, '.000Z'),
        'Release lacks a valid publication timestamp; recover the original record before proceeding',
    )
}

export function verifyRecordIdentity(record, expected) {
    assert.ok(Number.isSafeInteger(record.id) && record.id > 0, 'Missing release ID')
    assert.equal(record.id, expected.id, 'Release ID changed')
    assert.equal(record.tag_name, expected.tag_name, 'Release tag changed')
    assert.equal(record.target_commitish, expected.target_commitish, 'Release target changed')
    assert.equal(record.prerelease, expected.prerelease, 'Existing release channel differs')
    assert.equal(typeof record.draft, 'boolean', 'Release draft state is missing')
}

// Validate every existing retained asset before the caller uploads any missing ones.
export function verifyRecordAssets(record, expected, readAsset, allowMissing = false) {
    assert.ok(Array.isArray(record.assets), 'Release assets are missing')
    const missing = []
    for (const [filename, bytes] of expected) {
        const assets = record.assets.filter((item) => item.name === filename)
        assert.ok(assets.length <= 1, `Duplicate retained asset: ${filename}`)
        if (assets.length === 0) {
            assert.ok(
                allowMissing && record.draft === true,
                `Missing retained asset ${filename}; stop for original-byte manual recovery, never recreate the release`,
            )
            missing.push(filename)
            continue
        }
        assert.equal(
            assets[0].state,
            'uploaded',
            'Incomplete asset: retain original bytes and resolve the interrupted upload manually',
        )
        assert.deepEqual(
            readAsset(assets[0]),
            bytes,
            `Existing ${filename} differs; never overwrite release assets`,
        )
    }
    return missing
}
