import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rmdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPublicData, prepareActivity, renderScenes, updateCat } from "./update-cat.mjs";

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

test("both themes render bounded captions, attribution, and snapshot timestamps", () => {
  const scenes = renderScenes({
    state: "content", caption: "<not markup> " + "x".repeat(150),
    hour: 16, updatedAt: "2026-10-06 08:00 UTC",
  });
  for (const [name, svg] of Object.entries(scenes)) {
    const compact = name.includes("-mobile");
    assert.match(svg, compact ? /viewBox="0 0 450 244"/ : /viewBox="0 0 894 222"/);
    assert.match(svg, /&lt;not markup&gt;/);
    if (!compact) assert.match(svg, /Tomo \/ prsdx/);
    assert.match(svg, compact ? /SNAPSHOT \/ 2026-10-06 08:00 UTC/ : /PUBLIC ACTIVITY \/ 2026-10-06 08:00 UTC/);
    assert.doesNotMatch(svg, /scroll down|live stats|featured projects/);
    assert.match(svg, /<animate/);
  }
});
