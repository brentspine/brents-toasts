// Drafts a changelog entry for a release from the full diff since the previous
// tag, using the Claude API. Run only in CI, for full (non-prerelease) tags.
//
// For minor and major bumps, changelogs from earlier versions in the same
// cycle are included as extra context so the entry can reflect the whole
// cycle, not just the diff since the last tag:
//   - Minor bump (e.g. 2.1.5 -> 2.2.0): every patch changelog in the previous
//     minor line, 2.1.0 through 2.1.5.
//   - Major bump (e.g. 2.3.5 -> 3.0.0): one representative changelog (the
//     ".0" release) per earlier minor line of the previous major - 2.0.0,
//     2.1.0, 2.2.0 - plus every patch changelog in that major's last minor
//     line, 2.3.0 through 2.3.5. Earlier lines are collapsed to their ".0"
//     entry so the context doesn't grow without bound across many majors.
//
// Required env vars:
//   ANTHROPIC_API_KEY - API key with access to the Claude API
//   VERSION           - version being released, e.g. "1.2.0"
//   PREV_TAG          - previous release tag, e.g. "v1.1.0" (empty for the first release)
//
// Optional env vars:
//   GH_TOKEN / GITHUB_TOKEN - used to fetch the content of GitHub issues referenced by
//                             commit messages (e.g. "Fixes #118") and the GitHub login of
//                             each commit's author, for higher API rate limits. Falls back
//                             to unauthenticated requests without it.
//
// Each changelog bullet is written with a plain "#123" issue reference and a plain "@login"
// maintainer tag where applicable - not markdown link syntax. GitHub's own release-notes
// renderer and the project's demo site (demo/src/app/shared/markdown.ts) both autolink that
// plain text themselves.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
const MAX_DIFF_CHARS = 60000;
const MAX_CONTEXT_CHARS = 40000;
const MAX_COMMITS_CHARS = 10000;
const MAX_ISSUES_CHARS = 15000;
const MAX_OUTPUT = 2048;
const MODEL = "claude-haiku-4-5-20251001";
const MODEL_INPUT_TOKEN_COST = 1 / 1_000_000;
const MODEL_OUTPUT_TOKEN_COST = 5 / 1_000_000;
const TAX_RATE = 0.19;
const MAX_COST_PER_RUN =
  (MAX_DIFF_CHARS + MAX_CONTEXT_CHARS + MAX_COMMITS_CHARS + MAX_ISSUES_CHARS + 1000) * MODEL_INPUT_TOKEN_COST + MAX_OUTPUT * MODEL_OUTPUT_TOKEN_COST;
const MAX_COST_PER_RUN_WITH_TAX = MAX_COST_PER_RUN * (1 + TAX_RATE);
console.log(
  `Max cost per run (with tax): $${MAX_COST_PER_RUN_WITH_TAX.toFixed(6)} (diff ${MAX_DIFF_CHARS} chars, context ${MAX_CONTEXT_CHARS} chars, commits ${MAX_COMMITS_CHARS} chars, issues ${MAX_ISSUES_CHARS} chars, output ${MAX_OUTPUT} tokens)`,
);

const apiKey = process.env.ANTHROPIC_API_KEY;
const version = process.env.VERSION;
const prevTag = process.env.PREV_TAG || "";
const githubToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";

if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
if (!version) throw new Error("VERSION is not set");

const diffBase = prevTag || EMPTY_TREE;
let diff = execFileSync(
  "git",
  ["diff", `${diffBase}..HEAD`, "--", ".", ":!dist", ":!docs/changelogs", ":!docs/options", ":!package-lock.json", ":!demo/package-lock.json", ":!.idea/", ":!.claude/"],
  { maxBuffer: 1024 * 1024 * 20 },
).toString();

if (diff.length > MAX_DIFF_CHARS) {
  diff = `${diff.slice(0, MAX_DIFF_CHARS)}\n\n[diff truncated]`;
}

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"));
const repoMatch = /github\.com[:/]([^/]+)\/([^/.]+)/.exec(pkg.repository?.url || "");
const [owner, repo] = repoMatch ? [repoMatch[1], repoMatch[2]] : [null, null];

