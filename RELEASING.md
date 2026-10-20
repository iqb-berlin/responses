# Release checks

Both implementations are developed on `master`. Package versions and release
decisions are independent: an npm release does not promote the .NET preview.
The stable npm behavior is the JavaScript compatibility reference. Limitations
of the .NET preview must not narrow that behavior.

## Stable JavaScript package

Validate the exact commit intended for the release:

1. Run `npm ci`, `npm run lint`, `npm run test:coverage` and
   `npm run test:toolchain` on the Node 22/24 development matrix.
   Babel 8 is isolated in the private tooling workspace; Jest's Babel 7 helpers
   retain their own compatible dependency graph. The IQB lint policy uses its
   local typescript-eslint 8/Stylistic adapter and explicit peer overrides.
2. Run `npm run prepare_publish` and `npm run test:package`. The latter installs
   the produced tarball in an independent consumer, checks public exports and
   TypeScript resolution, and exercises partial credit and the regex behavior
   retained from 5.4.0. VariableInfo checks compile actual published 1.3/1.4/2.1
   declarations against the candidate in classic Node, NodeNext ESM/CommonJS and
   bundler modes, including previous public API assignments and mutable legacy lists.
   Both the build compiler (5.9.3) and the previous consumer compiler (5.4.5)
   must pass. The separate Node 18/20 jobs download the built artifact and run
   `node scripts/verify-package.js --runtime-only` without installing the newer
   development toolchain. Keep these package-runtime checks when changing the
   development Node requirements.
3. Confirm both package manifests agree on the version and runtime dependencies,
   and check the consuming application's affected flows before publication.
4. Require successful CI on that commit. After publication, verify the registry
   version, dist-tag, and actual package artifact separately from the GitHub
   release and its tag.

Keep the published 5.4.0 tag as the historical release reference. Once the
compatibility restoration is merged, subsequent JavaScript releases can be
prepared from `master`; ongoing backports onto `release/responses-5.4.0` are
unnecessary.

### Studio and Kodierbox qualification

The `Consumer qualification` workflow installs the candidate npm tarball into
fresh Studio and Kodierbox checkouts. Review its pinned host commits before each
release. Each host runs its frontend and backend checks sequentially on Node 22:

The pinned Studio baseline has two missing optional peer dependencies in its
lockfile, so its original `npm ci` fails before Responses is changed. The explicit
`studio-optional-peers.patch` adds only those two development entries before
both baseline and candidate checks; all previously locked versions are retained.
Its exact diff is included in the qualification artifact. This temporary baseline
repair must be reconsidered when updating the pinned Studio commit.

- Build the unchanged frontend as the bundle-size reference.
- Install the exact candidate and exercise CommonJS plus bundled browser ESM:
  coding, native JavaScript regex features, full SOLVER functions, VariableInfo
  normalization, chemistry labels and the floating-point type text. Also check
  minimal 2.1 data, optional value labels, mixed legacy/current lists, legacy
  page/anchor retention and NO_VALUE validation without rewriting payloads.
- Run affected coding/Codebook tests, build the frontend and backend, and verify
  that any Responses JavaScript in the real frontend uses ESM entrypoints.
  A host that does not include Responses at runtime is reported explicitly;
  the separate browser harness still verifies its ESM consumer behavior.
- Start the built backend against disposable PostgreSQL and Redis services.
  Only this smoke test synchronizes entity schemas into its isolated database.
  It checks application startup, not production migrations or deployed data.

The `qualification-*` artifacts record the installed version, behavior checks,
raw emitted JavaScript size before/after, backend HTTP availability and startup
logs. These checks do not publish npm, NuGet, a GitHub release, or either host.

## .NET preview and stable qualification

The `dotnet-test` and `dotnet-package` CI jobs remain required checks for changes
affecting .NET. They build and test the solution, enforce the existing coverage
thresholds, compare golden and generated shared-feature cases, and consume the
packed NuGet artifact without a project reference.

Boundary cases outside the preview's supported features must assert exact
results for each runtime, including validation problems, response status and
error diagnostics. A known difference is not permission to ignore additional
changes. The shared-feature tests alone do not establish full parity.

Before promoting .NET to a stable package, run
`npm run test:differential:stress`, verify all required coding-scheme features
against representative consumer schemes, and resolve any remaining differences
required by that contract. Explicitly document and version any accepted
limitations. Require a separate .NET release decision and verify the published
NuGet artifact independently of npm.
