import { toasts, ToastColor, ToastPosition, ToastAnimation, ToastBuilder } from "./__TOASTS_LIB__";

const $ = (id) => document.getElementById(id);

const configMaxToasts = $("configMaxToasts");
const configColor = $("configColor");
const configLanguage = $("configLanguage");
const configDuration = $("configDuration");
const configClosable = $("configClosable");
const applyConfigBtn = $("applyConfig");
const configCodePreview = $("configCodePreview");

const toastText = $("toastText");
const toastTitle = $("toastTitle");
const contentType = $("contentType");
const contentTypeHint = $("contentTypeHint");
const buttonPreset = $("buttonPreset");
const buttonPresetHint = $("buttonPresetHint");
const apiStyle = $("apiStyle");
const useDefaults = $("useDefaults");
const presetColor = $("presetColor");
const colorPicker = $("colorPicker");
const colorHex = $("colorHex");
const durationMs = $("durationMs");
const closable = $("closable");
const removeOthers = $("removeOthers");
const presetSuccessBtn = $("presetSuccess");
const presetHtmlBtn = $("presetHtml");
const presetUndoBtn = $("presetUndo");
const presetConfirmBtn = $("presetConfirm");
const presetDetailsBtn = $("presetDetails");
const makeToast = $("makeToast");
const makeFive = $("makeFive");
const codePreview = $("codePreview");
const changelogBox = $("changelog");
const versionList = $("versionList");
const githubStarCount = $("githubStarCount");
const repoStats = $("repoStats");

const optionsReference = $("optionsReference");
const playgroundCode = $("playgroundCode");
const playgroundRunBtn = $("playgroundRun");
const playgroundResetBtn = $("playgroundReset");
const playgroundOutput = $("playgroundOutput");

const CONTENT_TYPE_HINTS = {
  text: "Rendered as plain text — safe with untrusted input.",
  html: "Rendered via innerHTML — sanitize untrusted input yourself.",
  interactive: "A real DOM Node appended directly — no innerHTML, no XSS surface.",
};

const BUTTON_PRESET_HINTS = {
  none: "",
  undo: "Dismisses this toast, then shows a new one.",
  confirm: "toasts.confirmButton() — click to arm, click again to confirm, then auto-reverts.",
  details: "Native details toggle — expands a distinct block with structured info; the Error row opts into a Copy button via toasts.detailsCopyButton().",
};

// Single source of truth for the "Playground" reference table below — add a
// row here when a new ToastOptions/ToastsConfig field ships, instead of
// hand-building a new form control for it above. Mirrors the JSDoc on
// ToastOptions/ToastsConfig in src/Toasts.ts.
const TOAST_OPTION_DOCS = [
  { name: "color", type: "string", default: "ToastColor.INFO", note: "Background color of the indicator bar." },
  { name: "duration", type: "number", default: "3000", note: "Auto-dismiss after ms. 0 disables it." },
  { name: "closable", type: "boolean", default: "true", note: "Whether clicking the toast dismisses it." },
  { name: "allowHtml", type: "boolean", default: "false", note: "Render message via innerHTML — sanitize untrusted input yourself." },
  { name: "title", type: "string", default: "(none)", note: "Bold title line above the message. Always rendered as plain text." },
  { name: "position", type: "ToastPositionValue", default: "ToastPosition.BOTTOM_CENTER", note: "Only BOTTOM_CENTER has real placement CSS today." },
  { name: "animation", type: "ToastAnimationValue", default: "ToastAnimation.SLIDE", note: "Only SLIDE is implemented today." },
  { name: "onClose", type: "() => void", default: "(none)", note: "Called as soon as the toast starts closing." },
  { name: "removeOtherToasts", type: "boolean", default: "false", note: "Dismisses every other visible toast before showing this one." },
  { name: "buttons", type: "ToastButton[]", default: "(none)", note: "{ label, onClick(event, id), className? } — right-aligned, never triggers dismissal. toasts.closeButton()/confirmButton()/stepButton() build one of these for you (see the table below)." },
  { name: "details", type: "(string | ToastDetailItem)[]", default: "(none)", note: "Adds a Details toggle revealing { label?, value, buttons? } rows. Nothing is copyable automatically — opt a row into a Copy button via buttons: [toasts.detailsCopyButton(value)]." },
  { name: "detailsLabel", type: "string", default: '"Details"', note: "Label for the auto-added details toggle button." },
  { name: "detailsHideLabel", type: "string", default: '"Hide details"', note: "Label for the toggle button while details are expanded." },
];