// Full commit messages (subject + body) since the previous release, tagged with the GitHub
// login of whoever authored each one - resolved via the GitHub API (not just the git commit's
// author name/email, which for a personal, non-noreply address doesn't expose the username at
// all) - so the model can credit the right maintainer per changelog bullet, and GitHub's own
// markdown renderer (release notes) and the demo's (docs/guide's markdown-view) both turn a
// plain "@login" back into a profile link on their own.
async function fetchCommitLogin(sha) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${sha}`, {
    headers: {
      accept: "application/vnd.github+json",
      ...(githubToken ? { authorization: `Bearer ${githubToken}` } : {}),
    },
  });
  if (!res.ok) {
    console.warn(`Could not fetch commit ${sha}: ${res.status}`);
    return null;
  }
  const data = await res.json();
  return data.author?.login ?? null;
}

const commitRecords = execFileSync("git", ["log", `${diffBase}..HEAD`, "--format=%H%x1f%h%x1f%an%x1f%B%x1e"], {
  maxBuffer: 1024 * 1024 * 20,
})
  .toString()
  .split("\x1e")
  .map((r) => r.trim())
  .filter(Boolean)
  .map((r) => {
    const [fullSha, shortSha, authorName, body] = r.split("\x1f");
    return { fullSha, shortSha, authorName, body: (body || "").trim() };
  });

if (owner && repo) {
  const logins = await Promise.all(commitRecords.map((c) => fetchCommitLogin(c.fullSha)));
  commitRecords.forEach((c, i) => (c.login = logins[i]));
}

let commitLog = commitRecords
  .map((c) => `--- ${c.shortSha} (author: ${c.login ? `@${c.login}` : c.authorName}) ---\n${c.body}`)
  .join("\n\n")
  .trim();

if (commitLog.length > MAX_COMMITS_CHARS) {
  commitLog = `${commitLog.slice(0, MAX_COMMITS_CHARS)}\n\n[commit log truncated]`;
}

// GitHub issues referenced in those commit messages (e.g. "Fixes #118", "#42"), fetched so
// the model has the actual issue title/description behind the reference, not just a number.
const issueNumbers = [...new Set([...commitLog.matchAll(/#(\d+)/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);

async function fetchIssue(number) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${number}`, {
    headers: {
      accept: "application/vnd.github+json",
      ...(githubToken ? { authorization: `Bearer ${githubToken}` } : {}),
    },
  });
  if (!res.ok) {
    console.warn(`Could not fetch issue #${number}: ${res.status}`);
    return null;
  }
  const data = await res.json();
  return { number, title: data.title, body: (data.body || "").trim() || "(no description)" };
}

let issuesSection = "";
if (owner && repo && issueNumbers.length > 0) {
  const issues = (await Promise.all(issueNumbers.map(fetchIssue))).filter(Boolean);
  issuesSection = issues.map((i) => `#${i.number}: ${i.title}\n\n${i.body}`).join("\n\n---\n\n");
  if (issuesSection.length > MAX_ISSUES_CHARS) {
    issuesSection = `${issuesSection.slice(0, MAX_ISSUES_CHARS)}\n\n[issues truncated]`;
  }
}

// For minor/major bumps, gather earlier changelogs in this cycle as context.
function parseVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v || "");
  return m ? { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) } : null;
}

function contextVersionsFor(current, prev) {
  if (!prev) return [];
  if (current.major !== prev.major) {
    const versions = [];
    for (let m = 0; m < prev.minor; m++) versions.push(`${prev.major}.${m}.0`);
    for (let p = 0; p <= prev.patch; p++) versions.push(`${prev.major}.${prev.minor}.${p}`);
    return versions;
  }
  if (current.minor !== prev.minor) {
    const versions = [];
    for (let p = 0; p <= prev.patch; p++) versions.push(`${prev.major}.${prev.minor}.${p}`);
    return versions;
  }
  return [];
}

const contextVersions = contextVersionsFor(parseVersion(version), parseVersion(prevTag.replace(/^v/, "")));

let context = "";
if (contextVersions.length > 0) {
  const sections = [];
  for (const v of contextVersions) {
    const path = `docs/changelogs/${v}.md`;
    if (existsSync(path)) {
      sections.push(readFileSync(path, "utf8").trim());
    } else {
      console.warn(`No changelog found for ${v}, skipping from context`);
    }
  }
  context = sections.join("\n\n");
  if (context.length > MAX_CONTEXT_CHARS) {
    context = `${context.slice(0, MAX_CONTEXT_CHARS)}\n\n[context truncated]`;
  }
}

