(function () {
  "use strict";

  const VERSION = "0.1.0";

  const DEFAULT_SETTINGS = {
    enabled: true,
    scanEverywhere: false,
    hideMode: "collapse",
    strictness: "balanced",
    threshold: 4.5,
    showBadge: true,
    whitelistHandles: [],
    customPatterns: []
  };

  const DEFAULT_PATTERNS = [
    {
      id: "profile-hook",
      label: "profile hook",
      pattern: "(点我头像|看我头像|主页能打|主页[可真]?强|刷了半天.*主页)",
      score: 3.0
    },
    {
      id: "sexual-service-cn",
      label: "sexual spam",
      pattern: "(比她好看的没她骚|比她强的没她好看|线下\\s*(sao|骚)\\s*货|约[炮pP]|空降|外围|上门|裸聊|福利姬|擦边)",
      score: 3.6
    },
    {
      id: "broker-contact-cn",
      label: "contact broker",
      pattern: "(靠谱对接|真实可靠对接|在哪里.*联系|联系[人我]|找.{0,4}(联系人|资源)|推荐.*@)",
      score: 2.7
    },
    {
      id: "messenger-hook",
      label: "off-platform contact",
      pattern: "((加|看|私|找).{0,5}(微|vx|v信|tg|telegram|电报)|电报群|飞机群)",
      score: 3.2
    },
    {
      id: "spam-promo-cn",
      label: "promo spam",
      pattern: "(推特\\s*b?\\s*第一强|搬砖|引流|精准粉|接推广|刷粉|流量扶持)",
      score: 2.3
    },
    {
      id: "emoji-mention-lure",
      label: "emoji mention lure",
      pattern: "[👉👇👈💎🌈✅💚]\\s*@",
      score: 1.8
    }
  ];

  function getBrowserApi() {
    if (typeof chrome !== "undefined") {
      return chrome;
    }
    if (typeof browser !== "undefined") {
      return browser;
    }
    throw new Error("Browser extension API is not available");
  }

  function normalizeHandle(handle) {
    return String(handle || "")
      .trim()
      .replace(/^@+/, "")
      .toLowerCase();
  }

  function splitLines(value) {
    if (Array.isArray(value)) {
      return value.map(String).map((line) => line.trim()).filter(Boolean);
    }
    return String(value || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
  }

  function mergeSettings(value) {
    const settings = Object.assign({}, DEFAULT_SETTINGS, value || {});
    settings.threshold = Number.isFinite(Number(settings.threshold))
      ? Number(settings.threshold)
      : DEFAULT_SETTINGS.threshold;
    settings.whitelistHandles = splitLines(settings.whitelistHandles).map(normalizeHandle);
    settings.customPatterns = splitLines(settings.customPatterns);
    if (!["collapse", "hide", "dim"].includes(settings.hideMode)) {
      settings.hideMode = DEFAULT_SETTINGS.hideMode;
    }
    if (!["relaxed", "balanced", "aggressive"].includes(settings.strictness)) {
      settings.strictness = DEFAULT_SETTINGS.strictness;
    }
    return settings;
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function parsePatternLine(line) {
    const trimmed = String(line || "").trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return null;
    }

    const regexMatch = trimmed.match(/^\/(.+)\/([a-z]*)$/i);
    if (regexMatch) {
      const flags = Array.from(new Set((regexMatch[2] + "iu").split("")))
        .filter((flag) => "imsuv".includes(flag))
        .join("");
      return new RegExp(regexMatch[1], flags);
    }

    return new RegExp(escapeRegExp(trimmed), "iu");
  }

  window.XRJ = {
    VERSION,
    DEFAULT_SETTINGS,
    DEFAULT_PATTERNS,
    escapeRegExp,
    getBrowserApi,
    mergeSettings,
    normalizeHandle,
    parsePatternLine,
    splitLines
  };
})();
