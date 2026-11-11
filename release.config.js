/**
 * Semantic-release remains the version/notes authority. Publication and release
 * records consume a retained artifact separately; even a direct invocation is read-only.
 * pack-release prepares the existing stable changelog/version outputs. record-release
 * commits those only after both registries pass, tags v${version}, and restores the
 * semantic-release Git channel note. next keeps its original no-commitback policy.
 */
module.exports = {
    branches: ['main', { name: 'next', prerelease: true }],
    tagFormat: 'v${version}',
    dryRun: true,
    plugins: [
        ['@semantic-release/commit-analyzer', { preset: 'conventionalcommits' }],
        ['@semantic-release/release-notes-generator', { preset: 'conventionalcommits' }],
    ],
}
