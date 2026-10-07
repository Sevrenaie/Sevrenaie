export const PLAY_LOOP_SECONDS = 80;
// Seeded once per snapshot, so all themes and sizes share the same routine.
export function makePlayPlan(seed = 1, hungry = false) {
  let value = (seed >>> 0) || 1;
  const random = () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4294967296;
  };
  const actions = ["tap", "chase", "tug"];
  for (let i = actions.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [actions[i], actions[j]] = [actions[j], actions[i]];
  }
  return actions.map((action, index) => ({
    action,
    at: 25 + index * 14 + Math.floor(random() * 3),
    distance: Math.round((action === "chase" ? 28 + random() * 10 : 8 + random() * 6) * (hungry ? 0.7 : 1)),
  }));
}
