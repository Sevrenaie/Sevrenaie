export const FOOD_PER_PUSH = 25;
export const HOURS_PER_SERVING = 48;
export const LOW_FOOD = 12.5;
const CAPACITY = 100;
const HOUR = 3600000;

// Replay the available public feed; the bowl caps excess food after each push.
export function foodFromPushes(events, now = new Date()) {
  const end = now.getTime();
  const seen = new Set();
  const pushes = events.filter(event => {
    const time = Date.parse(event.created_at);
    if (event.type !== "PushEvent" || !Number.isFinite(time) || time > end) return false;
    if (event.id && seen.has(event.id)) return false;
    if (event.id) seen.add(event.id);
    return true;
  }).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  let level = 0;
  let previous = pushes.length ? Date.parse(pushes[0].created_at) : end;
  for (const event of pushes) {
    const time = Date.parse(event.created_at);
    level = Math.max(0, level - (time - previous) / HOUR * FOOD_PER_PUSH / HOURS_PER_SERVING);
    level = Math.min(CAPACITY, level + FOOD_PER_PUSH);
    previous = time;
  }
  level = Math.max(0, level - (end - previous) / HOUR * FOOD_PER_PUSH / HOURS_PER_SERVING);
  return { level, hungry: level < LOW_FOOD };
}
