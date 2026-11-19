const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "embed.js"), "utf8");

function loadEmbed({ parentOrigin, isTop = false, video }) {
  let listener = null;
  const window = {
    location: { ancestorOrigins: parentOrigin ? [parentOrigin] : [] },
  };
  window.top = isTop ? window : {};
  const sandbox = {
    window,
    document: { querySelector: () => video || null },
    chrome: {
      runtime: { onMessage: { addListener: (fn) => (listener = fn) } },
    },
  };
  vm.runInNewContext(source, sandbox);
  return {
    listener,
    send(message) {
      let response;
      listener(message, {}, (value) => (response = value));
      return response;
    },
  };
}

test("embed bridge reports playback time inside HackerTube", () => {
  const video = { currentTime: 92.7, paused: false };
  const embed = loadEmbed({ parentOrigin: "https://hackertube.org", video });

  assert.deepEqual(
    JSON.parse(JSON.stringify(embed.send({ action: "getCurrentTime" }))),
    { currentTime: 92, paused: false },
  );
});

test("embed bridge seeks and resumes a paused video", () => {
  let played = false;
  const video = {
    currentTime: 0,
    paused: true,
    play: () => {
      played = true;
      return Promise.resolve();
    },
  };
  const embed = loadEmbed({ parentOrigin: "https://www.hackertube.org", video });

  assert.equal(embed.send({ action: "seekTo", seconds: 125 }).success, true);
  assert.equal(video.currentTime, 125);
  assert.equal(played, true);
  assert.equal(embed.send({ action: "seekTo", seconds: -1 }).success, false);
});

test("embed bridge ignores other sites, top-level pages and other actions", () => {
  assert.equal(loadEmbed({ parentOrigin: "https://example.com" }).listener, null);
  assert.equal(loadEmbed({ parentOrigin: "" }).listener, null);
  assert.equal(
    loadEmbed({ parentOrigin: "https://hackertube.org", isTop: true }).listener,
    null,
  );

  const embed = loadEmbed({ parentOrigin: "https://hackertube.org" });
  assert.equal(embed.send({ action: "getVideoInfo" }), undefined);
});
