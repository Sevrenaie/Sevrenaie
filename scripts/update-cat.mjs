import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";

process.env.PET_TZ_OFFSET_MINUTES = "480";
const { decide, lastPushedRepo, ownerHour } = await import("./vendor/tomo/state.ts");
const { buildSvg } = await import("./vendor/tomo/render.ts");

const OWNER = "Sevrenaie";
const ROOT = fileURLToPath(new URL("../", import.meta.url));

export async function getPublicData(fetcher = fetch, token = process.env.GITHUB_TOKEN) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Sevrenaie-profile-cat",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const results = [];
  for (const endpoint of ["events/public?per_page=100", "repos?type=owner&per_page=100"]) {
    const response = await fetcher(`https://api.github.com/users/${OWNER}/${endpoint}`, {
      headers,
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new Error(`Public GitHub API returned HTTP ${response.status}; existing artwork is unchanged.`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Unexpected public API response; existing artwork is unchanged.");
    results.push(data);
  }
  return { events: results[0], repos: results[1] };
}

export function prepareActivity(data, now = new Date()) {
  const repos = data.repos.filter(repo =>
    repo.private === false && repo.owner?.login?.toLowerCase() === OWNER.toLowerCase()
  );
  const names = new Set(repos.map(repo => repo.full_name));
  const events = data.events.filter(event => {
    const time = Date.parse(event.created_at);
    return event.public === true && names.has(event.repo?.name)
      && event.repo?.name !== `${OWNER}/${OWNER}`
      && event.actor?.login?.toLowerCase() === OWNER.toLowerCase()
      && Number.isFinite(time) && time <= now.getTime();
  }).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  // Profile bot commits must not make the cat appear permanently active.
  // Repository pushed_at may belong to another author, so only owner events
  // are used as activity evidence.
  const status = decide(events, {}, {}, now);
  if (!status.apiOk) status.caption = "quiet paws - no recent public pushes in the available feed";
  return {
    ...status,
    hackingOn: lastPushedRepo(events) ?? "",
    hour: ownerHour(now),
    updatedAt: now.toISOString().slice(0, 16).replace("T", " ") + " UTC",
  };
}

export function renderScenes(activity) {
  return Object.fromEntries(["light", "dark"].flatMap(theme =>
    [false, true].map(compact => [
      `cat-${theme}${compact ? "-mobile" : ""}.svg`,
      buildSvg(activity.state, activity.caption, theme, "", "", true, { ...activity, compact, quiet: true }),
    ])
  ));
}

export async function updateCat({ fetcher = fetch, outputDir = resolve(ROOT, "assets"), now = new Date() } = {}) {
  const data = await getPublicData(fetcher);
  const activity = prepareActivity(data, now);
  const scenes = renderScenes(activity);
  await mkdir(outputDir, { recursive: true });
  for (const [name, svg] of Object.entries(scenes)) {
    await writeFile(resolve(outputDir, name), svg, "utf8");
  }
  console.log(`Cat snapshot: ${activity.state}; ${activity.updatedAt}. Public activity only.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  updateCat().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