const CONFIG_OPTION_DOCS = [
  { name: "maxToasts", type: "number", default: "5", note: "Toasts visible at once before the oldest is evicted." },
  { name: "evictOldest", type: "boolean", default: "true", note: "Evict the oldest toast once maxToasts is exceeded." },
  { name: "locale", type: "string", default: "(auto-detected)", note: "Overrides auto-detection — forces a bundled locale (en/de/es/fr) for built-in button/label text." },
  { name: "translations", type: "Partial<ToastTranslations>", default: "(none)", note: "Overrides individual translated strings on top of the resolved locale." },
];

// Ready-made ToastButton factories on `toasts` (methods, not ToastOptions
// fields) — appended into `buttons` / a details item's own `buttons`.
const BUTTON_FACTORY_DOCS = [
  { name: "closeButton(label?, className?)", type: "ToastButton", default: '"Close"', note: "Dismisses the toast it's added to." },
  { name: "confirmButton(label, onConfirm, options?)", type: "ToastButton", default: '"Are you sure?" / "Done"', note: "Click to arm, click again to run onConfirm, then flashes doneLabel before reverting. Auto-reverts if the confirm step is ignored." },
  { name: "detailsCopyButton(text, label?, copiedLabel?, className?)", type: "ToastButton", default: '"Copy" / "Copied!"', note: "For a details item's buttons — copies text to the clipboard and flashes copiedLabel for 2s." },
  { name: "stepButton(steps, className?)", type: "ToastButton", default: "(none)", note: "General-purpose multi-step primitive behind confirmButton()/detailsCopyButton() — build a custom click-driven flow from ToastButtonStep[]." },
];

const PLAYGROUND_DEFAULT_CODE = `// toasts, ToastColor, ToastPosition, ToastAnimation and ToastBuilder are
// all in scope here — anything from the reference above is fair game.
toasts.showToast("Change anything in here, then hit Run.", {
  title: "Playground",
  color: ToastColor.INFO,
  duration: 0,
  buttons: [
    { label: "Undo", onClick: (event, id) => toasts.removeToast(id) },
  ],
  details: [
    { label: "Tip", value: "Every ToastOptions field above works here too." },
  ],
});
`;

function presetToHex6(key) {
  const c = ToastColor[key];
  const s = typeof c === "string" ? c : ToastColor.INFO;
  return s.slice(0, 7);
}

function withAlphaFF(hex) {
  const s = String(hex).trim();
  const len = s.length;
  const ok6 = len === 7;
  const ok8 = len === 9;
  return ok8 ? s : ok6 ? `${s}ff` : "#28a6f5ff";
}

function readDuration() {
  const n = Number.parseInt(durationMs.value, 10);
  const finite = Number.isFinite(n);
  const normalized = finite ? n : 3000;
  return normalized < 0 ? 0 : normalized;
}

function readMaxToasts() {
  const n = Number.parseInt(configMaxToasts.value, 10);
  const valid = Number.isFinite(n) && n > 0;
  return valid ? n : 5;
}

function readConfigDuration() {
  const n = Number.parseInt(configDuration.value, 10);
  const finite = Number.isFinite(n);
  const normalized = finite ? n : 3000;
  return normalized < 0 ? 0 : normalized;
}

function readConfigLocale() {
  const v = configLanguage.value;
  return v === "auto" ? undefined : v;
}

function applyPageConfig() {
  toasts.configure({
    maxToasts: readMaxToasts(),
    color: ToastColor[configColor.value],
    duration: readConfigDuration(),
    closable: configClosable.checked,
    locale: readConfigLocale(),
  });
}

function updateConfigCodePreview() {
  const locale = readConfigLocale();
  const lines = [
    `toasts.configure({`,
    `  maxToasts: ${readMaxToasts()},`,
    `  color: ToastColor.${configColor.value},`,
    `  duration: ${readConfigDuration()},`,
    `  closable: ${configClosable.checked},`,
  ];
  if (locale) lines.push(`  locale: ${JSON.stringify(locale)},`);
  lines.push(`});`);
  configCodePreview.textContent = lines.join("\n");
}

