// Drafts a changelog entry for a release from the full diff since the previous
// tag, using the Claude API. Run only in CI, for full (non-prerelease) tags.
//
// Required env vars:
//   ANTHROPIC_API_KEY - API key with access to the Claude API
//   VERSION           - version being released, e.g. "1.2.0"
//   PREV_TAG          - previous release tag, e.g. "v1.1.0" (empty for the first release)

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
const MAX_DIFF_CHARS = 60000;
const MAX_OUTPUT = 2048;
const MODEL = "claude-haiku-4-5-20251001";
const MODEL_INPUT_TOKEN_COST = 1 / 1_000_000;
const MODEL_OUTPUT_TOKEN_COST = 5 / 1_000_000;
const TAX_RATE = 0.19;
const MAX_COST_PER_RUN = (MAX_DIFF_CHARS + 1000) * MODEL_INPUT_TOKEN_COST + MAX_OUTPUT * MODEL_OUTPUT_TOKEN_COST;
const MAX_COST_PER_RUN_WITH_TAX = MAX_COST_PER_RUN * (1 + TAX_RATE);
console.log(`Max cost per run (with tax): $${MAX_COST_PER_RUN_WITH_TAX.toFixed(6)} (diff ${MAX_DIFF_CHARS} chars, output ${MAX_OUTPUT} tokens)`);

const apiKey = process.env.ANTHROPIC_API_KEY;
const version = process.env.VERSION;
const prevTag = process.env.PREV_TAG || "";

if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
if (!version) throw new Error("VERSION is not set");

const diffBase = prevTag || EMPTY_TREE;
let diff = execFileSync(
  "git",
  ["diff", `${diffBase}..HEAD`, "--", ".", ":!dist", ":!docs/changelogs", ":!package-lock.json", ":!.idea/", ":!.claude/"],
  { maxBuffer: 1024 * 1024 * 20 },
).toString();

if (diff.length > MAX_DIFF_CHARS) {
  diff = `${diff.slice(0, MAX_DIFF_CHARS)}\n\n[diff truncated]`;
}

const system = `You write changelog entries for "brents-toasts", a small toast/snackbar UI library.
Given a git diff, write a concise changelog entry in Markdown, using "Keep a Changelog" style
bullet groups only where relevant (Added / Changed / Fixed / Removed). Skip empty groups.
Describe user-facing/API-level changes and only mention internal refactors, formatting, tests,
tooling, or CI changes as long they affect consumers of the library or are significant enough. Do not go into detail about documentation changes.
Do not include a title or version heading, just the bullet groups. Be terse - this is read by developers deciding
whether to upgrade.`;

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
    messages: [{ role: "user", content: diff || "(no diff - first release)" }],
  }),
});

if (!response.ok) {
  throw new Error(`Claude API request failed: ${response.status} ${await response.text()}`);
}

const data = await response.json();
const body = data.content.map((block) => block.text).join("").trim();

const date = new Date().toISOString().slice(0, 10);
const entry = `# ${version} - ${date}\n\n${body}\n`;

mkdirSync("docs/changelogs", { recursive: true });
writeFileSync(`docs/changelogs/${version}.md`, entry);
console.log(entry);
console.log("\nApproximate cost for changelog generation: $" + ((MODEL_INPUT_TOKEN_COST * (system.length + diff.length) + MODEL_OUTPUT_TOKEN_COST * entry.length) * (1+TAX_RATE)).toFixed(4).toString());
