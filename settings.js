/**
 * Shared, non-secret configuration helpers.
 *
 * API keys are stored in chrome.storage.local by options.js. This file contains
 * defaults and validation only, so it is safe to publish.
 */
var YTD_SETTINGS = (() => {
  const STORAGE_KEY = "ytd_settings";
  const DEFAULTS = Object.freeze({
    provider: "deepseek",
    aiApiKey: "",
    aiBaseUrl: "https://api.deepseek.com",
    aiModel: "deepseek-v4-flash",
    supadataApiKey: "",
  });

  function isLegacyCustom(input) {
    return !!input && input.provider === "custom";
  }

  function normalize(input = {}) {
    return {
      provider: DEFAULTS.provider,
      aiApiKey: isLegacyCustom(input)
        ? ""
        : typeof input.aiApiKey === "string"
          ? input.aiApiKey.trim()
          : "",
      aiBaseUrl: DEFAULTS.aiBaseUrl,
      aiModel: DEFAULTS.aiModel,
      supadataApiKey:
        typeof input.supadataApiKey === "string"
          ? input.supadataApiKey.trim()
          : "",
    };
  }

  function migrateLegacyCustom(input = {}) {
    return {
      settings: normalize(input),
      migrated: isLegacyCustom(input),
    };
  }

  function chatCompletionsUrl() {
    return `${DEFAULTS.aiBaseUrl}/chat/completions`;
  }

  function canonicalYouTubeUrl(videoId) {
    const normalized = String(videoId || "").trim();
    if (!VIDEO_ID_PATTERN.test(normalized)) {
      throw new Error("Invalid YouTube video ID.");
    }
    return `https://www.youtube.com/watch?v=${normalized}`;
  }

  const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{6,20}$/;

  function parseUrl(url) {
    try {
      return new URL(String(url || ""));
    } catch {
      return null;
    }
  }

  /** True for pages on www.youtube.com, where content.js runs. */
  function isYouTubePage(url) {
    const parsed = parseUrl(url);
    return parsed?.protocol === "https:" && parsed.hostname === "www.youtube.com";
  }

  /**
   * True for HackerTube (hackertube.org), a front end that embeds YouTube
   * videos and uses YouTube video IDs in its /watch/<id> URLs.
   */
  function isHackerTubePage(url) {
    const parsed = parseUrl(url);
    return (
      parsed?.protocol === "https:" &&
      (parsed.hostname === "hackertube.org" ||
        parsed.hostname === "www.hackertube.org")
    );
  }

  /** Pages the side panel can digest: YouTube itself or a supported mirror. */
  function isSupportedVideoPage(url) {
    return isYouTubePage(url) || isHackerTubePage(url);
  }

  /** Returns the YouTube video ID for a supported page URL, or null. */
  function extractVideoId(url) {
    const parsed = parseUrl(url);
    if (!parsed) return null;

    let id = null;
    if (isHackerTubePage(url)) {
      // Current links are /watch/<id>; older ones were /#/watch/<id>.
      const match =
        parsed.pathname.match(/^\/watch\/([^/]+)/) ||
        parsed.hash.match(/^#\/watch\/([^/?]+)/);
      id = match ? match[1] : null;
    } else if (parsed.hostname.endsWith("youtube.com") && parsed.searchParams.has("v")) {
      id = parsed.searchParams.get("v");
    } else if (parsed.hostname === "youtu.be") {
      id = parsed.pathname.slice(1);
    } else if (parsed.pathname.startsWith("/embed/")) {
      id = parsed.pathname.split("/")[2];
    }

    return id && VIDEO_ID_PATTERN.test(id) ? id : null;
  }

  const KEY_CHECK_TIMEOUT_MS = 10_000;

  /**
   * Checks one key against a free, read-only endpoint.
   * Returns "valid", "invalid" (401/403), or "unknown" (network error,
   * timeout, or any other status). Only "invalid" should block saving.
   */
  async function checkKey(url, headers, fetchImpl, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
      if (response.ok) return "valid";
      if (response.status === 401 || response.status === 403) return "invalid";
      return "unknown";
    } catch (_error) {
      return "unknown";
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Verifies both keys in parallel. Uses DeepSeek's model list and Supadata's
   * account info, neither of which spends tokens or transcript credits.
   */
  async function verifyApiKeys(
    { aiApiKey, supadataApiKey },
    { fetchImpl = globalThis.fetch, timeoutMs = KEY_CHECK_TIMEOUT_MS } = {},
  ) {
    const [deepseek, supadata] = await Promise.all([
      checkKey(
        `${DEFAULTS.aiBaseUrl}/models`,
        { Authorization: `Bearer ${aiApiKey}` },
        fetchImpl,
        timeoutMs,
      ),
      checkKey(
        "https://api.supadata.ai/v1/me",
        { "x-api-key": supadataApiKey },
        fetchImpl,
        timeoutMs,
      ),
    ]);
    return { deepseek, supadata };
  }

  return {
    STORAGE_KEY,
    verifyApiKeys,
    DEFAULTS,
    isLegacyCustom,
    normalize,
    migrateLegacyCustom,
    chatCompletionsUrl,
    canonicalYouTubeUrl,
    isYouTubePage,
    isHackerTubePage,
    isSupportedVideoPage,
    extractVideoId,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = YTD_SETTINGS;
}
