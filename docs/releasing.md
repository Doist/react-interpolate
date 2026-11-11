# Releasing @todoist/react-interpolate

The tooling publication gate is cleared and the lockfile is regenerated from real registry packages. Runtime source, exports, React peers and package engines are unchanged. The existing `@babel/runtime@7.18.6` is now a runtime dependency because all built formats import its helpers; fresh packaged consumers verify this without development dependencies. No publishable 2.2.5 artifact or registry publication has been produced during preparation.

## Existing release policy, with a controlled publication boundary

`main` and `next` pushes run `.github/workflows/pack.yml`. It uses the existing semantic-release 25 Conventional Commit analyzer/notes generator, branches `main` and `{ name: 'next', prerelease: true }`, and `v${version}` tags. `fix`/`feat`/breaking changes retain patch/minor/major behavior; non-releasable batches produce no artifact. `next` retains `next.N` versions and the `next` channel. Existing old-scope tags are analysis history only; the unchanged tag format does not reset the baseline.

The intended first new-scope stable release is **2.2.5**, from source/npm latest2.2.4. A manual pack can assert `version=2.2.5`; actual analysis must match. Push-triggered packing uses the calculated version. Intervening features/breaking changes require reconciling the target.

Packing only prepares the artifact and generated release files. For stable releases it runs the existing `@semantic-release/changelog` preparation and updates package.json/package-lock.json in the ephemeral checkout; for prereleases it updates the ephemeral package version without changelog or source commitback. Publication, tags, Git notes, commitback and GitHub release creation remain behind explicit maintainer dispatch of `.github/workflows/publish.yml` and its protected `package-release` environment. New npm trust is never assumed at merge time.

After **both exact-version registry copies match** the retained tarball, `record_release=true` restores the normal records:

- Stable: commit only the retained `CHANGELOG.md`, `package.json`, and `package-lock.json`, with the normal `chore(release): <version> [skip ci]` message and notes; tag that generated commit.
- Prerelease: tag the original `next` source commit; no version/changelog commitback to `next`.
- Both: write the existing semantic-release per-version Git note, `{"channels":[null]}` for stable or `{"channels":["next"]}` for next. These notes are required for normal subsequent prerelease calculation. Tags remain `v<version>`.
- Complete attributed GitHub release notes and required retained assets. Prereleases remain prereleases and never become GitHub latest; older stable recovery also cannot replace a newer GitHub latest. Existing user-edited release bodies are preserved.

The source version/changelog record is generated from the original build source, never recalculated at retry time. A later main change is preserved by a three-way merge of the generated metadata commit, followed by a non-forced atomic push of the required branch/tag/note refs. A real metadata conflict or branch-protection failure stops before push and requires original-byte/manual record recovery; it never asks for a rebuild. Already-completed records are verified and skipped. No historical tag is moved, deleted or recreated.

The initial draft's stable-only/manual release-policy retirement is removed. Steady-state `main`/`next` calculation, stable generated commitback, normal tags/channel notes and prerelease semantics are restored; only the actual publication/record boundary remains explicitly gated as required for migration.

## Validate the real dependency graph

Published tooling in both registries (npm public; GitHub config private and formatter/plugin public, per their approved visibility): `@todoist/prettier-config@4.0.2`, `@todoist/eslint-config@13.1.2` and transitive `@todoist/eslint-plugin-doist@2.0.2`. Config13 uses `/eslintrc/react` and Node>=24.10 for development; formatter4 uses Prettier3. Updated lint peers preserve this library's existing React usage. Consumer Node/React engines remain unchanged.

Use Node24.20.0/npm11.21.2 for the genuine lock and consumer checks:

```sh
npm install --package-lock-only --ignore-scripts --legacy-peer-deps --no-audit --no-fund
npm ci --ignore-scripts --legacy-peer-deps --no-audit --no-fund
npm run lint
npm test -- --runInBand
npm run build
npm run test:package
npm run test:release
node .github/scripts/semantic-policy-check.mjs
```

Review real resolutions/integrities and peer warnings, commit the resulting lock, and run PR health across Node20/22/24/26. The original lint/test/build matrix is retained on all four majors; tooling engine/compatibility warnings must be resolved or explicitly evidenced with the real installed graph. Node24.20 is the supported developer/release tooling runtime. The older Rollup/Babel graph retains its existing legacy-peer install policy. No production aliases, local tarball dependencies or fabricated lock integrity are allowed.

## Setup and exact identities

Henning routes these steps to the existing assigned npm/GitHub administrators; their D06 assignment source is not in this repository.

