/**
 * Semantic-release remains the version/notes authority. Publication and release
 * records consume a retained artifact separately; even a direct invocation is read-only.
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
