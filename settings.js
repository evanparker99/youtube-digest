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

  return {
    STORAGE_KEY,
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
