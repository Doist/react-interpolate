import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { selectOriginalArchive, verifyArchive, extractOriginalArchive } from './artifact-source.mjs'
import { requireGithubRegistryMetadata } from './artifact.mjs'
import { requirePublishedBaseline } from './baseline.mjs'

const source = { sha: 'a'.repeat(40), ref: 'refs/heads/main' }
const artifact = {
    id: 456,
    name: 'react-interpolate-2.2.5-123-1',
    expired: false,
    digest: `sha256:${'0'.repeat(64)}`,
    workflow_run: { id: 123, head_sha: source.sha, head_branch: 'main' },
}
const success = (value) => ({ status: 0, stdout: JSON.stringify(value) })
const missing = { status: 1, stdout: JSON.stringify({ error: { code: 'E404' } }) }

test('original archive selection ignores later failed attempt state and binds immutable identity', () => {
    // Caller validated attempts/1, so later run-level attempt2 failure is irrelevant.
    assert.equal(
        selectOriginalArchive(
            [artifact, { ...artifact, id: 789, name: 'react-interpolate-2.2.5-123-2' }],
            source,
            '123',
            '1',
            '2.2.5',
        ).id,
        456,
    )
    for (const mutation of [
        { expired: true },
        { digest: null },
        { workflow_run: { ...artifact.workflow_run, head_sha: 'b'.repeat(40) } },
        { workflow_run: { ...artifact.workflow_run, id: 999 } },
    ])
        assert.throws(() =>
            selectOriginalArchive([{ ...artifact, ...mutation }], source, '123', '1', '2.2.5'),
        )
    assert.throws(() => selectOriginalArchive([artifact, artifact], source, '123', '1', '2.2.5'))
    assert.throws(
        () => verifyArchive(artifact, Buffer.from('self-consistent but not original archive')),
        /API digest/,
    )
})

test('archive API digest and each safely extracted local entry bind to original ZIP bytes', () => {
    const directory = mkdtempSync(join(tmpdir(), 'interpolate-archive-test-'))
    try {
        const zip = execFileSync('python3', [
            '-c',
            'import io,sys,zipfile\nb=io.BytesIO()\nwith zipfile.ZipFile(b,"w") as z:\n z.writestr("release.json","{\\"schema\\":2}")\n z.writestr("todoist-react-interpolate-2.2.5.tgz",b"synthetic original bytes")\nsys.stdout.buffer.write(b.getvalue())',
        ])
        const metadata = {
            ...artifact,
            digest: `sha256:${createHash('sha256').update(zip).digest('hex')}`,
        }
        const entries = extractOriginalArchive(metadata, zip, directory, '2.2.5')
        assert.equal(
            readFileSync(join(directory, 'todoist-react-interpolate-2.2.5.tgz'), 'utf8'),
            'synthetic original bytes',
        )
        assert.equal(
            entries['release.json'],
            createHash('sha256').update('{"schema":2}').digest('hex'),
        )
        assert.throws(
            () =>
                extractOriginalArchive(
                    metadata,
                    Buffer.concat([zip, Buffer.from('tampered')]),
                    directory,
                    '2.2.5',
                ),
            /API digest/,
        )
        const traversal = execFileSync('python3', [
            '-c',
            'import io,sys,zipfile\nb=io.BytesIO()\nwith zipfile.ZipFile(b,"w") as z:z.writestr("../outside","bad")\nsys.stdout.buffer.write(b.getvalue())',
        ])
        assert.throws(
            () =>
                extractOriginalArchive(
                    {
                        ...metadata,
                        digest: `sha256:${createHash('sha256').update(traversal).digest('hex')}`,
                    },
                    traversal,
                    directory,
                    '2.2.5',
                ),
            /Unexpected or duplicate artifact entry/,
        )
        assert.equal(existsSync(join(dirname(directory), 'outside')), false)
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
})

test('REST visibility and whoami cannot turn a registry package404 into version absence', () => {
    for (const response of [missing, success(null), success([]), success('bad metadata')]) {
        const replies = [success('authorized-user'), response]
        assert.throws(
            () =>
                requireGithubRegistryMetadata(() => replies.shift(), 'https://npm.pkg.github.com/'),
            /metadata is not readable/,
        )
    }
    const replies = [success('authorized-user'), success({ latest: '2.2.2' })]
    assert.deepEqual(
        requireGithubRegistryMetadata(() => replies.shift(), 'https://npm.pkg.github.com/'),
        { latest: '2.2.2' },
    )
})

test('an interrupted new-scope record cannot become the next semantic baseline', () => {
    const record = {
        id: 1,
        tag_name: 'v2.2.5',
        target_commitish: source.sha,
        draft: false,
        prerelease: false,
        published_at: '2026-11-10T20:00:00Z',
    }
    assert.throws(() => requirePublishedBaseline(null, '2.2.5'), /recover its original artifact/)
    assert.throws(
        () => requirePublishedBaseline({ ...record, draft: true }, '2.2.5', source.sha),
        /finish original-asset recovery/,
    )
    assert.throws(
        () =>
            requirePublishedBaseline(
                { ...record, tag_name: 'v2.3.0-next.1' },
                '2.3.0-next.1',
                source.sha,
            ),
        /channel differs/,
    )
    requirePublishedBaseline(record, '2.2.5', source.sha)
    requirePublishedBaseline(
        { ...record, tag_name: 'v2.3.0-next.1', prerelease: true },
        '2.3.0-next.1',
        source.sha,
    )
    for (const published_at of [undefined, null, '', 'not-a-date', '2026-02-30T20:00:00Z'])
        assert.throws(
            () => requirePublishedBaseline({ ...record, published_at }, '2.2.5', source.sha),
            /valid publication timestamp/,
        )
    for (const mutation of [
        { id: 2 },
        { tag_name: 'v2.2.6' },
        { target_commitish: 'b'.repeat(40) },
        { prerelease: true },
    ])
        assert.throws(() =>
            requirePublishedBaseline({ ...record, ...mutation }, '2.2.5', source.sha, record.id),
        )
})