function readMessageRaw() {
  const s = toastText.value;
  const t = s.trim();
  return t.length ? t : "Hello, toast.";
}

function readClosable() {
  return Boolean(closable.checked);
}

function readTitle() {
  const t = toastTitle.value.trim();
  return t.length ? t : undefined;
}

// Mirrors the README's custom-content example: a plain Node appended
// directly, so it needs no innerHTML/allowHtml at all. Independent of the
// native `buttons` option — see buildButtonsForToast().
function buildInteractiveContent() {
  const content = document.createElement("span");
  content.textContent = "This part is a real DOM node, and ";
  const em = document.createElement("em");
  em.textContent = "this part is nested inside it";
  content.appendChild(em);
  content.append(".");
  return content;
}

function updateContentModeUI() {
  const mode = contentType.value;
  toastText.disabled = mode === "interactive";
  contentTypeHint.textContent = CONTENT_TYPE_HINTS[mode];
}

function updateButtonPresetUI() {
  buttonPresetHint.textContent = BUTTON_PRESET_HINTS[buttonPreset.value];
}

// Real button behavior for showOneToast() — canned, not free-form, since
// callbacks can't be represented as simple form fields the way text/color/
// duration can. "Details" uses the native `details` option instead (see
// buildDetailsForToast()) — it gets its own toggle button for free.
function buildButtonsForToast() {
  const preset = buttonPreset.value;
  if (preset === "undo") {
    return [
      {
        label: "Undo",
        onClick: (event, id) => {
          toasts.removeToast(id);
          toasts.showToast("Restored!", ToastColor.SUCCESS);
        },
      },
    ];
  }
  if (preset === "confirm") {
    return [
      toasts.confirmButton("Delete", (event, id) => {
        toasts.removeToast(id);
        toasts.showToast("Deleted!", ToastColor.SUCCESS);
      }),
    ];
  }
  return undefined;
}

function buildDetailsForToast() {
  if (buttonPreset.value !== "details") return undefined;
  return [
    { label: "Error", value: "500 Internal Server Error", buttons: [toasts.detailsCopyButton("500 Internal Server Error")] },
    { label: "Status", value: "failed" },
  ];
}

// Mirrors buildButtonsForToast()/buildDetailsForToast() as preview data
// instead of real callbacks — used by updateCodePreview().
function buttonsBlockForPreview() {
  const preset = buttonPreset.value;
  if (preset === "undo") {
    return {
      kind: "undo",
      label: "Undo",
      body: [`toasts.removeToast(id);`, `toasts.showToast("Restored!", ToastColor.SUCCESS);`],
    };
  }
  if (preset === "confirm") {
    return {
      kind: "confirm",
      label: "Delete",
      body: [`toasts.removeToast(id);`, `toasts.showToast("Deleted!", ToastColor.SUCCESS);`],
    };
  }
  return null;
}

function detailsBlockForPreview() {
  if (buttonPreset.value !== "details") return null;
  return [
    { label: "Error", value: "500 Internal Server Error", copyable: true },
    { label: "Status", value: "failed" },
  ];
}

function colorExprForPreview() {
  const preset = presetColor.value;
  const custom = preset === "CUSTOM";
  return custom ? JSON.stringify(withAlphaFF(colorPicker.value)) : `ToastColor.${preset}`;
}

function colorValueForToast() {
  const preset = presetColor.value;
  const custom = preset === "CUSTOM";
  return custom ? withAlphaFF(colorPicker.value) : ToastColor[preset];
}

function syncColorUIFromPreset() {
  const preset = presetColor.value;
  const custom = preset === "CUSTOM";
  const next = custom ? colorPicker.value : presetToHex6(preset);
  colorPicker.value = next;
  colorHex.value = next.toUpperCase();
}

function syncColorUIFromPicker() {
  presetColor.value = "CUSTOM";
  colorHex.value = colorPicker.value.toUpperCase();
}

