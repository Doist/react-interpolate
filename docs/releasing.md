# Releasing @todoist/react-interpolate

Preparation status: **WAITING_FOR_PUBLICATION**, with an additional **RELEASE_POLICY_REVIEW** merge gate. This branch deliberately retains the original lockfile until the new tooling exists. It must not merge with that stale lock. No migration artifact has been built or published. Runtime source, default/named exports, distribution filenames, React >=17.0.2 peers and package Node/npm engines are unchanged.

## Version and release policy

**Unresolved fresh-review finding (P2):** this draft proposes permanent manual stable-only release operations and removes automatic version/changelog commitback. The first-release hold is required, but those steady-state policy changes are not implied by package migration. Before merge, the maintainer must either explicitly accept these changes or have normal automatic `main`/`next` release modes and generated records restored across the retained-artifact boundary. This is an unresolved source/policy gate, separate from external publication and authentication prerequisites. Do not treat this draft as merge-ready.

The original source and npm latest are 2.2.4. Existing tags are `v<version>`, independent of scope, so there is no scoped-tag baseline reset. The intended first release is 2.2.5. Land the migration with a `fix:` Conventional Commit; intervening features/breaking changes require reconciling the target. `pack-release.mjs` asks semantic-release 25 (the existing Conventional Commits analyzer and notes generator) for a **dry-run** result and requires it to match the reviewed input. No release is fabricated for a non-releasable commit batch.

The old push-triggered publisher is replaced by explicit pack/publish operations. A merge or branch push no longer publishes, tags, edits the changelog, or creates a GitHub release. The source manifest remains the existing 2.2.4 baseline; packing updates the version only in its ephemeral checkout. Published versions and the next calculation follow the normal `v<version>` records. After both registries match, `record` creates that tag at the **original build commit** and attributed GitHub release notes, preserving existing records. It does not commit generated version/changelog changes back to protected main. GitHub's release `latest` flag is left unchanged to avoid an older recovery changing it.

This migration enables stable `main` only. Automatic `next` publication is held: the old `next` semantic analysis configuration remains, but restoring prerelease publication requires an independently reviewed retained-artifact path and its branch/channel trust policy. Do not run the old publisher to bypass this hold.

## Finish the actual dependency gate before merge

Required public tooling: `@todoist/prettier-config@4.0.2`, `@todoist/eslint-config@13.1.2`, and its transitive `@todoist/eslint-plugin-doist@2.0.2`. All must exist in npm and GitHub Packages. Config 13 exposes `/eslintrc/react` and needs Node >=24.10 for development; formatter 4 uses Prettier 3. The necessary lint peers are updated; the default React import restriction is disabled to retain this library's existing React usage. Package consumers keep the existing Node/React support.

On Node 24.20.0 with npm 11.21.2, after real publication:

```sh
npm install --package-lock-only --ignore-scripts --legacy-peer-deps --no-audit --no-fund
npm ci --ignore-scripts --legacy-peer-deps --no-audit --no-fund
npm run lint
npm test -- --runInBand
npm run build
npm run test:release
```

Review actual resolutions/integrities and peer warnings; commit the regenerated lock. Existing legacy-peer resolution is retained for this older Rollup/Babel graph. Run PR health on all supported Node majors (20/22/24/26); lint uses 24 because the development config has a newer floor. No aliases, local tarball paths, invented integrity values or rewritten old-scope URLs are a production solution.

## Setup owners and exact identities

Henning routes these steps to the already assigned npm/GitHub package administrators; their assignment source is not in this repository.

