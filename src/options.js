(function () {
  "use strict";

  const XRJ = window.XRJ;
  const api = XRJ.getBrowserApi();

  const els = {
    threshold: document.getElementById("threshold"),
    thresholdValue: document.getElementById("threshold-value"),
    showBadge: document.getElementById("show-badge"),
    whitelist: document.getElementById("whitelist"),
    customPatterns: document.getElementById("custom-patterns"),
    validation: document.getElementById("validation"),
    defaultRules: document.getElementById("default-rules"),
    save: document.getElementById("save"),
    reset: document.getElementById("reset"),
    export: document.getElementById("export"),
    importFile: document.getElementById("import-file"),
    status: document.getElementById("status")
  };

  let settings = XRJ.mergeSettings();

  init();

  function init() {
    renderDefaultRules();
    api.storage.sync.get(XRJ.DEFAULT_SETTINGS, (value) => {
      settings = XRJ.mergeSettings(value);
      renderSettings();
    });

    els.threshold.addEventListener("input", () => {
      els.thresholdValue.value = Number(els.threshold.value).toFixed(1);
    });
    els.customPatterns.addEventListener("input", validateCustomPatterns);
    els.save.addEventListener("click", save);
    els.reset.addEventListener("click", reset);
    els.export.addEventListener("click", exportSettings);
    els.importFile.addEventListener("change", importSettings);
  }

  function renderSettings() {
    els.threshold.value = String(settings.threshold);
    els.thresholdValue.value = Number(settings.threshold).toFixed(1);
    els.showBadge.value = String(Boolean(settings.showBadge));
    els.whitelist.value = settings.whitelistHandles.map((handle) => `@${handle}`).join("\n");
    els.customPatterns.value = settings.customPatterns.join("\n");
    validateCustomPatterns();
  }

  function renderDefaultRules() {
    els.defaultRules.textContent = "";
    XRJ.DEFAULT_PATTERNS.forEach((rule) => {
      const li = document.createElement("li");
      const title = document.createElement("strong");
      const body = document.createElement("span");
      title.textContent = `${rule.label} (+${rule.score})`;
      body.textContent = rule.pattern;
      li.append(title, body);
      els.defaultRules.appendChild(li);
    });
  }

  function readControls() {
    return XRJ.mergeSettings(Object.assign({}, settings, {
      threshold: Number(els.threshold.value),
      showBadge: els.showBadge.value === "true",
      whitelistHandles: XRJ.splitLines(els.whitelist.value).map(XRJ.normalizeHandle),
      customPatterns: XRJ.splitLines(els.customPatterns.value)
    }));
  }

  function validateCustomPatterns() {
    const lines = XRJ.splitLines(els.customPatterns.value);
    const errors = [];
    lines.forEach((line, index) => {
      try {
        XRJ.parsePatternLine(line);
      } catch (error) {
        errors.push(`${index + 1}: ${error.message}`);
      }
    });

    if (errors.length) {
      els.validation.dataset.error = "true";
      els.validation.textContent = `正则有误：${errors.join("; ")}`;
      return false;
    }

    els.validation.dataset.error = "false";
    els.validation.textContent = lines.length
      ? `已载入 ${lines.length} 条自定义规则`
      : "每行一个关键词，或使用 /regex/i";
    return true;
  }

  function save() {
    if (!validateCustomPatterns()) return;
    settings = readControls();
    api.storage.sync.set(settings, () => {
      flash("已保存");
    });
  }

  function reset() {
    settings = XRJ.mergeSettings();
    api.storage.sync.set(settings, () => {
      renderSettings();
      flash("已恢复默认");
    });
  }

  function exportSettings() {
    const blob = new Blob([JSON.stringify(readControls(), null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "x-reply-janitor-settings.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function importSettings(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        settings = XRJ.mergeSettings(JSON.parse(String(reader.result || "{}")));
        renderSettings();
        save();
      } catch (error) {
        flash(`导入失败：${error.message}`);
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  function flash(message) {
    els.status.textContent = message;
    window.setTimeout(() => {
      if (els.status.textContent === message) {
        els.status.textContent = "";
      }
    }, 1800);
  }
})();
