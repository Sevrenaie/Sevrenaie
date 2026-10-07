import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rmdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPublicData, prepareActivity, renderScenes, updateCat } from "./update-cat.mjs";
import { buildSvg } from "./vendor/tomo/render.ts";
import { VALID_STATES } from "./vendor/tomo/state.ts";
import { foodFromPushes } from "./feeding.mjs";
import { makePlayPlan, PLAY_LOOP_SECONDS } from "./playtime.mjs";

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
  assert.ok(Math.abs(activity.feeding.level - (25 - 25 / 48)) < 1e-9);
  assert.equal(activity.feeding.hungry, false);
});

test("empty feeds stay honest and do not use other authors' pushed_at", () => {
  const activity = prepareActivity({ events: [], repos: [{ ...repo, pushed_at: now.toISOString() }] }, now);
  assert.match(activity.caption, /no recent public pushes in the available feed/);
  assert.equal(activity.hackingOn, "");
  assert.equal(activity.feeding.level, 0);
  assert.equal(activity.state, "hungry");
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

const pushAt = (hoursAgo, id) => ({
  ...event, id, created_at: new Date(now.getTime() - hoursAgo * 3600000).toISOString(),
});

test("each push adds a quarter bowl and a serving lasts 48 hours", () => {
  assert.equal(foodFromPushes([pushAt(0, "a")], now).level, 25);
  assert.equal(foodFromPushes([pushAt(0, "a"), pushAt(0, "b")], now).level, 50);
  assert.equal(foodFromPushes([pushAt(24, "a")], now).level, 12.5);
  assert.equal(foodFromPushes([pushAt(48, "a")], now).level, 0);
  assert.equal(foodFromPushes([pushAt(72, "a")], now).level, 0);
  assert.equal(foodFromPushes([pushAt(25, "a")], now).hungry, true);
  assert.equal(foodFromPushes([pushAt(24, "a")], now).hungry, false);
});

test("ration caps overflow, decays chronologically and does not mutate input", () => {
  const pushes = Array.from({ length: 8 }, (_, index) => pushAt(0, String(index)));
  assert.equal(foodFromPushes(pushes, now).level, 100);
  assert.equal(foodFromPushes(pushes, new Date(now.getTime() + 48 * 3600000)).level, 75);
  assert.equal(foodFromPushes(pushes, new Date(now.getTime() + 192 * 3600000)).level, 0);
  const unordered = [pushAt(0, "new"), pushAt(48, "old")];
  const original = structuredClone(unordered);
  assert.equal(foodFromPushes(unordered, now).level, 25);
  assert.deepEqual(unordered, original);
});

test("only unique, valid pushes add food; old activity never accumulates forever", () => {
  const valid = pushAt(0, "valid");
  const feeding = foodFromPushes([
    valid, valid, pushAt(-1, "future"), pushAt(300, "old"),
    { ...valid, id: "bad-date", created_at: "invalid" },
    { ...valid, id: "not-a-push", type: "IssuesEvent" },
  ], now);
  assert.equal(feeding.level, 25);
});

test("regular feeding keeps the remaining ration across the eight-day boundary", () => {
  const pushes = [
    ...Array.from({ length: 4 }, (_, index) => pushAt(200, `old-${index}`)),
    pushAt(24, "recent"),
  ];
  const expected = 100 + 25 - 200 * 25 / 48;
  assert.ok(Math.abs(foodFromPushes(pushes, now).level - expected) < 1e-9);
});

test("profile feeding uses gentle faces, meal hearts and only low-food reminders", () => {
  for (const level of [0, 6, 12.4999, 12.5, 25, 100]) {
    const hungry = level < 12.5;
    const scenes = renderScenes({
      state: hungry ? "hungry" : "zoomies", caption: "hidden",
      hour: 12, feeding: { level, hungry },
    });
    for (const svg of Object.values(scenes)) {
      assert.equal(Number(svg.match(/data-food-level="([^"]+)"/)[1]), level);
      assert.match(svg, /data-role="gentle-feeding"/);
      assert.match(svg, /data-role="cat-silhouette" shape-rendering="crispEdges"/);
      assert.match(svg, /data-role="play-yarn"/);
      assert.match(svg, /data-role="play-paw"/);
      assert.doesNotMatch(svg, /one small step|quiet paws|PUBLIC ACTIVITY|SNAPSHOT/);
      assert.doesNotMatch(svg, /&#x(?:996D|7B49);|[\u4e00-\u9fff]/);
      if (hungry) {
        assert.match(svg, /data-role="hungry-reminder"/);
        assert.ok(svg.includes(level ? "Running low..." : "A little snack?"));
        assert.match(svg, /data-role="soft-face"/);
        assert.doesNotMatch(svg, /data-role="meal-hearts"|data-role="little-bite"/);
      } else {
        assert.match(svg, /data-role="face-mouth"/);
        assert.match(svg, /data-role="meal-hearts"/);
        assert.match(svg, /data-role="little-bite"/);
        assert.doesNotMatch(svg, /data-role="hungry-reminder"/);
        assert.match(svg, /values="0 0;0 0;0 2;0 0;0 2;0 0;0 0"/);
        assert.doesNotMatch(svg, /values="[^"]*;0 8(?:;|")/);
      }
    }
  }
});

test("play plans vary per snapshot and keep gentle, bounded actions even when hungry", () => {
  const plans = new Set();
  for (let seed = 1700000000; seed < 1700000064; seed++) {
    const normal = makePlayPlan(seed);
    const hungry = makePlayPlan(seed, true);
    assert.deepEqual(makePlayPlan(seed), normal);
    assert.deepEqual(normal.map(beat => beat.action).sort(), ["chase", "tap", "tug"]);
    for (const [index, beat] of normal.entries()) {
      assert.ok(beat.at >= 25 && beat.at + 6 < 65);
      assert.ok(beat.distance > 0 && beat.distance <= 38);
      assert.equal(hungry[index].action, beat.action);
      assert.equal(hungry[index].at, beat.at);
      assert.ok(hungry[index].distance <= beat.distance);
    }
    plans.add(JSON.stringify(normal));
  }
  assert.ok(plans.size > 30);
  assert.equal(PLAY_LOOP_SECONDS, 80);
});

test("the same activity snapshot uses one play plan across themes and sizes", () => {
  const activity = prepareActivity({ events: [], repos: [] }, now);
  const later = prepareActivity({ events: [], repos: [] }, new Date(now.getTime() + 6 * 3600000));
  assert.notEqual(activity.playSeed, later.playSeed);
  const patterns = new Set();
  for (const svg of Object.values(renderScenes(activity))) {
    assert.ok(svg.includes(`data-play-seed="${activity.playSeed}"`));
    patterns.add(svg.match(/data-play-actions="([^"]+)"/)[1]);
    const position = svg.match(/data-role="cat-position"[^>]*>\s*(<animateTransform[^>]+\/>)/)[1];
    const xs = position.match(/values="([^"]+)"/)[1].split(";").map(value => Number(value.split(" ")[0]));
    assert.equal(xs[0], xs.at(-1));
    assert.ok(new Set(xs).size >= 3, "A hungry cat still visits and chases the yarn");
    assert.match(position, /dur="80s"/);
  }
  assert.equal(patterns.size, 1);
});

test("yarn play lifts the original block paw without growing, fading or duplicating a limb", () => {
  for (const hungry of [true, false]) {
    for (const svg of Object.values(renderScenes({
      state: hungry ? "hungry" : "content", caption: "", hour: 12,
      feeding: { level: hungry ? 0 : 25, hungry },
    }))) {
      assert.equal(svg.match(/data-role="play-paw"/g).length, 1);
      const paw = svg.match(/<g data-role="play-paw"([^>]*)>(.*?)<\/g>/s);
      assert.match(paw[1], /transform="translate\(0 0\)"/);
      assert.match(paw[1], /shape-rendering="crispEdges"/);
      assert.doesNotMatch(paw[0], /opacity|<path|<ellipse|<circle|scale|rotate/);
      assert.equal(paw[2].match(/<rect /g).length, 1);
      assert.match(paw[2], /<rect x="84" y="146" width="18" height="12" fill="#[a-f0-9]+"\/>/);
      const motion = paw[2].match(/<animateTransform[^>]+\/>/)[0];
      assert.match(motion, /type="translate"/);
      assert.match(motion, /calcMode="spline"/);
      const offsets = motion.match(/values="([^"]+)"/)[1].split(";").map(value => value.split(" ").map(Number));
      assert.deepEqual(offsets[0], [0, 0]);
      assert.deepEqual(offsets.at(-1), [0, 0]);
      assert.ok(offsets.some(([x, y]) => x === 12 && y === -6));
      assert.ok(offsets.every(([x, y]) => x >= 0 && x <= 12 && y >= -6 && y <= 0));
      // Even the fully raised paw overlaps the solid body, so it cannot detach.
      assert.ok(offsets.every(([x, y]) => 84 + x < 108 && 146 + y < 152 && 158 + y > 80));
      const silhouette = svg.slice(svg.indexOf('data-role="cat-silhouette"'), svg.indexOf('data-role="soft-face"'));
      assert.doesNotMatch(silhouette, /<rect x="84" y="152" width="18" height="6"/);
      assert.doesNotMatch(svg, /M96 136 Q113 143 130 142/);
    }
  }
});

test("short paws reach the yarn while the body follows every tug at a fixed distance", () => {
  for (const seed of [1, 2, 3, 44, 12345]) {
    for (const hungry of [true, false]) {
      const plan = makePlayPlan(seed, hungry);
      for (const [name, svg] of Object.entries(renderScenes({
        state: hungry ? "hungry" : "content", caption: "", hour: 12, playSeed: seed,
        feeding: { level: hungry ? 0 : 25, hungry },
      }))) {
        const yarnX = name.includes("-mobile") ? 195 : 430;
        const motion = svg.match(/data-role="cat-position"[^>]*>\s*(<animateTransform[^>]+\/>)/)[1];
        const times = motion.match(/keyTimes="([^"]+)"/)[1].split(";").map(value => Number(value) * PLAY_LOOP_SECONDS);
        const xs = motion.match(/values="([^"]+)"/)[1].split(";").map(value => Number(value.split(" ")[0]));
        const at = seconds => {
          const index = times.findIndex(time => Math.abs(time - seconds) < 0.0001);
          assert.notEqual(index, -1, `Missing body key at ${seconds}s`);
          return xs[index];
        };
        const perch = at(22);
        assert.equal(perch + 84 + 18 + 12, yarnX, "The short raised paw reaches the yarn");
        const tug = plan.find(beat => beat.action === "tug");
        assert.equal(at(tug.at), perch);
        assert.equal(at(tug.at + 0.8), perch - tug.distance);
        assert.equal(at(tug.at + 1.8), perch - tug.distance);
        assert.equal(at(tug.at + 3), perch);
        assert.equal(at(tug.at + 4), perch);
      }
    }
  }
});

test("one soft face morphs smoothly, blinks, and only pouts briefly near the bowl", () => {
  const track = (svg, role) => {
    const match = svg.match(new RegExp(`<(?:g|path) data-role="${role}"([^>]*)>\\s*(<animate(?:Transform)?[^>]+/>)`));
    const tag = match?.[2];
    assert.ok(tag, `Missing animation for ${role}`);
    return {
      attributes: match[1],
      tag,
      times: tag.match(/keyTimes="([^"]+)"/)[1].split(";").map(t => Number(t) * PLAY_LOOP_SECONDS),
      values: tag.match(/values="([^"]+)"/)[1].split(";"),
    };
  };
  for (const hungry of [true, false]) {
    for (const svg of Object.values(renderScenes({
      state: hungry ? "hungry" : "content", caption: "", hour: 12,
      feeding: { level: hungry ? 0 : 25, hungry },
    }))) {
      assert.equal(svg.match(/data-role="soft-face"/g).length, 1);
      assert.doesNotMatch(svg, /data-face=|data-role="face-(calm|happy|hungry)"/);
      const mouth = track(svg, "face-mouth");
      for (const role of ["eye-left", "eye-right", "face-mouth"]) {
        assert.equal(svg.match(new RegExp(`data-role="${role}"`, "g")).length, 1);
        const part = track(svg, role);
        const base = part.attributes.match(/d="([^"]+)"/)[1];
        assert.equal(part.values[0], base);
        assert.equal(part.values.at(-1), base);
        assert.match(part.tag, /attributeName="d"/);
        assert.match(part.tag, /calcMode="spline"/);
        for (const value of part.values) {
          assert.deepEqual(value.match(/[A-Za-z]/g), base.match(/[A-Za-z]/g));
          assert.equal(value.match(/-?\d+(?:\.\d+)?/g).length, base.match(/-?\d+(?:\.\d+)?/g).length);
        }
      }
      const gaze = track(svg, "eye-gaze");
      const offsets = gaze.values.map(value => value.split(" ").map(Number));
      assert.deepEqual(offsets[0], [0, 0]);
      assert.deepEqual(offsets.at(-1), [0, 0]);
      assert.ok(offsets.some(([x]) => x < 0) && offsets.some(([x]) => x > 0));
      assert.ok(offsets.every(([x, y]) => Math.abs(x) <= 1.5 && Math.abs(y) <= 0.5));
      const eyes = track(svg, "eye-left");
      const blink = eyes.values.map((value, i) => value.includes("95.6") ? i : -1).filter(i => i >= 0);
      assert.ok(blink.length >= 16);
      for (let i = 0; i < blink.length; i += 2) {
        assert.ok(Math.abs(eyes.times[blink[i + 1] + 1] - eyes.times[blink[i] - 1] - 0.3) < 1e-6);
      }
      const pout = "M54 112 Q57 110 60 111 Q63 110 66 112";
      let poutSeconds = 0;
      for (let i = 0; i < mouth.times.length - 1; i++) {
        if (mouth.values[i] === pout || mouth.values[i + 1] === pout) {
          const start = mouth.times[i], end = mouth.times[i + 1];
          poutSeconds += end - start;
          assert.ok((start >= 4 && end <= 10) || (start >= 74 && end <= 78));
        }
      }
      assert.ok(hungry ? poutSeconds > 3 && poutSeconds < 5 : poutSeconds === 0);
    }
  }
});