- Both current npm and GitHub package visibility are independently **public**. Preserve both. GitHub's current mirror is linked to `Doist/react-interpolate`; inspect its transfer and new-scope collision state after rename. The helper requires that existing transferred mirror to be readable and public. A missing direct package response is ambiguous (it can hide unauthorized packages) and blocks even npm bootstrap until the administrator verifies transfer/access. A successful upload alone does not satisfy this gate.
- Repository: `todoist/react-interpolate`. Workflows/callers: `.github/workflows/pack.yml` and `.github/workflows/publish.yml` (direct, no reusable caller). Publisher environment: `package-release`; GitHub-hosted `ubuntu-latest`; Node 24.20.0; npm 11.21.2.
- Protect `package-release` with the existing release approvers and only `main`. Review [environment settings](https://github.com/todoist/react-interpolate/settings/environments), [Actions permissions](https://github.com/todoist/react-interpolate/settings/actions), and [rulesets](https://github.com/todoist/react-interpolate/settings/rules). Normal release tag creation must be allowed through existing policy; do not bypass protections. The pack token needs contents write only because semantic-release dry-run validates push permission; pack code does not write to GitHub.
- The publisher's workflow token needs contents write for the optional release record, actions read, packages write and id-token write. It also needs read access to the existing mirror. Cross-repository consumers need explicit package Read grants.
- Inspect [GitHub package settings](https://github.com/orgs/todoist/packages/npm/react-interpolate/settings), repository linkage, public visibility, inheritance and Manage Actions access. Also verify local authenticated installation independently.
- First npm publication must be interactive using the real artifact. Only **after the package exists**, configure [npm package Settings → Trusted publishing](https://www.npmjs.com/package/@todoist/react-interpolate/access): GitHub owner `todoist`, repo `react-interpolate`, workflow filename `publish.yml`, environment `package-release`; enable direct npm publish. Configure close to the next real release; a new unused connection expires. [npm requirements](https://docs.npmjs.com/trusted-publishers/).
- `GH_TOKEN` is for GitHub API/artifact access. `GH_PACKAGES_TOKEN` is separately supplied for GitHub registry reads/writes (local classic PAT with read:packages; write:packages only for a local mirror write; Actions uses its repository token). No GitHub credential or inherited npm token is passed to the isolated npmjs process. Bootstrap login and publish both inherit terminal IO for 2FA. No global npmrc changes.
- Cross-run npm provenance is disabled explicitly: the publisher checkout can differ from the build. Claiming the publisher's SHA as the build would be inaccurate. [GitHub authentication](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry).

## Future operator commands — do not run during preparation

First complete rename, actual tooling publication, lock/install verification and review/merge. The following commands are **real** operations for the separately authorized cutover.

1. From current reviewed main, produce one artifact (no publication/tag/release):

```sh
gh workflow run pack.yml --repo todoist/react-interpolate --ref main -f version=2.2.5
```

Record the successful run ID and attempt from Actions. Artifact name is `react-interpolate-2.2.5-RUN_ID-ATTEMPT`; files are `todoist-react-interpolate-2.2.5.tgz`, schema-1 `release.json` (SHA-512 integrity, SHA-1, original source SHA/ref, run/attempt, version and notes), and `release-notes.md`. Retention is 90 days; archive those exact files/checksums securely. Never rerun pack for a partially published version. The pack command refuses a same-version copy already in either registry.

2. With `GH_TOKEN` and `GH_PACKAGES_TOKEN` supplied through the established secret flow, in an interactive terminal and a reviewed checkout containing the helper:

```sh
node .github/scripts/release.mjs verify RUN_ID ATTEMPT 2.2.5
node .github/scripts/release.mjs bootstrap RUN_ID ATTEMPT 2.2.5 npm latest
```

Replace RUN_ID/ATTEMPT with the recorded numbers. Both commands fetch the exact original run artifact themselves. The helper validates the run's repository, workflow ID/path, event, branch, success, attempt and main ancestry; checkout SHA must equal event SHA. It verifies schema, manifest/exports/peers and tarball digests. Publication rechecks both registry copies immediately before the write, including after login. Mismatch, authentication failure or transport ambiguity stops. The effective publish is `npm publish ORIGINAL.tgz --ignore-scripts --tag=latest --registry=https://registry.npmjs.org/ --access=public --provenance=false` from isolated scope/user/global config, with terminal IO.

3. Publish the missing GitHub mirror from the same run (no version calculation or build):

```sh
gh workflow run publish.yml --repo todoist/react-interpolate --ref main \
  -f source_run_id=RUN_ID -f source_attempt=ATTEMPT -f version=2.2.5 \
  -f destination=github -f dist_tag=latest -f record_release=false
```

Verify GitHub visibility is public and the two tarball integrities match. If the transferred mirror is missing, unreadable or private, its administrator resolves transfer/access/public visibility before any registry write. Verify actual installs in npm and authenticated GitHub consumer environments. Then establish the normal next-version baseline, using the original run:

```sh
node .github/scripts/release.mjs record RUN_ID ATTEMPT 2.2.5
```

The record uses `v2.2.5` at the original source SHA, with `[Posted by Jarvis]` notes and retained tarball/metadata attached. It never moves an existing tag or edits user-owned release descriptions. Following releases calculate from this tag; a later `fix:` selects 2.2.6, `feat:` 2.3.0, and a breaking change 3.0.0. Record before authorizing the next pack.

4. Future OIDC releases use the same pack workflow, then `publish.yml` with `destination=both` and `record_release=true`. For partial failure retry only the missing destination with the **original** run/attempt/version. Publication does not need npm install or semantic-release.

If a missing older copy would move `latest` backwards, retry with `dist_tag=recovery` (or terminal bootstrap's final argument `recovery`). Do not promote it to `latest`. The npm/GitHub package administrator owns cleanup of that temporary recovery tag after verification; any future tag-mutation tooling must perform the same two-registry integrity checks before each write. This helper deliberately performs no dist-tag-only writes.

Later reviewed workflow/script maintenance does not invalidate the original artifact: trust uses historical workflow/run identity, supported schema and reviewed main ancestry, not equality with today's workflow bytes. An expired/unavailable artifact or unsupported schema stops with **original-artifact/manual recovery**: retrieve the securely archived exact files or already-attached release assets, have the release owner validate the historical run and schema, and extend/review the recovery reader if needed. Never repack an immutable version.
