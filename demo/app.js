import { toasts, ToastColor, ToastBuilder } from "./__TOASTS_LIB__";

const $ = (id) => document.getElementById(id);

const configMaxToasts = $("configMaxToasts");
const configColor = $("configColor");
const configDuration = $("configDuration");
const configClosable = $("configClosable");
const applyConfigBtn = $("applyConfig");
const configCodePreview = $("configCodePreview");
const maxToastsFooter = $("maxToastsFooter");

const toastText = $("toastText");
const toastTitle = $("toastTitle");
const contentType = $("contentType");
const contentTypeHint = $("contentTypeHint");
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
const makeToast = $("makeToast");
const makeFive = $("makeFive");
const codePreview = $("codePreview");
const changelogBox = $("changelog");
const versionList = $("versionList");

const CONTENT_TYPE_HINTS = {
  text: "Rendered as plain text — safe with untrusted input.",
  html: "Rendered via innerHTML — sanitize untrusted input yourself.",
  interactive: "A real DOM Node with a click handler — no innerHTML, no XSS surface.",
};

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

function applyPageConfig() {
  toasts.configure({
    maxToasts: readMaxToasts(),
    color: ToastColor[configColor.value],
    duration: readConfigDuration(),
    closable: configClosable.checked,
  });
  maxToastsFooter.textContent = String(readMaxToasts());
}

function updateConfigCodePreview() {
  const lines = [
    `toasts.configure({`,
    `  maxToasts: ${readMaxToasts()},`,
    `  color: ToastColor.${configColor.value},`,
    `  duration: ${readConfigDuration()},`,
    `  closable: ${configClosable.checked},`,
    `});`,
  ];
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
// directly, so it's interactive and needs no innerHTML/allowHtml at all.
function buildUndoContent() {
  const content = document.createElement("span");
  content.textContent = "Item deleted. ";
  const undoBtn = document.createElement("button");
  undoBtn.textContent = "Undo";
  undoBtn.onclick = () => toasts.showToast("Restored!", ToastColor.SUCCESS);
  content.appendChild(undoBtn);
  return content;
}

function updateContentModeUI() {
  const mode = contentType.value;
  toastText.disabled = mode === "interactive";
  contentTypeHint.textContent = CONTENT_TYPE_HINTS[mode];
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

  const names = new Set(style === "builder" ? ["ToastBuilder"] : ["toasts"]);
  if (isInteractive || pairs.some(([key]) => key === "color")) names.add("ToastColor");
  if (isInteractive) names.add("toasts");

  const lines = [`import { ${Array.from(names).join(", ")} } from "./__TOASTS_LIB__";`, ``];

  let msgExpr;
  if (isInteractive) {
    lines.push(
      `const content = document.createElement('span');`,
      `content.textContent = 'Item deleted. ';`,
      `const undoBtn = document.createElement('button');`,
      `undoBtn.textContent = 'Undo';`,
      `undoBtn.onclick = () => toasts.showToast('Restored!', ToastColor.SUCCESS);`,
      `content.appendChild(undoBtn);`,
      ``,
    );
    msgExpr = "content";
  } else {
    msgExpr = JSON.stringify(readMessageRaw());
  }

  if (style === "builder") {
    lines.push(`new ToastBuilder(${msgExpr})`, ...pairs.map(builderMethodLine), `  .show();`);
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

function renderChangelogMarkdown(md) {
  const html = [];
  let inList = false;
  const closeList = () => {
    if (inList) html.push("</ul>");
    inList = false;
  };

  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("### ")) {
      closeList();
      html.push(`<h4>${escapeHtml(line.slice(4))}</h4>`);
    } else if (line.startsWith("# ")) {
      closeList();
      html.push(`<h3>${escapeHtml(line.slice(2))}</h3>`);
    } else if (line.startsWith("- ")) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${escapeHtml(line.slice(2))}</li>`);
    } else if (line.length) {
      closeList();
      html.push(`<p>${escapeHtml(line)}</p>`);
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

function showOneToast() {
  const style = apiStyle.value;
  const skipOverrides = useDefaults.checked;
  const message = contentType.value === "interactive" ? buildUndoContent() : readMessageRaw();

  const opts = {};
  const title = readTitle();
  if (title) opts.title = title;
  if (contentType.value === "html") opts.allowHtml = true;
  if (removeOthers.checked) opts.removeOtherToasts = true;
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
    contentType: "interactive",
    title: "Item deleted",
    text: "",
    color: "WARNING",
    duration: "6000",
  },
};

function applyPreset(name) {
  const preset = CONTENT_PRESETS[name];
  contentType.value = preset.contentType;
  toastTitle.value = preset.title;
  toastText.value = preset.text;
  presetColor.value = preset.color;
  if (preset.duration) durationMs.value = preset.duration;

  syncColorUIFromPreset();
  updateContentModeUI();
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
}

function wireConfigUpdates() {
  const update = () => updateConfigCodePreview();

  configMaxToasts.addEventListener("input", update);
  configColor.addEventListener("change", update);
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
wirePreviewUpdates();
wireConfigUpdates();
applyPageConfig();
updateCodePreview();
updateConfigCodePreview();
loadChangelog();
loadVersionList();
