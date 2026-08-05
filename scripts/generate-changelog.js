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

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
const MAX_DIFF_CHARS = 60000;
const MAX_CONTEXT_CHARS = 40000;
const MAX_OUTPUT = 2048;
const MODEL = "claude-haiku-4-5-20251001";
const MODEL_INPUT_TOKEN_COST = 1 / 1_000_000;
const MODEL_OUTPUT_TOKEN_COST = 5 / 1_000_000;
const TAX_RATE = 0.19;
const MAX_COST_PER_RUN = (MAX_DIFF_CHARS + MAX_CONTEXT_CHARS + 1000) * MODEL_INPUT_TOKEN_COST + MAX_OUTPUT * MODEL_OUTPUT_TOKEN_COST;
const MAX_COST_PER_RUN_WITH_TAX = MAX_COST_PER_RUN * (1 + TAX_RATE);
console.log(`Max cost per run (with tax): $${MAX_COST_PER_RUN_WITH_TAX.toFixed(6)} (diff ${MAX_DIFF_CHARS} chars, context ${MAX_CONTEXT_CHARS} chars, output ${MAX_OUTPUT} tokens)`);

const apiKey = process.env.ANTHROPIC_API_KEY;
const version = process.env.VERSION;
const prevTag = process.env.PREV_TAG || "";

if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
if (!version) throw new Error("VERSION is not set");

const diffBase = prevTag || EMPTY_TREE;
let diff = execFileSync(
  "git",
  ["diff", `${diffBase}..HEAD`, "--", ".", ":!dist", ":!docs/changelogs", ":!docs/options", ":!package-lock.json", ":!.idea/", ":!.claude/"],
  { maxBuffer: 1024 * 1024 * 20 },
).toString();

if (diff.length > MAX_DIFF_CHARS) {
  diff = `${diff.slice(0, MAX_DIFF_CHARS)}\n\n[diff truncated]`;
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
Given a git diff, write a concise changelog entry in Markdown, using "Keep a Changelog" style
bullet groups only where relevant (Added / Changed / Fixed / Removed). Skip empty groups.
Describe user-facing/API-level changes and only mention internal refactors, formatting, tests,
tooling, or CI changes as long they affect consumers of the library or are significant enough. Do not go into detail about documentation changes.
Do not include a title or version heading, just the bullet groups. Be terse - this is read by developers deciding
whether to upgrade.${
  context
    ? " This is a minor or major release, so you're also given the changelogs of earlier versions in this cycle for context, followed by the diff for this specific release. Use that context to understand the full arc of change for this bump and write a cohesive entry including all relevant changes from the given changelogs. SO summarise all changelogs AND the changes made in this commit."
    : ""
}`;

const userContent = context
  ? `Changelogs from earlier versions in this cycle, for context:\n\n${context}\n\n---\n\nDiff for this release (${version}):\n\n${diff || "(no diff)"}`
  : diff || "(no diff - first release)";

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
const entry = `# ${version} - ${date}\n\n${socketBadge}\n\n${body}\n`;

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
