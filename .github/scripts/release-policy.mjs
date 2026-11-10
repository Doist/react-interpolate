import assert from 'node:assert/strict'

export function parseVersion(version) {
    const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-next\.(0|[1-9]\d*))?$/.exec(version)
    assert.ok(match, 'Expected a stable version or the existing next.N prerelease format')
    const parts = match.slice(1).map((part) => (part === undefined ? null : Number(part)))
    assert.ok(parts.every((part) => part === null || Number.isSafeInteger(part)))
    return parts
}

export function channelFor(version) {
    return parseVersion(version)[3] === null ? 'latest' : 'next'
}

export function compareVersions(left, right) {
    const a = parseVersion(left)
    const b = parseVersion(right)
    for (let index = 0; index < 3; index++) {
        if (a[index] !== b[index]) return Math.sign(a[index] - b[index])
    }
    if (a[3] === b[3]) return 0
    if (a[3] === null) return 1
    if (b[3] === null) return -1
    return Math.sign(a[3] - b[3])
}

export function validateChannel(version, ref, tag = channelFor(version)) {
    const channel = channelFor(version)
    assert.equal(
        ref,
        channel === 'latest' ? 'refs/heads/main' : 'refs/heads/next',
        'Version does not match the trusted source branch',
    )
    assert.ok(
        [channel, 'recovery'].includes(tag),
        'Publication must preserve its original channel; prereleases never promote latest',
    )
    return channel
}

export function assertNoDowngrade(version, current, tag) {
    if (current && tag !== 'recovery') {
        assert.ok(
            compareVersions(current, version) <= 0,
            `Registry ${tag} ${current} is newer than ${version}; use recovery tag to preserve ${tag}`,
        )
    }
}