// Per-call options as [key, sourceExpression] pairs — used to render both
// the options-object form and the equivalent ToastBuilder chain below.
function optionPairsForPreview(includeStyleOverrides) {
  const pairs = [];
  const title = readTitle();
  if (title) pairs.push(["title", JSON.stringify(title)]);
  if (contentType.value === "html") pairs.push(["allowHtml", "true"]);
  if (removeOthers.checked) pairs.push(["removeOtherToasts", "true"]);
  if (includeStyleOverrides) {
    pairs.push(["color", colorExprForPreview()]);
    pairs.push(["duration", String(readDuration())]);
    pairs.push(["closable", String(readClosable())]);
  }
  return pairs;
}

function builderMethodLine([key, valueExpr]) {
  if (key === "removeOtherToasts") return `  .andRemoveOtherToasts()`;
  const method = `with${key[0].toUpperCase()}${key.slice(1)}`;
  return `  .${method}(${valueExpr})`;
}

function updateCodePreview() {
  const style = apiStyle.value;
  const skipOverrides = useDefaults.checked;
  const isInteractive = contentType.value === "interactive";
  const pairs = optionPairsForPreview(!skipOverrides);
  const btn = buttonsBlockForPreview();
  const details = detailsBlockForPreview();

  const names = new Set(style === "builder" ? ["ToastBuilder"] : ["toasts"]);
  if (pairs.some(([key]) => key === "color")) names.add("ToastColor");
  if (btn) names.add("ToastColor").add("toasts");
  if (details?.some((d) => d.copyable)) names.add("toasts");

  const lines = [`import { ${Array.from(names).join(", ")} } from "./__TOASTS_LIB__";`, ``];

  let msgExpr;
  if (isInteractive) {
    lines.push(
      `const content = document.createElement('span');`,
      `content.textContent = 'This part is a real DOM node, and ';`,
      `const em = document.createElement('em');`,
      `em.textContent = 'this part is nested inside it';`,
      `content.appendChild(em);`,
      `content.append('.');`,
      ``,
    );
    msgExpr = "content";
  } else {
    msgExpr = JSON.stringify(readMessageRaw());
  }

  const detailsItemLines = (indent) =>
    (details ?? []).map((d) => {
      const buttonsPart = d.copyable ? `, buttons: [toasts.detailsCopyButton(${JSON.stringify(d.value)})]` : "";
      return `${indent}{ label: ${JSON.stringify(d.label)}, value: ${JSON.stringify(d.value)}${buttonsPart} },`;
    });

  if (style === "builder") {
    const bodyLines = [];
    if (btn && btn.kind === "confirm") {
      bodyLines.push(
        `  .withConfirmButton(${JSON.stringify(btn.label)}, (event, id) => {`,
        ...btn.body.map((l) => `    ${l}`),
        `  })`,
      );
    } else if (btn) {
      bodyLines.push(
        `  .withButton(${JSON.stringify(btn.label)}, (event, id) => {`,
        ...btn.body.map((l) => `    ${l}`),
        `  })`,
      );
    }
    if (details) {
      bodyLines.push(`  .withDetails([`, ...detailsItemLines("    "), `  ])`);
    }
    lines.push(`new ToastBuilder(${msgExpr})`, ...pairs.map(builderMethodLine), ...bodyLines, `  .show();`);
  } else if (btn || details) {
    const objLines = [`, {`, ...pairs.map(([key, v]) => `  ${key}: ${v},`)];
    if (btn && btn.kind === "confirm") {
      objLines.push(
        `  buttons: [`,
        `    toasts.confirmButton(${JSON.stringify(btn.label)}, (event, id) => {`,
        ...btn.body.map((l) => `      ${l}`),
        `    }),`,
        `  ],`,
      );
    } else if (btn) {
      objLines.push(
        `  buttons: [`,
        `    {`,
        `      label: ${JSON.stringify(btn.label)},`,
        `      onClick: (event, id) => {`,
        ...btn.body.map((l) => `        ${l}`),
        `      },`,
        `    },`,
        `  ],`,
      );
    }
    if (details) {
      objLines.push(`  details: [`, ...detailsItemLines("    "), `  ],`);
    }
    objLines.push(`}`);
    lines.push(`toasts.showToast(${msgExpr}${objLines.join("\n")});`);
  } else {
    const objLine = pairs.length ? `, { ${pairs.map(([key, v]) => `${key}: ${v}`).join(", ")} }` : "";
    lines.push(`toasts.showToast(${msgExpr}${objLine});`);
  }

  codePreview.textContent = lines.join("\n");
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Splits on `code` spans so changelog entries referencing option/method
// names (very common) render as <code>, not literal backticks.
function renderInline(text) {
  return text
    .split(/`([^`]+)`/g)
    .map((part, i) => (i % 2 === 1 ? `<code>${escapeHtml(part)}</code>` : escapeHtml(part)))
    .join("");
}

function renderChangelogMarkdown(md) {
  const html = [];
  let inList = false;
  const closeList = () => {
    if (inList) html.push("</ul>");
    inList = false;
  };

  for (const raw of md.split("\n")) {
    const line = raw.trim();
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeList();
      const tag = heading[1].length === 1 ? "h3" : "h4";
      html.push(`<${tag}>${renderInline(heading[2])}</${tag}>`);
    } else if (line.startsWith("- ")) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${renderInline(line.slice(2))}</li>`);
    } else if (line.length) {
      closeList();
      html.push(`<p>${renderInline(line)}</p>`);
    }
  }
  closeList();
  return html.join("\n");
}

