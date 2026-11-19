const test = require("node:test");
const assert = require("node:assert/strict");

const settings = require("../settings.js");

test("DeepSeek defaults use V4 Flash", () => {
  const normalized = settings.normalize({
    provider: "unexpected",
    aiApiKey: "  example-key  ",
    aiBaseUrl: "https://api.example.com/v1",
    aiModel: "example-model",
    supadataApiKey: "  example-supadata  ",
  });

  assert.equal(normalized.provider, "deepseek");
  assert.equal(normalized.aiBaseUrl, "https://api.deepseek.com");
  assert.equal(normalized.aiModel, "deepseek-v4-flash");
  assert.equal(normalized.aiApiKey, "example-key");
  assert.equal(normalized.supadataApiKey, "example-supadata");
  assert.equal(
    settings.chatCompletionsUrl(),
    "https://api.deepseek.com/chat/completions",
  );
});

test("legacy custom migration clears only the AI key and is idempotent", () => {
  const legacy = {
    provider: "custom",
    aiApiKey: "custom-secret",
    aiBaseUrl: "https://api.example.com/v1",
    aiModel: "example-model",
    supadataApiKey: " supadata-secret ",
  };
  const first = settings.migrateLegacyCustom(legacy);

  assert.equal(first.migrated, true);
  assert.equal(first.settings.provider, "deepseek");
  assert.equal(first.settings.aiBaseUrl, settings.DEFAULTS.aiBaseUrl);
  assert.equal(first.settings.aiModel, settings.DEFAULTS.aiModel);
  assert.equal(first.settings.aiApiKey, "");
  assert.equal(first.settings.supadataApiKey, "supadata-secret");

  const second = settings.migrateLegacyCustom(first.settings);
  assert.equal(second.migrated, false);
  assert.deepEqual(second.settings, first.settings);

  const configuredDeepSeek = settings.normalize({
    ...first.settings,
    aiApiKey: "new-deepseek-key",
  });
  assert.equal(configuredDeepSeek.aiApiKey, "new-deepseek-key");
});

test("Supadata receives a canonical YouTube URL", () => {
  assert.equal(
    settings.canonicalYouTubeUrl("ydTeb_I0b94"),
    "https://www.youtube.com/watch?v=ydTeb_I0b94",
  );
  assert.throws(
    () => settings.canonicalYouTubeUrl('"><script>'),
    /Invalid YouTube video ID/,
  );
});

test("video pages: YouTube and HackerTube are supported, others are not", () => {
  assert.equal(settings.isSupportedVideoPage("https://www.youtube.com/watch?v=yY96hTb8WgI"), true);
  assert.equal(settings.isSupportedVideoPage("https://hackertube.org/watch/yY96hTb8WgI"), true);
  assert.equal(settings.isSupportedVideoPage("https://www.hackertube.org/"), true);
  assert.equal(settings.isSupportedVideoPage("https://hackertube.org.evil.example/watch/yY96hTb8WgI"), false);
  assert.equal(settings.isSupportedVideoPage("http://hackertube.org/watch/yY96hTb8WgI"), false);
  assert.equal(settings.isSupportedVideoPage("https://example.com/"), false);
  assert.equal(settings.isSupportedVideoPage(""), false);
  assert.equal(settings.isYouTubePage("https://hackertube.org/watch/yY96hTb8WgI"), false);
});

test("extractVideoId reads YouTube and HackerTube URLs", () => {
  const id = "yY96hTb8WgI";
  assert.equal(settings.extractVideoId(`https://www.youtube.com/watch?v=${id}&t=30s`), id);
  assert.equal(settings.extractVideoId(`https://youtu.be/${id}`), id);
  assert.equal(settings.extractVideoId(`https://www.youtube.com/embed/${id}`), id);
  assert.equal(settings.extractVideoId(`https://hackertube.org/watch/${id}`), id);
  assert.equal(settings.extractVideoId(`https://hackertube.org/watch/${id}?ref=home`), id);
  assert.equal(settings.extractVideoId(`https://hackertube.org/#/watch/${id}`), id);
  assert.equal(settings.extractVideoId("https://hackertube.org/"), null);
  assert.equal(settings.extractVideoId("https://hackertube.org/watch/bad<id>"), null);
  assert.equal(settings.extractVideoId("https://www.youtube.com/"), null);
});
