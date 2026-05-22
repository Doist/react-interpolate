/**
 * @type {import('semantic-release').GlobalConfig}
 */
export default {
  // `next` remains a staging branch and is promoted to `main` when it is ready to release.
  branches: ["main"],
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "conventionalcommits",
      },
    ],
    [
      "@semantic-release/release-notes-generator",
      {
        preset: "conventionalcommits",
      },
    ],
    "@semantic-release/changelog",
    "@semantic-release/npm",
    "@semantic-release/git",
    "@semantic-release/github",
    [
      "@semantic-release/exec",
      {
        verifyConditionsCmd:
          'if [ -n "$GITHUB_OUTPUT" ]; then echo "package-published=false" >> "$GITHUB_OUTPUT"; fi',
        successCmd:
          'if [ -n "$GITHUB_OUTPUT" ]; then echo "package-published=true" >> "$GITHUB_OUTPUT"; fi',
      },
    ],
  ],
};
