import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { repository } from './release-source.mjs'

const sha256 = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`

export function selectOriginalArchive(artifacts, source, runId, attempt, version) {
    const name = `react-interpolate-${version}-${runId}-${attempt}`
    const matches = artifacts.filter((item) => item.name === name)
    assert.equal(
        matches.length,
        1,
        'Original artifact missing/ambiguous; recover archived original bytes, never repack',
    )
    const artifact = matches[0]
    assert.ok(Number.isSafeInteger(artifact.id) && artifact.id > 0)
    assert.equal(
        artifact.expired,
        false,
        'Original archive expired; use reviewed original-byte recovery, never repack',
    )
    assert.match(
        artifact.digest,
        /^sha256:[a-f0-9]{64}$/,
        'An authoritative Actions archive digest is required',
    )
    assert.equal(String(artifact.workflow_run.id), runId)
    assert.equal(artifact.workflow_run.head_sha, source.sha)
    assert.equal(artifact.workflow_run.head_branch, source.ref.slice('refs/heads/'.length))
    return artifact
}

export function verifyArchive(artifact, bytes) {
    assert.equal(
        sha256(bytes),
        artifact.digest,
        'Downloaded archive differs from the original Actions API digest',
    )
}

export function extractOriginalArchive(artifact, bytes, directory, version) {
    verifyArchive(artifact, bytes)
    const archive = join(directory, '.original.zip')
    writeFileSync(archive, bytes)
    const allowed = [
        `todoist-react-interpolate-${version}.tgz`,
        'release.json',
        'release-notes.md',
        'record-package.json',
        'record-package-lock.json',
        'record-CHANGELOG.md',
    ]
    // zipfile is standard library on the supported local/Actions Python runtimes.
    // Only flat, regular allowlisted entries are written; hashes bind local bytes to ZIP entries.
    const entries = JSON.parse(
        execFileSync(
            'python3',
            [
                '-c',
                `
import hashlib,json,pathlib,stat,sys,zipfile
archive,directory,allowed=sys.argv[1],pathlib.Path(sys.argv[2]),set(json.loads(sys.argv[3]))
with zipfile.ZipFile(archive) as z:
    entries={}
    total=0
    for item in z.infolist():
        if item.filename not in allowed or item.filename in entries or item.is_dir():
            raise ValueError('Unexpected or duplicate artifact entry')
        kind=stat.S_IFMT(item.external_attr >> 16)
        if kind not in (0,stat.S_IFREG): raise ValueError('Non-regular artifact entry')
        total+=item.file_size
        if total > 32*1024*1024: raise ValueError('Artifact exceeds expected size')
        data=z.read(item)
        entries[item.filename]=hashlib.sha256(data).hexdigest()
        (directory/item.filename).write_bytes(data)
    if not {'release.json',sys.argv[4]}.issubset(entries): raise ValueError('Missing original package/metadata')
    print(json.dumps(entries))
`,
                archive,
                directory,
                JSON.stringify(allowed),
                allowed[0],
            ],
            { encoding: 'utf8' },
        ),
    )
    for (const [name, digest] of Object.entries(entries))
        assert.equal(
            sha256(readFileSync(join(directory, name))),
            `sha256:${digest}`,
            'Local bytes differ from the verified original ZIP entry',
        )
    return entries
}

export function downloadOriginal(source, runId, attempt, version, directory) {
    const pages = JSON.parse(
        execFileSync(
            'gh',
            [
                'api',
                '--paginate',
                '--slurp',
                `repos/${repository}/actions/runs/${runId}/artifacts?per_page=100`,
            ],
            { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
        ),
    )
    const artifact = selectOriginalArchive(
        pages.flatMap((page) => page.artifacts),
        source,
        runId,
        attempt,
        version,
    )
    // Download by immutable artifact ID, not name or the latest run attempt.
    const bytes = execFileSync(
        'gh',
        ['api', `repos/${repository}/actions/artifacts/${artifact.id}/zip`],
        { maxBuffer: 32 * 1024 * 1024 },
    )
    extractOriginalArchive(artifact, bytes, directory, version)
    return { id: artifact.id, digest: artifact.digest, name: artifact.name }
}
