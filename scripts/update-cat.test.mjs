import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rmdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPublicData, prepareActivity, renderScenes, updateCat } from "./update-cat.mjs";
import { buildSvg } from "./vendor/tomo/render.ts";
import { VALID_STATES } from "./vendor/tomo/state.ts";

const now = new Date("2026-10-06T08:00:00Z");
const repo = { private: false, full_name: "Sevrenaie/Agent_Platform", owner: { login: "Sevrenaie" } };
const event = {
  public: true, type: "PushEvent", created_at: "2026-10-06T07:00:00Z",
  repo: { name: repo.full_name }, actor: { login: "Sevrenaie" },
};

test("requests only public, owner-specific API endpoints", async () => {
  const urls = [];
  await getPublicData(async (url, options) => {
    urls.push(url);
    assert.equal(options.headers.Authorization, "Bearer test-token");
    return { ok: true, json: async () => [] };
  }, "test-token");
  assert.deepEqual(urls, [
    "https://api.github.com/users/Sevrenaie/events/public?per_page=100",
    "https://api.github.com/users/Sevrenaie/repos?type=owner&per_page=100",
  ]);
});

test("excludes private, foreign, future, bot and profile-update activity", () => {
  const secret = { ...repo, private: true, full_name: "Sevrenaie/not-public" };
  const profile = { ...repo, full_name: "Sevrenaie/Sevrenaie" };
  const data = {
    repos: [repo, secret, profile],
    events: [
      { ...event, public: false },
      { ...event, repo: { name: secret.full_name } },
      { ...event, repo: { name: "someone/project" } },
      { ...event, created_at: "2027-01-01T00:00:00Z" },
      { ...event, actor: { login: "github-actions[bot]" } },
      { ...event, repo: { name: profile.full_name } },
      event,
    ],
  };
  const activity = prepareActivity(data, now);
  assert.equal(activity.state, "content");
  assert.equal(activity.hackingOn, "Agent_Platform");
  assert.match(activity.caption, /push 1h ago/);
  assert.equal(activity.hour, 16);
});

test("empty feeds stay honest and do not use other authors' pushed_at", () => {
  const activity = prepareActivity({ events: [], repos: [{ ...repo, pushed_at: now.toISOString() }] }, now);
  assert.match(activity.caption, /no recent public pushes in the available feed/);
  assert.equal(activity.hackingOn, "");
});

test("HTTP and malformed-response failures leave existing artwork untouched", async () => {
  const dir = await mkdtemp(join(tmpdir(), "profile-cat-test-"));
  try {
    const target = join(dir, "cat-light.svg");
    await writeFile(target, "last good image");
    await assert.rejects(updateCat({
      outputDir: dir, now,
      fetcher: async () => ({ ok: false, status: 403 }),
    }), /HTTP 403/);
    await assert.rejects(updateCat({
      outputDir: dir, now,
      fetcher: async () => ({ ok: true, json: async () => ({ message: "bad" }) }),
    }), /Unexpected/);
    assert.equal(await readFile(target, "utf8"), "last good image");
  } finally {
    await unlink(join(dir, "cat-light.svg"));
    await rmdir(dir);
  }
});

test("all profile states hide messages and activity details in both themes and sizes", () => {
  for (const state of VALID_STATES) {
    const scenes = renderScenes({
      state, caption: "quiet paws - no recent public pushes in the available feed",
      hackingOn: "repo-label-must-not-appear",
      hour: 16, updatedAt: "2026-10-06 08:00 UTC",
    });
    for (const [name, svg] of Object.entries(scenes)) {
      const compact = name.includes("-mobile");
      assert.match(svg, compact ? /viewBox="0 0 450 190"/ : /viewBox="0 0 894 190"/);
      assert.match(svg, /<desc>A pale-blue pixel cat with a bowl, yarn, and a little home\.<\/desc>/);
      if (!compact) assert.match(svg, /Tomo \/ prsdx/);
      assert.doesNotMatch(svg, /one small step|quiet paws|no recent public pushes|last public push|repo-label-must-not-appear|a little break|hello, little visitor|a soft spot/);
      assert.doesNotMatch(svg, /PUBLIC ACTIVITY|SNAPSHOT|2026-10-06 08:00 UTC/);
      assert.doesNotMatch(svg, /scroll down|live stats|featured projects/);
      assert.match(svg, /<animate/);
    }
  }
});

test("renderer defaults retain escaped captions for non-quiet consumers", () => {
  for (const compact of [false, true]) {
    const svg = buildSvg("content", "<not markup> " + "x".repeat(150), "light", "hello", "", true, {
      compact, updatedAt: "2026-10-06 08:00 UTC",
    });
    assert.match(svg, compact ? /viewBox="0 0 450 244"/ : /viewBox="0 0 894 222"/);
    assert.match(svg, /&lt;not markup&gt;/);
    assert.doesNotMatch(svg, /<not markup>/);
    assert.match(svg, /2026-10-06 08:00 UTC/);
  }
});
