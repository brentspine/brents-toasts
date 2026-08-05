# Supply Chain Risk Report — `brents-toasts`

Assessed against the risk taxonomy in [Socket.dev's Supply Chain Risk documentation](https://docs.socket.dev/docs/supply-chain-risk), 2026-08-05.

## Scope and method

This is a manual audit, not a Socket.dev scan (no `socket` CLI/API access was used). It covers:

- **The published package itself** — `src/` (the code that ships to consumers) and `package.json`'s `files`/`exports` (`dist` + `man` only, per `.npmignore`).
- **The build/test toolchain** — the 9 direct `devDependencies` and their 185 total resolved packages (`package-lock.json`), none of which ship to consumers.
- **CI** — `.github/workflows/*.yml`.

`demo/` is a separate Angular workspace with its own `package.json` and is excluded from the published npm package entirely, so its dependencies (Angular, RxJS, monaco-editor, etc.) don't reach `brents-toasts` consumers — it's noted below only where relevant to repo-level CI risk, not package risk.

Conditions that require Socket's own AI classifiers or per-package npm-registry metadata (author account age/history, per-package first-publish timestamps) aren't reproducible locally and are marked **Not assessable**.

## Summary

The published library is genuinely zero-dependency and its own source has none of the sensitive-capability patterns (`eval`, dynamic `require`, filesystem/network/shell access, env var reads) Socket flags. The one real finding is **native code in the dev toolchain** (expected, first-party, doesn't ship) and a **minor CI hardening gap** (GitHub Actions pinned by mutable tag, not SHA). No install scripts, no non-registry (git/GitHub/HTTP) dependencies, no shrinkwrap file, and `npm audit` reports 0 known vulnerabilities across all 185 resolved packages.

## Critical severity

| Condition | Status | Notes |
|---|---|---|
| Typosquat Attack | ❌ False | All 9 direct devDependency names (`rollup`, `typescript`, `vitest`, `jsdom`, `tslib`, `@rollup/plugin-terser`, `@rollup/plugin-typescript`, `rollup-plugin-dts`, `@vitest/coverage-v8`) are well-known, correctly-spelled packages from their canonical maintainers. |
| Known Malware | ❌ False | `npm audit` (npm's advisory database) reports 0 vulnerabilities across all 185 resolved packages. |

## High severity

| Condition | Status | Notes |
|---|---|---|
| AI-Detected Malware | ⚪ Not assessable | Requires Socket's classifier; not reproducible locally. |
| GitHub Dependency | ❌ False | Every entry in `package-lock.json` resolves to `registry.npmjs.org`; no `github:`/`git+` resolutions. |
| Git Dependency | ❌ False | Same check as above — no remote git URL dependencies. |
| AI-Detected Security Risk | ⚪ Not assessable | Requires Socket's classifier. |
| Install Scripts | ❌ False | Checked every `package.json` under `node_modules` for `install`/`preinstall`/`postinstall` scripts — none found in any of the 185 packages. |
| Non-Existent Author | ⚪ Not assessable | Would require querying npm registry metadata per-package for account status. |
| Obfuscated Code | ❌ False (own code) / ⚪ Not fully assessable (deps) | `src/` is plain, readable TypeScript. A byte-level entropy/packing scan of all transitive `node_modules` files wasn't performed — that's what Socket's actual scanner is for. |
| NPM Shrinkwrap | ❌ False | Only `package-lock.json` present; no `npm-shrinkwrap.json` anywhere in the repo. |
| Telemetry | ❌ False (own code) | `src/` makes no network calls of any kind (see Network Access below). The toolchain (rollup/vitest/typescript) has no known telemetry collection. |
| Protestware | ❌ False | No joke/parody code or undocumented hidden behavior in `src/`. |
| Unstable Ownership | ⚪ Not assessable | Requires per-package npm registry publish-history metadata. |
| HTTP Dependency | ❌ False | No `http:`/`https:` URL dependency specs in `package-lock.json`. |

## Medium severity

| Condition | Status | Notes |
|---|---|---|
| Potential Vulnerability | ❌ False | Nothing flagged by `npm audit`; Socket's own human-reviewed heuristic queue isn't reproducible locally. |
| AI-Detected Anomaly | ⚪ Not assessable | Requires Socket's classifier. |
| Native Code | ✅ **True** (dev toolchain only) | `.node` binaries present: `@rolldown/binding-win32-x64-msvc`, `@rollup/rollup-win32-x64-{gnu,msvc}`, `lightningcss-win32-x64-msvc` — platform-specific prebuilt bindings pulled in transitively by Rollup/Vitest for performance. All are first-party packages from the Rollup/Vite maintainers, dev-only, and excluded from the published package (`files: ["dist", "man"]`). Low practical risk, but worth knowing they exist if a stricter policy (e.g. "no native code anywhere in the tree") is ever adopted. |
| Manifest Confusion | ❌ False | `package.json`'s `main`/`module`/`browser`/`types`/`exports` fields are internally consistent and all point into `dist/`, which is what's actually published. |
| Network Access | ❌ False | No `fetch`, `XMLHttpRequest`, `WebSocket`, or similar in `src/` — confirmed by grep. The library is pure DOM manipulation. |
| New Author | ⚪ Not assessable | Requires npm registry account-age metadata; contextually the maintainer account has an established publish history for this package (see `docs/changelogs/`). |
| Recently Published | ⚪ Not assessable | Applies to a specific published version's registry timestamp, not the working tree. |
| Shell Access | ❌ False | No `child_process` usage in `src/`. CI workflows run shell commands, but that's normal build automation, not code that ships to consumers. |
| Trivial Package | ❌ False | `src/` is a multi-module library (rendering, stacking, theming, locale, buttons, etc.), far above the "under 10 lines" trivial-package threshold. |
| Uses Eval | ❌ False | No `eval(` or `new Function(` anywhere in `src/`. |

## Low severity

| Condition | Status | Notes |
|---|---|---|
| Chronological Version Anomaly | ❌ False | `package.json` version (`2.4.6`) is ahead of all released versions in `docs/changelogs/`; no out-of-order semver observed. |
| Debug Access | ❌ False | No debugger/reflection APIs in `src/`. |
| Dynamic Require | ❌ False | The library is pure ESM; no `require()` calls in `src/` at all (confirmed by grep). |
| Environment Variable Access | ❌ False | No `process.env` reads in `src/`. CI workflows reference secrets (`NPM_TOKEN`, `GH_TOKEN`) only through GitHub Actions' `secrets.*` context, not hardcoded — appropriate handling. |
| Filesystem Access | ❌ False | No `fs` usage in `src/` — it's a browser-only library. |
| High Entropy Strings | ❌ False (spot-checked) | `src/` is plain readable source with no packed/minified/encoded blobs; not exhaustively entropy-scanned across `node_modules`. |

## Additional observation (outside Socket's taxonomy, adjacent to "GitHub Dependency")

**GitHub Actions are pinned by mutable tag, not commit SHA.** All four workflows (`ci.yml`, `deploy-demo.yml`, `release.yml`, `sync-changelog.yml`) reference actions as `actions/checkout@v4`, `actions/setup-node@v4`, `codecov/codecov-action@v5` — tags that can be re-pointed by the action's maintainer (or an attacker who compromises their account) without your knowledge, unlike a pinned commit SHA. These are official GitHub/Codecov actions with low a priori risk, but pinning to SHA (with Dependabot to bump them) is the standard hardening step if the release pipeline's trust boundary matters — `release.yml` in particular publishes to npm with `--provenance` using `secrets.NPM_TOKEN`.

## Positive signals worth keeping

- **Zero runtime dependencies.** The published package has no `dependencies` field at all — the entire supply-chain attack surface for consumers is the code in `dist/`, built from `src/` in this repo.
- **`npm publish --provenance`** in `release.yml` — ties published npm artifacts back to a verifiable GitHub Actions build, which is the strongest mitigation on this list for anyone who *does* depend on `brents-toasts`.
- **Narrow publish surface** — `files: ["dist", "man"]` plus `.npmignore` means source, tests, CI config, and examples never reach the npm tarball.

## Recommendation

For the "Not assessable" rows above (author reputation, AI-detected anomalies, per-package publish-history), the only way to get real coverage is to actually run Socket's scanner (`socket cli` / GitHub app) against this repo — this report covers everything checkable from local repo state and `npm audit` alone.