async function loadChangelog() {
  if (!changelogBox) return;
  const url = "https://raw.githubusercontent.com/Brentspine/brents-toasts/main/docs/changelogs/__VERSION__.md";
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`status ${res.status}`);
    changelogBox.innerHTML = renderChangelogMarkdown(await res.text());
  } catch {
    changelogBox.textContent = "Changelog unavailable.";
  }
}

// e.g. 2100 -> "2.1k", 999 -> "999", 1000000 -> "1M".
function formatCompactCount(n) {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${Math.round((n / 1000) * 10) / 10}k`;
  return `${Math.round((n / 1_000_000) * 10) / 10}M`;
}

// e.g. "3 hours ago", "2 days ago". Falls back to "just now" under a minute.
function formatRelativeTime(dateStr) {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000));
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [name, secs] of units) {
    const val = Math.floor(diffSec / secs);
    if (val >= 1) return `${val} ${name}${val > 1 ? "s" : ""} ago`;
  }
  return "just now";
}

function renderRepoStats(data) {
  if (!repoStats) return;
  const owner = data.owner;
  repoStats.innerHTML = `
    <a class="repo-owner" href="${owner.html_url}" target="_blank" rel="noopener noreferrer">
      <img class="repo-avatar" src="${owner.avatar_url}&s=40" width="20" height="20" alt="" />
      Built by @${escapeHtml(owner.login)}
    </a>
    <span class="repo-stat-sep">&middot;</span>
    <a class="repo-stat" href="${data.html_url}/issues" target="_blank" rel="noopener noreferrer">${data.open_issues_count} issues</a>
    <span class="repo-stat-sep">&middot;</span>
    <a class="repo-stat" href="${data.html_url}/network/members" target="_blank" rel="noopener noreferrer">${data.forks_count} forks</a>
    <span class="repo-stat-sep">&middot;</span>
    <a class="repo-stat" href="${data.html_url}/watchers" target="_blank" rel="noopener noreferrer">${data.watchers_count} watchers</a>
    <span class="repo-stat-sep">&middot;</span>
    <a class="repo-stat" href="https://github.com/brentspine/brents-toasts/commits/main/" target="_blank" rel="noopener noreferrer" title="${escapeHtml(new Date(data.pushed_at).toLocaleString())}">Last commit ${formatRelativeTime(data.pushed_at)}</a>
  `;
}

async function loadGithubRepoInfo() {
  try {
    const res = await fetch("https://api.github.com/repos/Brentspine/brents-toasts");
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    if (githubStarCount) githubStarCount.textContent = formatCompactCount(data.stargazers_count);
    renderRepoStats(data);
  } catch {
    if (githubStarCount) githubStarCount.textContent = "";
  }
}

async function loadVersionList() {
  if (!versionList) return;
  try {
    const res = await fetch("/brents-toasts/versions/versions.json");
    if (!res.ok) throw new Error(`status ${res.status}`);
    const versions = await res.json();
    versionList.innerHTML = `<li><a href="/brents-toasts">Latest</a></li>`;
    versionList.innerHTML += versions
      .slice()
      .reverse()
      .map((v) => {
        const safe = escapeHtml(String(v));
        return `<li><a href="/brents-toasts/versions/${safe}/">v${safe}</a></li>`;
      })
      .join("\n");
  } catch {
    versionList.textContent = "";
  }
}

function optionsTable(rows, firstColumnLabel = "Option") {
  const body = rows
    .map(
      (o) => `<tr>
        <td class="mono opt-name">${escapeHtml(o.name)}</td>
        <td class="mono opt-type">${escapeHtml(o.type)}</td>
        <td class="mono opt-default">${escapeHtml(o.default)}</td>
        <td>${escapeHtml(o.note)}</td>
      </tr>`
    )
    .join("");
  return `<table class="options-table">
    <thead><tr><th>${escapeHtml(firstColumnLabel)}</th><th>Type</th><th>Default</th><th>Notes</th></tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

function renderOptionsReference() {
  if (!optionsReference) return;
  optionsReference.innerHTML = [
    `<p class="muted">Per-call — <span class="mono">toasts.showToast(message, { ...these })</span> or <span class="mono">new ToastBuilder(message).with...().show()</span>:</p>`,
    optionsTable(TOAST_OPTION_DOCS),
    `<p class="muted">Library-wide — <span class="mono">toasts.configure({ ...these })</span>:</p>`,
    optionsTable(CONFIG_OPTION_DOCS),
    `<p class="muted">Ready-made action buttons — <span class="mono">toasts.xyz(...)</span>, appended to <span class="mono">buttons</span> (or a details item's own):</p>`,
    optionsTable(BUTTON_FACTORY_DOCS, "Method"),
  ].join("\n");
}

function resetPlaygroundCode() {
  if (!playgroundCode) return;
  playgroundCode.value = PLAYGROUND_DEFAULT_CODE;
}

function clearPlaygroundOutput() {
  if (!playgroundOutput) return;
  playgroundOutput.textContent = "";
  playgroundOutput.classList.remove("error");
}

function runPlaygroundCode() {
  if (!playgroundCode || !playgroundOutput) return;
  try {
    const fn = new Function("toasts", "ToastColor", "ToastPosition", "ToastAnimation", "ToastBuilder", playgroundCode.value);
    fn(toasts, ToastColor, ToastPosition, ToastAnimation, ToastBuilder);
    playgroundOutput.textContent = "Ran without errors.";
    playgroundOutput.classList.remove("error");
  } catch (err) {
    playgroundOutput.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
    playgroundOutput.classList.add("error");
  }
}

function wirePlayground() {
  if (!playgroundCode || !playgroundRunBtn || !playgroundResetBtn) return;
  resetPlaygroundCode();
  playgroundRunBtn.addEventListener("click", runPlaygroundCode);
  playgroundResetBtn.addEventListener("click", () => {
    resetPlaygroundCode();
    clearPlaygroundOutput();
  });
  playgroundCode.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.key !== "Enter") return;
    e.preventDefault();
    runPlaygroundCode();
  });
}

