import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { repository } from './release-source.mjs'
import { stableFiles, verifyGeneratedFiles, verifyRecordFiles } from './record-data.mjs'

// All writes are confined to a disposable clone until one non-forced atomic push.
// The caller must first require matching completed copies in BOTH registries.
export function recordGit(release, files, git, writeFiles) {
    const command = (args, optional = false) => {
        const result = git(args)
        if (!optional)
            assert.equal(
                result.status,
                0,
                `Git record step failed (${args[0]}); retain original artifact and retry after resolving branch conflict/access, never repack`,
            )
        return result
    }
    const text = (args) => command(args).stdout.trim()
    const tag = release.gitTag
    const branch = release.sourceRef.slice('refs/heads/'.length)
    const noteRef = `refs/notes/semantic-release-${tag}`
    const existingTag = command(['rev-parse', '--verify', `refs/tags/${tag}^{commit}`], true)
    const sourceFiles = {}
    if (release.channel === 'latest') {
        for (const path of stableFiles)
            sourceFiles[path] = command(['show', `${release.sourceSha}:${path}`]).stdout
    }
    verifyGeneratedFiles(release, files, sourceFiles)
    command(['checkout', '--detach', release.sourceSha])
    let target = release.sourceSha
    if (release.channel === 'latest') {
        writeFiles(files)
        command(['add', '--', ...stableFiles])
        command([
            'commit',
            '-m',
            `chore(release): ${release.version} [skip ci]\n\n${release.semanticNotes}`,
        ])
        target = text(['rev-parse', 'HEAD'])
        if (existingTag.status === 0) {
            const prior = existingTag.stdout.trim()
            assert.deepEqual(
                text(['rev-list', '--parents', '-n', '1', prior]).split(' '),
                [prior, release.sourceSha],
                'Existing stable tag has different source parents; never move it',
            )
            assert.equal(
                text(['rev-parse', `${prior}^{tree}`]),
                text(['rev-parse', `${target}^{tree}`]),
                'Existing stable tag has different generated files; never move it',
            )
            target = prior
        }
    } else if (existingTag.status === 0) {
        assert.equal(
            existingTag.stdout.trim(),
            target,
            'Existing prerelease tag has a different source; never move it',
        )
    }

    const refs = []
    if (
        release.channel === 'latest' &&
        command(['merge-base', '--is-ancestor', target, `origin/${branch}`], true).status !== 0
    ) {
        if (text(['rev-parse', `origin/${branch}`]) === release.sourceSha) {
            command(['checkout', '-B', 'release-record', target])
        } else {
            // A later workflow-only change must not force a rebuild of this version.
            // Three-way merging preserves newer source/lock edits; conflicts stop before push.
            command(['checkout', '-B', 'release-record', `origin/${branch}`])
            command([
                'merge',
                '--no-ff',
                '--no-edit',
                '-m',
                `chore(release): record ${release.version} [skip ci]`,
                target,
            ])
        }
        refs.push(`HEAD:refs/heads/${branch}`)
    }
    if (existingTag.status !== 0) {
        command(['tag', tag, target])
        refs.push(`refs/tags/${tag}:refs/tags/${tag}`)
    }
    const remoteNote = text(['ls-remote', 'origin', noteRef])
    if (remoteNote) command(['fetch', 'origin', `${noteRef}:${noteRef}`])
    const note = command(['notes', `--ref=${noteRef}`, 'show', target], true)
    const channels = { channels: [release.channel === 'latest' ? null : 'next'] }
    if (note.status === 0)
        assert.deepEqual(
            JSON.parse(note.stdout),
            channels,
            'Existing semantic-release channel note differs; no rewriting',
        )
    else {
        assert.ok(!remoteNote, 'Existing version note belongs to another commit; no rewriting')
        command(['notes', `--ref=${noteRef}`, 'add', '-m', JSON.stringify(channels), target])
        refs.push(`${noteRef}:${noteRef}`)
    }
    if (refs.length) command(['push', '--atomic', 'origin', ...refs])
    return target
}

export function withGitRecord(release, directory) {
    const files = verifyRecordFiles(directory, release)
    assert.ok(process.env.GH_RECORD_TOKEN, 'Release bot GH_RECORD_TOKEN is required')
    for (const key of [
        'GIT_AUTHOR_NAME',
        'GIT_AUTHOR_EMAIL',
        'GIT_COMMITTER_NAME',
        'GIT_COMMITTER_EMAIL',
    ])
        assert.ok(
            process.env[key],
            `Release bot ${key} is required; use the protected record workflow`,
        )
    const temporary = mkdtempSync(join(tmpdir(), 'react-interpolate-record-'))
    const cwd = join(temporary, 'repo')
    const flags = [
        '-c',
        'credential.helper=',
        '-c',
        'credential.helper=!gh auth git-credential',
        '-c',
        'core.hooksPath=/dev/null',
        '-c',
        'commit.gpgsign=false',
    ]
    try {
        const env = {
            ...process.env,
            GH_TOKEN: process.env.GH_RECORD_TOKEN,
            GIT_CONFIG_NOSYSTEM: '1',
            GIT_CONFIG_GLOBAL: '/dev/null',
        }
        const clone = spawnSync(
            'git',
            [...flags, 'clone', '--no-checkout', `https://github.com/${repository}.git`, cwd],
            { encoding: 'utf8', env },
        )
        assert.equal(clone.status, 0, 'Could not read release repository; no record created')
        const git = (args) =>
            spawnSync('git', [...flags, ...args], {
                cwd,
                env,
                encoding: 'utf8',
                maxBuffer: 32 * 1024 * 1024,
            })
        return recordGit(release, files, git, (entries) => {
            for (const [path, contents] of Object.entries(entries))
                writeFileSync(join(cwd, path), contents)
        })
    } finally {
        rmSync(temporary, { recursive: true, force: true })
    }
}
