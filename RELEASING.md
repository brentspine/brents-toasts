# Releasing

How to publish a new version of `brents-toasts` as a GitHub Release. Automated
by `.github/workflows/release.yml`.

## How it's triggered

The workflow runs on **tag push** only, matching the pattern `v*.*.*`
(`on.push.tags` in `release.yml`). Nothing else triggers it — pushing to a
branch, opening a PR, etc. do not run this workflow. Pushing a tag is the only
action that starts a release.

## Steps to cut a release

1. Bump the version in `package.json`:
   ```bash
   npm version patch   # or minor / major
   ```
   This edits `package.json` and creates a matching git commit + tag locally
   (e.g. `v1.0.1`). For a prerelease, pass a prerelease id, e.g.
   `npm version 1.1.0-beta.1` (see [Prereleases](#prereleases) below).

2. Push the commit and the tag:
   ```bash
   git push
   git push --tags
   ```

3. The `Release` workflow picks up the tag push and, in order:
   - Installs dependencies, typechecks, and builds (`dist/` is git-ignored,
     so CI always builds from source rather than trusting committed output).
   - **Verifies the tag matches `package.json`.** The tag's version
     (`v1.0.1` → `1.0.1`) must exactly equal `package.json`'s `"version"`
     field, or the workflow fails before publishing anything. This catches
     the common mistake of tagging without bumping the version (or vice
     versa).
   - Renames the six build outputs to the versioned convention
     (`brents-toasts-1.0.1.esm.js`, `.esm.min.js`, `.cjs`, `.umd.js`,
     `.umd.min.js`, `.d.ts`).
   - Decides whether this is a prerelease (see below).
   - Publishes a GitHub Release for the tag with all six files attached and
     auto-generated release notes.

No manual GitHub token setup is needed — the workflow uses the
auto-provisioned `GITHUB_TOKEN` (`permissions: contents: write` is what grants
it release-creation rights).

## Prereleases

If the tag name contains `-alpha`, `-beta`, or `-rc` (e.g. `v1.1.0-beta.1`),
the release is created with GitHub's "prerelease" flag set, so it won't show
up as the repo's "Latest release" or notify normal watchers. Anything else
(`v1.1.0`, `v2.0.0`) is published as a full release.

## Changelog

On every **non-prerelease** tag, before the GitHub Release is created, the
workflow generates a changelog entry automatically:

1. It finds the previous release tag and takes the full `git diff` between
   that tag and the one being released (excluding `dist/` and
   `docs/changelogs/` themselves).
2. `scripts/generate-changelog.js` sends that diff to the Claude API
   (`claude-haiku-4-5`, chosen for cost since this runs on every release) and
   asks for a concise, user-facing summary in "Keep a Changelog" style.
3. The result is written to `docs/changelogs/<version>.md` and used directly
   as the GitHub Release's notes (`gh release create --notes-file`) instead
   of GitHub's auto-generated commit list.
4. The workflow commits that file to `main` (as `github-actions[bot]`), since
   the tag itself is immutable and the demo page needs to fetch it from a
   branch.

There is **no review step** — it ships automatically. If an entry is wrong or
you want to reword it, just edit `docs/changelogs/<version>.md` on `main`
directly (by hand or PR). A second workflow, `sync-changelog.yml`, watches
for pushes to `docs/changelogs/*.md` and re-runs
`gh release edit <tag> --notes-file <file>` for the matching release, so the
edit propagates to the GitHub Release automatically. The demo page fetches
the file live from `main` (see below), so it always reflects the latest edit
too, usually within a few minutes (GitHub's raw-content CDN cache window).

Prereleases don't get a changelog entry — for now, only full releases do.

## Demo deployment

On every **non-prerelease** tag, the workflow also redeploys the live demo at
`brentspine.github.io/brents-toasts/` from the `demo/` folder in this repo:

- `demo/index.html` and `demo/styles.css` are copied over unchanged.
- `demo/app.js` imports the library from a placeholder path,
  `./__TOASTS_LIB__`, and reads the current version from a `__VERSION__`
  placeholder (used to fetch that version's changelog). The workflow
  rewrites both placeholders before deploying — the committed `demo/app.js`
  should never reference a real filename or version directly.
- The freshly built `dist/index.esm.min.js` is copied to the target repo as
  `toasts-<version>.js` (e.g. `toasts-1.2.0.js`).

Deployment writes to two places in `brentspine.github.io`:

- **`brents-toasts/`** (root) — always mirrors the latest release. Any older
  `toasts-*.js` file here is removed first, so only the current version's
  library file remains at this path.
- **`brents-toasts/versions/<version>/`** — a permanent, never-overwritten
  archive of that exact release's demo, so old demo links keep working
  forever. `brents-toasts/versions/versions.json` is updated with the new
  version each release; the demo page reads it to render an "Other versions"
  list linking to each archive.

Prereleases (`-alpha`/`-beta`/`-rc` tags) skip this step entirely — the live
demo only ever reflects the latest full release.

### One-time setup: secrets

Two repository secrets are needed (`brents-toasts` → Settings → Secrets and
variables → Actions):

- **`PAGES_DEPLOY_TOKEN`** — `GITHUB_TOKEN` only grants access to the repo
  the workflow runs in, so pushing to `brentspine.github.io` needs a
  separate credential. Create a fine-grained personal access token scoped to
  just the `brentspine.github.io` repository, with **Contents: Read and
  write** permission (that's the only permission needed). Without this
  secret, the release itself still succeeds — only the demo deploy step
  fails.
- **`ANTHROPIC_API_KEY`** — an Anthropic API key used to generate the
  changelog entry. Without this secret, the changelog generation step fails,
  which fails the whole release (the GitHub Release step depends on the
  generated file). If you ever want releases to succeed without it, that
  step would need to fall back to `--generate-notes`.

### A note on branch protection

The changelog-commit step pushes directly to `main` using the default
`GITHUB_TOKEN`. If `main` ever gets branch protection requiring PRs/reviews,
this push will start failing (the release and demo deploy will still have
already succeeded by that point — only this last step breaks).

## Things that won't stop you (but should)

- **Re-pushing an existing tag / re-releasing a version that already has a
  release** isn't checked — `gh release create` will simply fail if the
  release already exists. The workflow doesn't detect "this version was
  already released" ahead of time; it only checks that the tag and
  `package.json` agree with each other.
- Nothing stops you from tagging a commit that isn't on `main`/your default
  branch. Make sure you're tagging the commit you actually intend to ship.