function showOneToast() {
  const style = apiStyle.value;
  const skipOverrides = useDefaults.checked;
  const message = contentType.value === "interactive" ? buildInteractiveContent() : readMessageRaw();

  const opts = {};
  const title = readTitle();
  if (title) opts.title = title;
  if (contentType.value === "html") opts.allowHtml = true;
  if (removeOthers.checked) opts.removeOtherToasts = true;
  const buttons = buildButtonsForToast();
  if (buttons) opts.buttons = buttons;
  const details = buildDetailsForToast();
  if (details) opts.details = details;
  if (!skipOverrides) {
    opts.color = colorValueForToast();
    opts.duration = readDuration();
    opts.closable = readClosable();
  }

  if (style === "builder") {
    const builder = new ToastBuilder(message);
    if (opts.title) builder.withTitle(opts.title);
    if (opts.allowHtml) builder.withAllowHtml(true);
    if (opts.removeOtherToasts) builder.andRemoveOtherToasts();
    if (opts.buttons) opts.buttons.forEach((b) => builder.withButton(b.label, b.onClick, b.className));
    if (opts.details) builder.withDetails(opts.details);
    if (!skipOverrides) {
      builder.withColor(opts.color).withDuration(opts.duration).withClosable(opts.closable);
    }
    builder.show();
  } else {
    toasts.showToast(message, opts);
  }
}

