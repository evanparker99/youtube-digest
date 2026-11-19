/**
 * EMBEDDED PLAYER BRIDGE
 *
 * HackerTube (hackertube.org) plays videos in a youtube-nocookie.com iframe.
 * This script runs inside that iframe so the side panel can follow playback
 * and seek to a timestamp. It only answers getCurrentTime and seekTo, adds
 * nothing to the page, and does nothing when the player is embedded anywhere
 * other than HackerTube.
 */
(() => {
  const SUPPORTED_PARENT_ORIGINS = new Set([
    "https://hackertube.org",
    "https://www.hackertube.org",
  ]);

  function isEmbeddedOnSupportedSite() {
    if (window.top === window) return false;
    const ancestors = window.location.ancestorOrigins;
    // ancestorOrigins[0] is the page that directly embeds this frame.
    return !!ancestors && ancestors.length > 0 &&
      SUPPORTED_PARENT_ORIGINS.has(ancestors[0]);
  }

  if (!isEmbeddedOnSupportedSite()) return;

  function findVideo() {
    return (
      document.querySelector("video.html5-main-video") ||
      document.querySelector("video")
    );
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.action === "getCurrentTime") {
      const video = findVideo();
      sendResponse({
        currentTime: video ? Math.floor(video.currentTime) : 0,
        paused: video ? video.paused : true,
      });
      return false;
    }

    if (message?.action === "seekTo") {
      const video = findVideo();
      const seconds = Number(message.seconds);
      if (!video || !Number.isFinite(seconds) || seconds < 0) {
        sendResponse({ success: false, error: "No video to seek" });
        return false;
      }
      video.currentTime = seconds;
      if (video.paused) video.play().catch(() => {});
      sendResponse({ success: true });
      return false;
    }

    // Leave every other action unanswered so this frame never claims it.
    return false;
  });
})();
