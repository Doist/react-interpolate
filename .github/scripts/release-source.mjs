import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

export const repository = 'todoist/react-interpolate'
export const workflowPath = '.github/workflows/pack.yml'
export const migrationBase = '390477162083a72654cd8c4621096a49d4dfd626'
export const api = (path) =>
    JSON.parse(
        execFileSync('gh', ['api', `repos/${repository}/${path}`], {
            encoding: 'utf8',
            maxBuffer: 32 * 1024 * 1024,
        }),
    )
const ancestor = (compare, base, head) =>
    ['ahead', 'identical'].includes(compare(base, head).status)

export function validateSourceRun(run, workflowId, compare) {
    assert.equal(run.repository.full_name.toLowerCase(), repository)
    assert.equal(run.head_repository.full_name.toLowerCase(), repository)
    assert.equal(run.workflow_id, workflowId)
    assert.equal(run.path, workflowPath)
    assert.ok(['workflow_dispatch', 'push'].includes(run.event))
    assert.equal(run.status, 'completed')
    assert.equal(run.conclusion, 'success')
    assert.ok(['main', 'next'].includes(run.head_branch))
    assert.match(run.head_sha, /^[a-f0-9]{40}$/)
    assert.ok(
        ancestor(compare, run.head_sha, 'main') ||
            (run.head_branch === 'next' && ancestor(compare, run.head_sha, 'next')),
        'Source must remain in reviewed main/next history',
    )
    assert.ok(
        ancestor(compare, migrationBase, run.head_sha),
        'Historical pre-migration source is not publishable',
    )
    return { sha: run.head_sha, ref: `refs/heads/${run.head_branch}` }
}

export function validateMainBase(release, compare) {
    if (release.schema === 1) return // Original schema-1 stable runs already require main ancestry.
    assert.match(release.mainBase, /^[a-f0-9]{40}$/)
    assert.ok(
        ancestor(compare, migrationBase, release.mainBase),
        'Main base predates the forward migration line',
    )
    assert.ok(ancestor(compare, release.mainBase, 'main'), 'Retained base is not on reviewed main')
    assert.ok(
        ancestor(compare, release.mainBase, release.sourceSha),
        'Source is unrelated to its retained main base',
    )
}

export function validateRetainedContext(release, runId, attempt, version, source) {
    assert.equal(release.version, version)
    assert.equal(release.sourceSha, source.sha)
    assert.equal(release.sourceRef, source.ref)
    if (release.schema === 1) {
        // Schema 1 predates embedded run/notes fields. The original successful attempt
        // and immutable archive still bind these exact bytes before this check.
        assert.equal(source.ref, 'refs/heads/main')
        return
    }
    assert.equal(release.schema, 2, 'Unsupported retained schema; recover original bytes')
    assert.equal(release.runId, runId)
    assert.equal(release.runAttempt, attempt)
    assert.equal(release.gitTag, `v${version}`)
    assert.ok(release.notes?.startsWith('[Posted by Jarvis]\n\n'))
}

export function validateInitialPack(version, sourceRef, lastTag, event) {
    assert.equal(event, 'workflow_dispatch', 'Initial scope pack must be explicitly dispatched')
    assert.equal(sourceRef, 'refs/heads/main')
    assert.equal(lastTag, 'v2.2.4', 'Initial pack must follow the reviewed legacy baseline')
    assert.equal(version, '2.2.5', 'Initial pack must match the approved first version')
}

export function sourceRun(runId, attempt) {
    assert.match(runId, /^[1-9][0-9]*$/)
    assert.match(attempt, /^[1-9][0-9]*$/)
    const run = api(`actions/runs/${runId}/attempts/${attempt}`)
    assert.equal(String(run.id), runId)
    assert.equal(String(run.run_attempt), attempt)
    const source = validateSourceRun(run, api('actions/workflows/pack.yml').id, (base, head) =>
        api(`compare/${base}...${head}`),
    )
    // Trust historical identity and ancestry, never byte equality with today's workflow.
    const historical = api(`contents/${workflowPath}?ref=${source.sha}`)
    assert.equal(historical.path, workflowPath)
    assert.ok(historical.sha, 'Historical workflow must remain accessible')
    return source
}

export function checkPackSource() {
    assert.equal(process.env.GITHUB_REPOSITORY?.toLowerCase(), repository)
    assert.ok(['workflow_dispatch', 'push'].includes(process.env.GITHUB_EVENT_NAME))
    assert.ok(['refs/heads/main', 'refs/heads/next'].includes(process.env.GITHUB_REF))
    const sha = process.env.GITHUB_SHA
    assert.match(sha, /^[a-f0-9]{40}$/)
    const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
    assert.equal(git('rev-parse', 'HEAD'), sha)
    const branch = process.env.GITHUB_REF.slice('refs/heads/'.length)
    assert.equal(
        api(`commits/${branch}`).sha,
        sha,
        'Pack only current release-branch source; recover older releases from their original artifact',
    )
    const mainBase = git('merge-base', 'origin/main', sha)
    const release = { schema: 2, mainBase, sourceSha: sha }
    validateMainBase(release, (base, head) => api(`compare/${base}...${head}`))
    return { sha, ref: process.env.GITHUB_REF, mainBase }
}