function showFiveToasts() {
  let i = 0;
  while (i < 5) {
    setTimeout(showOneToast, i*25);
    i += 1;
  }
}

function updateOverrideInputsDisabled() {
  const disabled = useDefaults.checked;
  presetColor.disabled = disabled;
  colorPicker.disabled = disabled;
  durationMs.disabled = disabled;
  closable.disabled = disabled;
}

// Quick-fill buttons — set the underlying fields and then behave like any
// other manual edit (no separate "preset mode" to fall out of sync with).
const CONTENT_PRESETS = {
  success: {
    contentType: "text",
    title: "Saved",
    text: "Your changes have been saved.",
    color: "SUCCESS",
  },
  html: {
    contentType: "html",
    title: "",
    text: "<b>Update available.</b> Refresh to apply.",
    color: "INFO",
  },
  undo: {
    contentType: "text",
    title: "Item deleted",
    text: "Your item has been removed.",
    color: "WARNING",
    duration: "6000",
    buttonPreset: "undo",
  },
  confirm: {
    contentType: "text",
    title: "3 items selected",
    text: "Ready to remove them?",
    color: "WARNING",
    duration: "0",
    buttonPreset: "confirm",
  },
  details: {
    contentType: "text",
    title: "Action Failed",
    text: "Account settings could not be updated.",
    color: "ERROR",
    duration: "0",
    buttonPreset: "details",
    removeOthers: true,
  },
};

function applyPreset(name) {
  const preset = CONTENT_PRESETS[name];
  contentType.value = preset.contentType;
  toastTitle.value = preset.title;
  toastText.value = preset.text;
  presetColor.value = preset.color;
  durationMs.value = preset.duration ?? "3000";
  removeOthers.checked = Boolean(preset.removeOthers);
  buttonPreset.value = preset.buttonPreset ?? "none";

  syncColorUIFromPreset();
  updateContentModeUI();
  updateButtonPresetUI();
  updateCodePreview();
}

function wirePreviewUpdates() {
  const update = () => updateCodePreview();

  toastText.addEventListener("input", update);
  toastTitle.addEventListener("input", update);
  durationMs.addEventListener("input", update);
  closable.addEventListener("change", update);
  removeOthers.addEventListener("change", update);
  apiStyle.addEventListener("change", update);

  contentType.addEventListener("change", () => {
    updateContentModeUI();
    updateCodePreview();
  });

  buttonPreset.addEventListener("change", () => {
    updateButtonPresetUI();
    updateCodePreview();
  });

  useDefaults.addEventListener("change", () => {
    updateOverrideInputsDisabled();
    updateCodePreview();
  });

  presetColor.addEventListener("change", () => {
    syncColorUIFromPreset();
    updateCodePreview();
  });

  colorPicker.addEventListener("input", () => {
    syncColorUIFromPicker();
    updateCodePreview();
  });

  presetSuccessBtn.addEventListener("click", () => applyPreset("success"));
  presetHtmlBtn.addEventListener("click", () => applyPreset("html"));
  presetUndoBtn.addEventListener("click", () => applyPreset("undo"));
  presetConfirmBtn.addEventListener("click", () => applyPreset("confirm"));
  presetDetailsBtn.addEventListener("click", () => applyPreset("details"));
}

function wireConfigUpdates() {
  const update = () => updateConfigCodePreview();

  configMaxToasts.addEventListener("input", update);
  configColor.addEventListener("change", update);
  configLanguage.addEventListener("change", update);
  configDuration.addEventListener("input", update);
  configClosable.addEventListener("change", update);

  applyConfigBtn.addEventListener("click", () => {
    applyPageConfig();
    updateConfigCodePreview();
  });
}

makeToast.addEventListener("click", showOneToast);
makeFive.addEventListener("click", showFiveToasts);

// init
presetColor.value = "INFO";
colorPicker.value = presetToHex6("INFO");
syncColorUIFromPreset();
updateOverrideInputsDisabled();
updateContentModeUI();
updateButtonPresetUI();
wirePreviewUpdates();
wireConfigUpdates();
applyPageConfig();
updateCodePreview();
updateConfigCodePreview();
loadChangelog();
loadVersionList();
loadGithubRepoInfo();
renderOptionsReference();
wirePlayground();
