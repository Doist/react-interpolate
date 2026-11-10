import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { compareVersions } from './release-policy.mjs'
import { repository } from './release-source.mjs'
import { verifyRecordFiles } from './record-data.mjs'
import { withGitRecord } from './record-git.mjs'

export function completeRecord(release, directory, io) {
    verifyRecordFiles(directory, release)
    // No commitback, tag, Git note, draft, asset or release write precedes this gate.
    io.requireCompletedRegistries(release)
    const target = io.recordGit(release, directory)
    const releases = io.listReleases()
    const matches = releases.filter((entry) => entry.tag_name === release.gitTag)
    assert.ok(
        matches.length <= 1,
        'Ambiguous release records; original-byte manual recovery required',
    )
    let record = matches[0]
    if (record) {
        assert.equal(record.prerelease, release.prerelease, 'Existing release channel differs')
        assert.equal(
            io.tagCommit(release.gitTag),
            target,
            'Release tag differs from original generated record',
        )
    } else {
        record = io.createDraft({
            tag_name: release.gitTag,
            target_commitish: target,
            name: release.gitTag,
            body: release.notes,
            draft: true,
            prerelease: release.prerelease,
            make_latest: 'false',
        })
    }
    const required = [
        release.filename,
        'release.json',
        ...Object.values(release.recordFiles).map((entry) => entry.filename),
    ]
    for (const filename of required) {
        const expected = readFileSync(join(directory, filename))
        const asset = record.assets.find((item) => item.name === filename)
        if (asset) {
            assert.equal(
                asset.state,
                'uploaded',
                'Incomplete asset: retain original bytes and resolve the interrupted upload manually',
            )
            assert.deepEqual(
                io.readAsset(asset),
                expected,
                `Existing ${filename} differs; never overwrite release assets`,
            )
        } else {
            assert.equal(
                record.draft,
                true,
                `Published release lacks ${filename}; stop for original-byte manual recovery, never recreate the release`,
            )
            io.uploadAsset(release.gitTag, join(directory, filename))
        }
    }
    // Re-read after uploads. A matching tag or a half-uploaded draft is not completion.
    record = io.getRelease(record.id)
    assert.equal(record.tag_name, release.gitTag)
    assert.equal(record.prerelease, release.prerelease)
    assert.equal(io.tagCommit(release.gitTag), target)
    for (const filename of required) {
        const assets = record.assets.filter((item) => item.name === filename)
        assert.equal(assets.length, 1, `Missing/duplicate retained asset: ${filename}`)
        assert.equal(assets[0].state, 'uploaded')
        assert.deepEqual(io.readAsset(assets[0]), readFileSync(join(directory, filename)))
    }
    if (record.draft) {
        assert.ok(
            record.body?.startsWith('[Posted by Jarvis]\n\n'),
            'Draft attribution changed; preserve user edits and resolve before publication',
        )
        const newerStable = io
            .listReleases()
            .some(
                (item) =>
                    !item.draft &&
                    !item.prerelease &&
                    /^v\d+\.\d+\.\d+$/.test(item.tag_name) &&
                    compareVersions(item.tag_name.slice(1), release.version) > 0,
            )
        io.publishDraft(record.id, {
            draft: false,
            prerelease: release.prerelease,
            make_latest: release.prerelease || newerStable ? 'false' : 'true',
        })
        record = io.getRelease(record.id)
        assert.equal(
            record.draft,
            false,
            'Release publication did not complete; retry original artifact',
        )
        assert.equal(record.prerelease, release.prerelease)
    }
    return record
}

export function githubRecordIO(requireCompletedRegistries) {
    assert.ok(process.env.GH_RECORD_TOKEN, 'Release bot GH_RECORD_TOKEN is required')
    const env = { ...process.env, GH_TOKEN: process.env.GH_RECORD_TOKEN }
    const api = (path, body) =>
        JSON.parse(
            execFileSync(
                'gh',
                [
                    'api',
                    `repos/${repository}/${path}`,
                    ...(body
                        ? [
                              '--method',
                              path.startsWith('releases/') ? 'PATCH' : 'POST',
                              '--input',
                              '-',
                          ]
                        : []),
                ],
                {
                    env,
                    input: body ? JSON.stringify(body) : undefined,
                    encoding: 'utf8',
                    maxBuffer: 32 * 1024 * 1024,
                },
            ),
        )
    return {
        requireCompletedRegistries,
        recordGit: withGitRecord,
        listReleases: () =>
            JSON.parse(
                execFileSync(
                    'gh',
                    ['api', '--paginate', '--slurp', `repos/${repository}/releases?per_page=100`],
                    { env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
                ),
            ).flat(),
        tagCommit: (tag) => api(`commits/${tag}`).sha,
        createDraft: (body) => api('releases', body),
        getRelease: (id) => api(`releases/${id}`),
        publishDraft: (id, body) => api(`releases/${id}`, body),
        uploadAsset: (tag, file) =>
            execFileSync('gh', ['release', 'upload', tag, file, '--repo', repository], {
                env,
                stdio: 'inherit',
            }),
        readAsset: (asset) =>
            execFileSync(
                'gh',
                [
                    'api',
                    `repos/${repository}/releases/assets/${asset.id}`,
                    '--header',
                    'Accept: application/octet-stream',
                ],
                { env, maxBuffer: 32 * 1024 * 1024 },
            ),
    }
}
