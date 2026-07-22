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
const apiStyle = $("apiStyle");
const useDefaults = $("useDefaults");
const presetColor = $("presetColor");
const colorPicker = $("colorPicker");
const colorHex = $("colorHex");
const durationMs = $("durationMs");
const closable = $("closable");
const makeToast = $("makeToast");
const makeFive = $("makeFive");
const codePreview = $("codePreview");
const changelogBox = $("changelog");
const versionList = $("versionList");

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

function updateCodePreview() {
  const msg = readMessageRaw();
  const style = apiStyle.value;
  const skipOverrides = useDefaults.checked;

  const needsColorImport = !skipOverrides;
  const importLine = style === "builder"
    ? needsColorImport
      ? `import { ToastBuilder, ToastColor } from "./__TOASTS_LIB__";`
      : `import { ToastBuilder } from "./__TOASTS_LIB__";`
    : `import { toasts, ToastColor } from "./__TOASTS_LIB__";`;

  let callLines;
  if (skipOverrides) {
    callLines = style === "builder"
      ? [`new ToastBuilder(${JSON.stringify(msg)}).show();`]
      : [`toasts.showToast(${JSON.stringify(msg)});`];
  } else {
    const dur = readDuration();
    const canClose = readClosable();
    const colorExpr = colorExprForPreview();

    callLines = style === "builder"
      ? [
        `new ToastBuilder(${JSON.stringify(msg)})`,
        `  .withColor(${colorExpr})`,
        `  .withDuration(${dur})`,
        `  .withClosable(${canClose})`,
        `  .show();`,
      ]
      : [`toasts.showToast(${JSON.stringify(msg)}, { color: ${colorExpr}, duration: ${dur}, closable: ${canClose} });`];
  }

  codePreview.textContent = [importLine, ``, ...callLines].join("\n");
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
  const msg = readMessageRaw();
  const style = apiStyle.value;
  const skipOverrides = useDefaults.checked;

  if (skipOverrides) {
    if (style === "builder") {
      new ToastBuilder(msg).show();
    } else {
      toasts.showToast(msg);
    }
    return;
  }

  const col = colorValueForToast();
  const dur = readDuration();
  const canClose = readClosable();

  if (style === "builder") {
    new ToastBuilder(msg).withColor(col).withDuration(dur).withClosable(canClose).show();
  } else {
    toasts.showToast(msg, { color: col, duration: dur, closable: canClose });
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

function wirePreviewUpdates() {
  const update = () => updateCodePreview();

  toastText.addEventListener("input", update);
  durationMs.addEventListener("input", update);
  closable.addEventListener("change", update);
  apiStyle.addEventListener("change", update);

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
wirePreviewUpdates();
wireConfigUpdates();
applyPageConfig();
updateCodePreview();
updateConfigCodePreview();
loadChangelog();
loadVersionList();