- The intended `@todoist/react-interpolate` package is **public in both registries**. For an existing GitHub mirror, require direct readable REST metadata, correct repository/public visibility and valid registry dist-tags before treating exact-version404 as absence. For the first mirror only, the same `GH_PACKAGES_TOKEN` must have explicit package-read scope, receive an exact-package404, and prove active `admin` membership in `todoist`; registry authentication and package404 must agree. Ordinary repository tokens, filtered inventories and whoami alone cannot prove absence. These checks repeat before every public registry write, including npm bootstrap. An authenticated owner verified the new GitHub package was absent on November 11; that observation never substitutes for the live pre-write gate.
- Workflows/callers: direct `.github/workflows/pack.yml` and `.github/workflows/publish.yml`; no reusable caller. Publisher dispatch runs from `main`, even when processing a retained `next` artifact. Environment `package-release`, GitHub-hosted `ubuntu-latest`, Node24.20.0, npm11.21.2. Both workflows share `react-interpolate-release` concurrency; no cancellation mid-release.
- Protect [package-release](https://github.com/todoist/react-interpolate/settings/environments) with existing approvers and the `main` publisher ref. Review [Actions permissions](https://github.com/todoist/react-interpolate/settings/actions) and [rulesets](https://github.com/todoist/react-interpolate/settings/rules). Pack has contents:write solely for semantic-release dry-run's push-permission check and packages:read. It makes no GitHub record or registry write.
- Publisher token: contents:write, actions:read, packages:write and id-token:write. The existing `DOIST_RELEASE_BOT_ID` / `DOIST_RELEASE_BOT_PRIVATE_KEY` app is used **only when recording** for its normal commitback/tag/release rights and bot attribution. Existing branch/signature policy and app access must allow the original release mechanism; never bypass protections ad hoc. No secret identity is renamed.
- `GH_TOKEN` reads source runs/artifacts. `GH_PACKAGES_TOKEN` authenticates GitHub registry preflight/writes (first mirror: active owner classic PAT with read:packages plus readable organization membership; write:packages for its local publication). `GH_RECORD_TOKEN` is the existing release app token for Git/record writes. None is passed to isolated npmjs subprocesses. No global npmrc changes.
- Inspect [GitHub package settings](https://github.com/orgs/todoist/packages/npm/react-interpolate/settings), repository linkage/public visibility/inheritance and required Manage Actions access grants. Verify real local and cross-repo consumer installation separately.
- First npm publication is interactive, from the original artifact. Only after the package exists, configure [npm Settings → Trusted publishing](https://www.npmjs.com/package/@todoist/react-interpolate/access): owner `todoist`, repo `react-interpolate`, workflow filename `publish.yml`, environment `package-release`, direct npm publish enabled. Configure near the next real release; no extra release to test trust. [npm requirements](https://docs.npmjs.com/trusted-publishers/).
- npm11.21.2 performs the OIDC token exchange before checking publication credentials, independently of `--provenance=false`; disabling provenance does not disable authentication. This was checked against its installed helper with mocked requests, not a live publication. Cross-run npm provenance is explicitly disabled: the publisher checkout may differ from the original build. Login and actual npm publish both inherit terminal IO for 2FA. [GitHub authentication](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry).

## Future operator commands — not executed during preparation

Complete review/merge and verify publisher access first; the organization rename and required tooling publications are complete. Merging to main prepares an artifact; it does **not** publish or record a release. Propagate the migration through the normal forward main/next flow before preparing next artifacts; source must descend from the recorded current-forward base3904771.

The first new-scope artifact is explicitly dispatched with `initial_scope=true`. This exception is limited to main, the v2.2.4 legacy baseline and approved 2.2.5; it permits an authenticated GitHub package404 for artifact preparation only. It grants no publication authority. Once the mirror exists, normal main/next packing requires readable package metadata and never uses this exception. Before the initial mirror exists, an automatic main pack stops at that access gate.

```sh
gh workflow run pack.yml --repo todoist/react-interpolate --ref main -f version=2.2.5 -f initial_scope=true
```

Record the successful RUN_ID/ATTEMPT and calculated version. Artifact `react-interpolate-2.2.5-RUN_ID-ATTEMPT` contains `todoist-react-interpolate-2.2.5.tgz`, schema2 release.json, release-notes.md, and stable-only `record-CHANGELOG.md`, `record-package.json`, `record-package-lock.json`. Metadata binds original source SHA/ref/main base/run/attempt/channel, tarball integrity and generated-file hashes. Retain all exact bytes/checksums securely beyond Actions'90-day retention. Do not rerun pack after either registry accepted that version.

With GH_TOKEN and GH_PACKAGES_TOKEN provided through the established secret flow, in a terminal:

```sh
node .github/scripts/release.mjs verify RUN_ID ATTEMPT 2.2.5
node .github/scripts/release.mjs bootstrap RUN_ID ATTEMPT 2.2.5 npm latest
```

The helper fetches the exact original run artifact itself. It validates successful correct repo/head repo/workflowID/path/event/branch/run attempt, checkout=eventSHA, retained main base and main/next history, supported schema, packed manifest/exports/peers and checksums. The exact artifact ID/run/head/ref and API archive SHA-256 are checked before safe ZIP extraction; each local entry is bound to those original bytes. Later failed/skipped run attempts do not invalidate the original successful attempts/N evidence. Both registry copies are checked again immediately before the write, including after interactive login. The effective npm write uses the retained tarball, `--ignore-scripts`, explicit registry/scope config, public access and `--provenance=false`. There is no rebuild or second semantic version calculation.

For the first GitHub mirror, use the same original run locally with the verified owner token; a normal workflow token cannot establish first-package absence:

```sh
node .github/scripts/release.mjs publish RUN_ID ATTEMPT 2.2.5 github latest
```

Verify the new package is public and linked to this repository, with intended workflow/consumer access. If GitHub applies a private default, an authorized administrator must correct only this new package before the record gate can pass. No republish/repack is needed. Then verify both copies and perform normal commitback/records through the existing release bot:

```sh
gh workflow run publish.yml --repo todoist/react-interpolate --ref main \
  -f source_run_id=RUN_ID -f source_attempt=ATTEMPT -f version=2.2.5 \
  -f destination=both -f dist_tag=channel -f record_release=true
```

If separating mirror verification and records, first use `record_release=false`, verify actual public/authenticated consumer installs, then repeat the same original run with `destination=both` and `record_release=true`. Matching registry copies are skipped. The workflow supplies the existing release bot identity for commitback; terminal bootstrap does not need or use that writer token.

Normal future stable/prerelease preparation is automatic on releasable main/next pushes. Explicit dispatch is also available:

```sh
gh workflow run pack.yml --repo todoist/react-interpolate --ref next -f version=2.3.0-next.1
gh workflow run publish.yml --repo todoist/react-interpolate --ref main \
  -f source_run_id=NEXT_RUN_ID -f source_attempt=ATTEMPT -f version=2.3.0-next.1 \
  -f destination=both -f dist_tag=channel -f record_release=true
```

The prerelease number above is an example: use the actual calculated/approved version, never reserve it. `dist_tag=channel` derives latest/next from validated version/source metadata. A prerelease cannot use latest, even via the local CLI. A subsequent fix after a correctly recorded next.1 calculates next.2; a normal stable promotion calculates a new stable version/artifact from main, never retags the prerelease tarball as latest.

For a missing older mirror, select the actual missing destination and the original run/version:

```sh
gh workflow run publish.yml --repo todoist/react-interpolate --ref main \
  -f source_run_id=ORIGINAL_RUN_ID -f source_attempt=ORIGINAL_ATTEMPT -f version=ORIGINAL_VERSION \
  -f destination=github -f dist_tag=recovery -f record_release=true
```

The latest **and next** channels each have downgrade guards. Recovery uses only the temporary recovery tag and never promotes either channel. Administrators own eventual recovery-tag cleanup with the same two-registry prewrite integrity checks; this helper does no standalone dist-tag mutations.

## Durable publication and release-record retries

Historical workflow/run identity and supported metadata establish trust; current workflow bytes need not equal the old workflow. Schema1 stable artifacts remain publishable by the original run after maintenance; they lack prepared commitback payloads, so recording them stops with original-byte/manual record guidance. Schema2 supports normal retained stable and next records.

C07: a matching tag alone is not completion. Before producing another artifact, a new-scope last-release tag must have a completed published record, validated original assets/source/tag/generated files/channel note, and both completed matching registries. A half-uploaded draft cannot advance the semantic baseline. Old-scope tags reachable from the original base remain analysis history without attempting historical mirror repairs. Validate exact tag target, semantic channel note, draft/published/prerelease state and every required original release asset. A matching interrupted draft resumes only missing uploads, verifies all asset bytes, then publishes. Conflicting/upload-incomplete assets or a published release missing assets stop with precise original-byte recovery; never overwrite assets or delete/recreate a historical release. Existing descriptions remain untouched.

If source metadata now conflicts, branch permissions reject the atomic push, an artifact expires, or schema support is missing, retain/retrieve the securely archived original bytes (or verified completed release assets) and resolve that specific record/access/reader issue. Original schema2 files are attached to the completed release. Do not repack an immutable already-published version, rerun semantic-release to bump again, or change the source/tag to hide a partial failure.
