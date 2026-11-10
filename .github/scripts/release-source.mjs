import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

export const repository = 'todoist/react-interpolate'
export const workflowPath = '.github/workflows/pack.yml'
export const api = (path) =>
    JSON.parse(execFileSync('gh', ['api', `repos/${repository}/${path}`], { encoding: 'utf8' }))

export function validateSourceRun(run, workflowId, compare) {
    assert.equal(run.repository.full_name.toLowerCase(), repository)
    assert.equal(run.head_repository.full_name.toLowerCase(), repository)
    assert.equal(run.workflow_id, workflowId)
    assert.equal(run.path, workflowPath)
    assert.equal(run.event, 'workflow_dispatch')
    assert.equal(run.status, 'completed')
    assert.equal(run.conclusion, 'success')
    assert.equal(run.head_branch, 'main')
    assert.match(run.head_sha, /^[a-f0-9]{40}$/)
    assert.ok(
        ['ahead', 'identical'].includes(compare(run.head_sha, 'main').status),
        'Source must be in reviewed main history',
    )
    // Historical run identity and main ancestry establish trust. Workflow maintenance
    // on current main must not invalidate an original artifact (schema checked separately).
    return { sha: run.head_sha, ref: 'refs/heads/main' }
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
    // Fetch the historical workflow itself, without comparing it to today's bytes.
    const historical = api(`contents/${workflowPath}?ref=${source.sha}`)
    assert.equal(historical.path, workflowPath)
    assert.ok(historical.sha, 'Historical workflow must remain accessible')
    return source
}

export function checkPackSource() {
    assert.equal(process.env.GITHUB_REPOSITORY?.toLowerCase(), repository)
    assert.equal(process.env.GITHUB_EVENT_NAME, 'workflow_dispatch')
    assert.equal(process.env.GITHUB_REF, 'refs/heads/main')
    const sha = process.env.GITHUB_SHA
    assert.match(sha, /^[a-f0-9]{40}$/)
    assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sha)
    assert.equal(
        api('commits/main').sha,
        sha,
        'Pack only the current reviewed main; recover older releases from their original artifact',
    )
    return sha
}
