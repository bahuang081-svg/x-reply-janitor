(function () {
  "use strict";

  const XRJ = window.XRJ;
  const api = XRJ.getBrowserApi();
  const ARTICLE_SELECTOR = 'article[data-testid="tweet"]';
  const USER_HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;
  const EXCLUDED_PATHS = new Set([
    "compose",
    "explore",
    "hashtag",
    "home",
    "i",
    "messages",
    "notifications",
    "search",
    "settings"
  ]);

  let settings = XRJ.mergeSettings();
  let compiledRules = [];
  let observer = null;
  let scheduled = 0;
  let urlKey = location.href;
  let scanSeq = 0;
  let articleId = 0;
  let stats = {
    total: 0,
    scanned: 0,
    hidden: 0,
    dimmed: 0,
    lastScanAt: 0
  };

  let revealed = new WeakSet();

  function init() {
    loadSettings().then(() => {
      patchHistory();
      installObserver();
      installMessageHandler();
      scheduleScan("init");
      window.addEventListener("xrj:urlchange", resetForNavigation, true);
      window.addEventListener("popstate", resetForNavigation, true);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) scheduleScan("visible");
      });
    });
  }

  function loadSettings() {
    return new Promise((resolve) => {
      api.storage.sync.get(XRJ.DEFAULT_SETTINGS, (value) => {
        settings = XRJ.mergeSettings(value);
        compiledRules = compileRules(settings);
        resolve();
      });
    });
  }

  function installMessageHandler() {
    api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || !message.type) return false;
      if (message.type === "XRJ_GET_STATS") {
        sendResponse({ ok: true, stats });
        return false;
      }
      if (message.type === "XRJ_RESCAN") {
        scheduleScan("popup");
        sendResponse({ ok: true, stats });
        return false;
      }
      if (message.type === "XRJ_REVEAL_PAGE") {
        revealPage();
        sendResponse({ ok: true, stats });
        return false;
      }
      return false;
    });

    api.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      const next = Object.assign({}, settings);
      Object.keys(changes).forEach((key) => {
        next[key] = changes[key].newValue;
      });
      settings = XRJ.mergeSettings(next);
      compiledRules = compileRules(settings);
      clearMarks();
      scheduleScan("settings");
    });
  }

  function patchHistory() {
    if (window.__xrjHistoryPatched) return;
    window.__xrjHistoryPatched = true;
    ["pushState", "replaceState"].forEach((method) => {
      const original = history[method];
      history[method] = function patchedHistoryMethod() {
        const result = original.apply(this, arguments);
        window.dispatchEvent(new Event("xrj:urlchange"));
        return result;
      };
    });
  }

  function resetForNavigation() {
    if (urlKey === location.href) return;
    urlKey = location.href;
    revealed = new WeakSet();
    clearMarks();
    scheduleScan("navigation");
  }

  function installObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(() => scheduleScan("mutation"));
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function scheduleScan() {
    if (scheduled) return;
    scheduled = window.setTimeout(() => {
      scheduled = 0;
      scanPage();
    }, 180);
  }

  function scanPage() {
    scanSeq += 1;

    if (!settings.enabled) {
      clearMarks();
      updateStats(0, 0, 0, 0);
      return;
    }

    const articles = Array.from(document.querySelectorAll(ARTICLE_SELECTOR));
    const candidates = articles
      .map((article, index) => ({ article, index, data: extractTweet(article) }))
      .filter((item) => shouldScan(item.article, item.index, articles.length));

    const fingerprintCounts = buildFingerprintCounts(candidates);
    let hidden = 0;
    let dimmed = 0;

    candidates.forEach((item) => {
      const result = analyzeTweet(item.data, fingerprintCounts);
      item.article.dataset.xrjScan = String(scanSeq);

      if (result.score >= getThreshold() && !revealed.has(item.article)) {
        applyBlock(item.article, result, item.data);
        if (settings.hideMode === "dim") dimmed += 1;
        else hidden += 1;
      } else {
        restoreArticle(item.article);
      }
    });

    articles.forEach((article) => {
      if (article.dataset.xrjScan !== String(scanSeq)) {
        restoreArticle(article);
      }
    });

    updateStats(articles.length, candidates.length, hidden, dimmed);
  }

  function shouldScan(article, index, total) {
    if (!article || total <= 1) return false;
    if (article.closest('[data-testid="cellInnerDiv"] [role="dialog"]')) return false;
    if (settings.scanEverywhere) return true;
    if (!isStatusPage()) return false;
    return index > 0;
  }

  function isStatusPage() {
    return /\/status\/\d+/.test(location.pathname);
  }

  function extractTweet(article) {
    const textEl = article.querySelector('[data-testid="tweetText"]');
    const userEl = article.querySelector('[data-testid="User-Name"]');
    const text = normalizeText(textEl ? textEl.innerText : "");
    const userText = normalizeText(userEl ? userEl.innerText : "");
    const handle = extractHandle(article, userText);
    const mentions = extractMentions(textEl, text);
    const timeEl = article.querySelector("time");

    return {
      text,
      userText,
      handle,
      mentions,
      mentionCount: mentions.length,
      ageMinutes: parseAgeMinutes(timeEl),
      fingerprint: makeFingerprint(text)
    };
  }

  function normalizeText(value) {
    return String(value || "")
      .replace(/\u200b/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function extractHandle(article, userText) {
    const fromUserText = userText.match(/@([A-Za-z0-9_]{1,15})/);
    if (fromUserText) return XRJ.normalizeHandle(fromUserText[1]);

    const links = Array.from(article.querySelectorAll('a[href^="/"]'));
    for (const link of links) {
      const path = new URL(link.getAttribute("href"), location.origin).pathname;
      const first = path.split("/").filter(Boolean)[0] || "";
      if (USER_HANDLE_RE.test(first) && !EXCLUDED_PATHS.has(first.toLowerCase())) {
        return XRJ.normalizeHandle(first);
      }
    }
    return "";
  }

  function extractMentions(textEl, text) {
    const values = new Set();
    if (textEl) {
      textEl.querySelectorAll('a[href^="/"]').forEach((link) => {
        const value = normalizeText(link.innerText).replace(/^@/, "");
        if (USER_HANDLE_RE.test(value)) values.add(XRJ.normalizeHandle(value));
      });
    }
    const matches = text.match(/(^|[^\w])@([A-Za-z0-9_]{1,15})/g) || [];
    matches.forEach((match) => {
      const handle = match.replace(/^[^@]*@/, "");
      if (USER_HANDLE_RE.test(handle)) values.add(XRJ.normalizeHandle(handle));
    });
    return Array.from(values);
  }

  function parseAgeMinutes(timeEl) {
    if (!timeEl || !timeEl.dateTime) return null;
    const value = Date.parse(timeEl.dateTime);
    if (!Number.isFinite(value)) return null;
    return Math.max(0, Math.round((Date.now() - value) / 60000));
  }

  function makeFingerprint(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, "")
      .replace(/@[a-z0-9_]{1,15}/g, "@")
      .replace(/[^\p{Letter}\p{Number}@]+/gu, "")
      .slice(0, 80);
  }

  function buildFingerprintCounts(candidates) {
    const counts = new Map();
    candidates.forEach(({ data }) => {
      if (!data.fingerprint || data.fingerprint.length < 8) return;
      counts.set(data.fingerprint, (counts.get(data.fingerprint) || 0) + 1);
    });
    return counts;
  }

  function compileRules(currentSettings) {
    const rules = XRJ.DEFAULT_PATTERNS.map((rule) => ({
      label: rule.label,
      score: rule.score,
      regex: new RegExp(rule.pattern, "iu")
    }));

    XRJ.splitLines(currentSettings.customPatterns).forEach((line) => {
      try {
        const regex = XRJ.parsePatternLine(line);
        if (regex) {
          rules.push({
            label: "custom rule",
            score: 3.0,
            regex
          });
        }
      } catch (_error) {
        // Invalid custom rules are ignored here and shown in the options page.
      }
    });

    return rules;
  }

  function analyzeTweet(data, fingerprintCounts) {
    const reasons = [];
    let score = 0;
    const text = data.text || "";
    const handle = data.handle || "";

    if (settings.whitelistHandles.includes(handle)) {
      return { score: 0, reasons: ["whitelisted"] };
    }

    compiledRules.forEach((rule) => {
      if (rule.regex.test(text)) {
        score += rule.score;
        reasons.push(rule.label);
      }
    });

    if (data.mentionCount > 0) {
      const mentionScore = Math.min(2.6, 0.9 + data.mentionCount * 0.65);
      score += mentionScore;
      reasons.push("mention lure");
    }

    if (data.mentionCount > 0 && text.length <= 42) {
      score += 1.4;
      reasons.push("short mention reply");
    }

    if (/@[A-Za-z0-9_]{1,15}\s*[_a-zA-Z0-9]*\s*$/.test(text) && text.length <= 90) {
      score += 1.0;
      reasons.push("trailing mention");
    }

    if (/[a-z]{3,}\d{2,}[a-z0-9_]*$/i.test(handle)) {
      score += 1.0;
      reasons.push("random-looking handle");
    }

    if (handle.includes("_") && /\d/.test(handle)) {
      score += 0.7;
      reasons.push("handle digits");
    }

    if (handle.length >= 13 && /[a-z]/i.test(handle) && /\d/.test(handle)) {
      score += 0.8;
      reasons.push("long mixed handle");
    }

    const duplicateCount = fingerprintCounts.get(data.fingerprint) || 0;
    if (duplicateCount >= 2) {
      score += Math.min(2.2, duplicateCount * 0.8);
      reasons.push("duplicate copy");
    }

    if (data.ageMinutes !== null && data.ageMinutes <= 8 && data.mentionCount > 0) {
      score += 0.6;
      reasons.push("fresh mention reply");
    }

    if (settings.strictness === "aggressive") {
      score += data.mentionCount > 0 ? 0.9 : 0.25;
    } else if (settings.strictness === "relaxed") {
      score -= 0.8;
    }

    return {
      score: Math.max(0, score),
      reasons: Array.from(new Set(reasons))
    };
  }

  function getThreshold() {
    const base = Number(settings.threshold) || XRJ.DEFAULT_SETTINGS.threshold;
    if (settings.strictness === "aggressive") return Math.max(2.5, base - 0.6);
    if (settings.strictness === "relaxed") return base + 0.6;
    return base;
  }

  function applyBlock(article, result, data) {
    const reasonText = result.reasons.slice(0, 3).join(", ") || "rule match";
    article.dataset.xrjScore = result.score.toFixed(1);
    article.dataset.xrjReasons = reasonText;

    if (settings.hideMode === "dim") {
      article.dataset.xrjDimmed = "true";
      article.removeAttribute("data-xrj-hidden");
      removePlaceholder(article);
      return;
    }

    article.dataset.xrjHidden = "true";
    article.removeAttribute("data-xrj-dimmed");

    if (settings.hideMode === "hide") {
      removePlaceholder(article);
      return;
    }

    ensurePlaceholder(article, result, data, reasonText);
  }

  function ensurePlaceholder(article, result, data, reasonText) {
    if (!article.dataset.xrjId) {
      article.dataset.xrjId = String(++articleId);
    }

    let placeholder = article.previousElementSibling;
    if (!placeholder || placeholder.dataset.xrjFor !== article.dataset.xrjId) {
      placeholder = document.createElement("div");
      placeholder.className = "xrj-placeholder";
      placeholder.dataset.xrjFor = article.dataset.xrjId;

      const row = document.createElement("div");
      row.className = "xrj-placeholder-row";

      const message = document.createElement("div");
      message.className = "xrj-reason";

      const strong = document.createElement("strong");
      strong.textContent = "已折叠疑似机器人回复";
      message.appendChild(strong);

      const detail = document.createElement("span");
      detail.textContent = " ";
      message.appendChild(detail);

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "显示";
      button.addEventListener("click", () => {
        revealed.add(article);
        restoreArticle(article);
      });

      row.append(message, button);
      placeholder.appendChild(row);
      article.parentNode.insertBefore(placeholder, article);
    }

    const detail = placeholder.querySelector(".xrj-reason span");
    const handle = data.handle ? ` @${data.handle}` : "";
    detail.textContent = `${handle} · 分数 ${result.score.toFixed(1)} · ${reasonText}`;
  }

  function restoreArticle(article) {
    article.removeAttribute("data-xrj-hidden");
    article.removeAttribute("data-xrj-dimmed");
    article.removeAttribute("data-xrj-score");
    article.removeAttribute("data-xrj-reasons");
    removePlaceholder(article);
  }

  function removePlaceholder(article) {
    const previous = article.previousElementSibling;
    if (previous && previous.classList.contains("xrj-placeholder")) {
      previous.remove();
    }
  }

  function clearMarks() {
    document.querySelectorAll(`${ARTICLE_SELECTOR}[data-xrj-hidden], ${ARTICLE_SELECTOR}[data-xrj-dimmed]`)
      .forEach(restoreArticle);
    document.querySelectorAll(".xrj-placeholder").forEach((node) => node.remove());
    updateStats(0, 0, 0, 0);
  }

  function revealPage() {
    document.querySelectorAll(`${ARTICLE_SELECTOR}[data-xrj-hidden], ${ARTICLE_SELECTOR}[data-xrj-dimmed]`)
      .forEach((article) => {
        revealed.add(article);
        restoreArticle(article);
      });
    updateStats(stats.total, stats.scanned, 0, 0);
  }

  function updateStats(total, scanned, hidden, dimmed) {
    stats = {
      total,
      scanned,
      hidden,
      dimmed,
      lastScanAt: Date.now()
    };
    updateBadge();
  }

  function ensureBadge() {
    let badge = document.querySelector(".xrj-badge");
    if (badge) return badge;

    badge = document.createElement("div");
    badge.className = "xrj-badge";
    badge.setAttribute("role", "status");

    const text = document.createElement("span");
    text.className = "xrj-badge-text";

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "恢复";
    button.addEventListener("click", revealPage);

    badge.append(text, button);
    document.documentElement.appendChild(badge);
    return badge;
  }

  function updateBadge() {
    const badge = ensureBadge();
    const count = stats.hidden + stats.dimmed;
    badge.dataset.visible = String(settings.showBadge && count > 0);
    const text = badge.querySelector(".xrj-badge-text");
    if (text) {
      text.textContent = `XRJ ${count}`;
    }
  }

  init();
})();