const system = `You write changelog entries for "brents-toasts", a small toast/snackbar UI library.
Given the commit messages (each one tagged with the GitHub login of the maintainer who authored
it), any GitHub issues they reference, and a git diff, write a concise changelog entry in
Markdown, using "Keep a Changelog" style bullet groups only where relevant (Added / Changed /
Fixed / Removed). Skip empty groups.
Describe user-facing/API-level changes and only mention internal refactors, formatting, tests,
tooling, or CI changes as long they affect consumers of the library or are significant enough. Do not go into detail about documentation changes.
Every bullet must end with an attribution tag for the maintainer(s) whose commit(s) it summarizes,
e.g. "- Fixed toasts closing early on hover - @brentspine". Copy the "@login" shown for that
commit verbatim from the commit messages below - never invent, guess, or normalize one (e.g. don't
turn a display name into a login yourself). If a commit has no login (shown as a plain name
instead), fall back to that plain name with no "@". If a bullet summarizes commits from more than
one author, tag all of them. When a bullet describes work that fixes or closes a specific GitHub
issue, also work in a bare "#123" reference for that issue number, using the numbers given below.
Write both "#123" and "@login" as plain text, never as markdown link syntax ("[...](...)" or
similar) and never wrapped in backticks - the tools that render this changelog (GitHub's release
notes, and the project's own demo site) turn plain "#123"/"@login" text into links themselves.
Do not include a title or version heading, just the bullet groups. Be terse - this is read by developers deciding
whether to upgrade. Use the commit messages and issue content to understand the intent and user-facing
framing of each change, and the diff to verify what actually shipped.${
  context
    ? " This is a minor or major release, so you're also given the changelogs of earlier versions in this cycle for context, followed by the commit messages, issues, and diff for this specific release. Use that context to understand the full arc of change for this bump and write a cohesive entry including all relevant changes from the given changelogs. SO summarise all changelogs AND the changes made in this commit."
    : ""
}`;

const sections = [];
if (context) sections.push(`Changelogs from earlier versions in this cycle, for context:\n\n${context}`);
if (commitLog) sections.push(`Commit messages since the previous release:\n\n${commitLog}`);
if (issuesSection) sections.push(`GitHub issues referenced by those commits:\n\n${issuesSection}`);
sections.push(`Diff for this release (${version}):\n\n${diff || "(no diff)"}`);

const userContent = sections.join("\n\n---\n\n");

console.log(userContent);
console.log("\n\n\n\n\n\n");
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  },
  body: JSON.stringify({
    model: MODEL,
    max_tokens: MAX_OUTPUT,
    system: system,
    messages: [{ role: "user", content: userContent }],
  }),
});
console.log("Sent request to Claude API");

if (!response.ok) {
  throw new Error(`Claude API request failed: ${response.status} ${await response.text()}`);
}

const data = await response.json();
const body = data.content.map((block) => block.text).join("").trim();

const date = new Date().toISOString().slice(0, 10);
const socketBadge = `[![Socket Security](https://badge.socket.dev/npm/package/brents-toasts/${version})](https://socket.dev/npm/package/brents-toasts/overview/${version})`;

// Deterministic, not LLM-generated - shields.io/socket badges are self-updating images, so
// there's nothing to fetch or hallucinate here, just the right badge/link URLs. Placed at the
// bottom (unlike socketBadge above) since these reflect the repo's current standing, not
// anything specific to this release.
const statsFooter = [
  `[![Stars](https://img.shields.io/github/stars/brentspine/brents-toasts.svg?style=for-the-badge)](https://github.com/brentspine/brents-toasts/stargazers)`,
  `[![Issues](https://img.shields.io/github/issues/brentspine/brents-toasts.svg?style=for-the-badge)](https://github.com/brentspine/brents-toasts/issues)`,
  `[![npm downloads](https://img.shields.io/npm/dm/brents-toasts.svg?label=%E2%8F%ACdownloads&style=for-the-badge)](https://www.npmjs.com/package/brents-toasts)`,
  `[![coverage](https://img.shields.io/codecov/c/github/brentspine/brents-toasts.svg?style=for-the-badge)](https://codecov.io/gh/brentspine/brents-toasts)`,
  `[![npm v${version}](https://img.shields.io/badge/npm-v${version}-cb3837?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/brents-toasts/v/${version})`,
].join("\n");
const entry = `# ${version} - ${date}\n\n<!--\n${socketBadge}\n-->\n\n${body}\n\n---\n\n<!--\n${statsFooter}\n-->\n`;

mkdirSync("docs/changelogs", { recursive: true });
writeFileSync(`docs/changelogs/${version}.md`, entry);
console.log(entry);
const inputLength = system.length + userContent.length;
const inputCost = inputLength * MODEL_INPUT_TOKEN_COST * (1+TAX_RATE);
const outputLength = entry.length;
const outputCost = MODEL_OUTPUT_TOKEN_COST * outputLength * (1+TAX_RATE);
console.log("\nInput length and cost: " + inputLength + " chars, $" + inputCost.toFixed(6));
console.log("Output length and cost: " + outputLength + " chars, $" + outputCost.toFixed(6));
console.log("\nApproximate cost for changelog generation: $" + (inputCost + outputCost).toFixed(4).toString());
