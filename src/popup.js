(function () {
  "use strict";

  const XRJ = window.XRJ;
  const api = XRJ.getBrowserApi();

  const els = {
    enabled: document.getElementById("enabled"),
    strictness: document.getElementById("strictness"),
    hideMode: document.getElementById("hide-mode"),
    scanEverywhere: document.getElementById("scan-everywhere"),
    hiddenCount: document.getElementById("hidden-count"),
    scannedCount: document.getElementById("scanned-count"),
    pageState: document.getElementById("page-state"),
    rescan: document.getElementById("rescan"),
    reveal: document.getElementById("reveal"),
    options: document.getElementById("options")
  };

  let settings = XRJ.mergeSettings();

  init();

  function init() {
    api.storage.sync.get(XRJ.DEFAULT_SETTINGS, (value) => {
      settings = XRJ.mergeSettings(value);
      renderSettings();
      loadStats();
    });

    els.enabled.addEventListener("change", saveFromControls);
    els.strictness.addEventListener("change", saveFromControls);
    els.hideMode.addEventListener("change", saveFromControls);
    els.scanEverywhere.addEventListener("change", saveFromControls);
    els.rescan.addEventListener("click", () => sendToActiveTab("XRJ_RESCAN"));
    els.reveal.addEventListener("click", () => sendToActiveTab("XRJ_REVEAL_PAGE"));
    els.options.addEventListener("click", () => api.runtime.openOptionsPage());
  }

  function renderSettings() {
    els.enabled.checked = settings.enabled;
    els.strictness.value = settings.strictness;
    els.hideMode.value = settings.hideMode;
    els.scanEverywhere.checked = settings.scanEverywhere;
  }

  function saveFromControls() {
    settings = XRJ.mergeSettings(Object.assign({}, settings, {
      enabled: els.enabled.checked,
      strictness: els.strictness.value,
      hideMode: els.hideMode.value,
      scanEverywhere: els.scanEverywhere.checked
    }));
    api.storage.sync.set(settings, () => {
      window.setTimeout(loadStats, 120);
    });
  }

  function loadStats() {
    sendToActiveTab("XRJ_GET_STATS");
  }

  function sendToActiveTab(type) {
    api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !tab.id || !/^https?:\/\/(x|twitter)\.com\//.test(tab.url || "")) {
        renderStats(null);
        return;
      }

      api.tabs.sendMessage(tab.id, { type }, (response) => {
        if (api.runtime.lastError) {
          renderStats(null);
          return;
        }
        renderStats(response && response.stats);
      });
    });
  }

  function renderStats(value) {
    if (!value) {
      els.pageState.textContent = "只在 x.com / twitter.com 页面生效";
      els.hiddenCount.textContent = "0";
      els.scannedCount.textContent = "0";
      return;
    }

    const blocked = Number(value.hidden || 0) + Number(value.dimmed || 0);
    els.hiddenCount.textContent = String(blocked);
    els.scannedCount.textContent = String(value.scanned || 0);
    els.pageState.textContent = value.lastScanAt
      ? "当前页面已扫描"
      : "等待当前页面...";
  }
})();
