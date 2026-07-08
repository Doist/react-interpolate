/**
 * @type {import('semantic-release').GlobalConfig}
 */

const prereleaseBranches = [{ name: 'next', prerelease: true }]

const isPrerelease = prereleaseBranches.some((b) => b.name === process.env.GITHUB_REF_NAME)

// The package is published to npm and, additionally, to the GitHub Package
// Registry. The npm publish is handled by @semantic-release/npm using OIDC
// trusted publishing; the GitHub Packages publish is a plain `npm publish`
// against npm.pkg.github.com, authenticated with the workflow token.
const publishToGithubPackages = [
    '@semantic-release/exec',
    {
        publishCmd:
            'npm publish --provenance=false --registry=https://npm.pkg.github.com --//npm.pkg.github.com/:_authToken=$GITHUB_PACKAGES_TOKEN',
    },
]

module.exports = {
    branches: ['main', ...prereleaseBranches],
    plugins: [
        ['@semantic-release/commit-analyzer', { preset: 'conventionalcommits' }],
        ['@semantic-release/release-notes-generator', { preset: 'conventionalcommits' }],
        // Only update CHANGELOG.md and commit back on stable releases
        ...(isPrerelease ? [] : ['@semantic-release/changelog']),
        '@semantic-release/npm',
        publishToGithubPackages,
        ...(isPrerelease
            ? []
            : [
                  [
                      '@semantic-release/git',
                      {
                          assets: ['CHANGELOG.md', 'package.json', 'package-lock.json'],
                          // eslint-disable-next-line no-template-curly-in-string
                          message:
                              'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
                      },
                  ],
              ]),
        '@semantic-release/github',
    ],
}
