// Renders the banner scene: the cat lives a little life on a master timeline -
// scoots to its bowl, eats (head bobs), scoots to the yarn, bats it (paw +
// yarn rolls), then scoots home. State overrides:
//   hungry  -> camps at the empty bowl all day
//   grumpy  -> sulks in the cardboard box with angry brows
//   zoomies -> the whole routine at 2x with motion lines
//   sleeping-> curled up with Zzz (handled separately)
// Zero dependencies, pure SMIL. TypeScript port of render.py.
// (Also fixes a latent bug: the yarn ball was drawn at y=0 instead of ground level.)

import * as sprites from "./sprites.ts";
import { skyPhase } from "./state.ts";
import { makePlayPlan, PLAY_LOOP_SECONDS } from "../../playtime.mjs";

const PX = 6;
let WIDTH = 894, HEIGHT = 222;
const GROUND_Y = 158;
const CAT_Y = GROUND_Y - 16 * PX;
let HOME_X = 70, YARN_X = 430, BOWL_X = 640;
const FIRE_X = 210, CAKE_X = 792;
let CAT_AT_BOWL = 500, CAT_AT_YARN = 320;
const INTRO_S = 7;

type Pal = Record<string, string>;

export const PALETTES: Record<string, Pal> = {
    dark: { bg: "#0d1117", body: "#c9e6f4", accent: "#77bde6", pink: "#efb8cb", ground: "#344b5b", text: "#b3c6d2", heart: "#efaac4", lid: "#344b5b", yarn: "#aacbbf", collar: "#77bde6", tag: "#f4dc97", fire: "#f4dc97", ember: "#efb8cb", wood: "#657781", moon: "#f4dc97", star: "#d3e9f4", gold: "#f4dc97", pumpkin: "#e8bb94", lemon: "#f4dc97", shades: "#24292f" },
    light: { bg: "#f3faff", body: "#98bed5", accent: "#315e7c", pink: "#e9b3c7", ground: "#c7dfe9", text: "#436176", heart: "#d88baa", lid: "#436176", yarn: "#88b9a9", collar: "#649fc5", tag: "#eacb73", fire: "#eacb73", ember: "#d88baa", wood: "#82909a", moon: "#ad8625", star: "#7a9bad", gold: "#ad8625", pumpkin: "#dca277", lemon: "#eacb73", shades: "#24292f" },
};

const STATE_TEMPO: Record<string, number> = { zoomies: 14, content: 32, overheat: 20, release: 20, sick: 44 };

let PAL_CURRENT: Pal = PALETTES.dark;

function esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function rects(grid: string[], colors: Record<string, string>, x0: number, y0: number, scale = PX): string[] {
    const out: string[] = [];
    for (let r = 0; r < grid.length; r++) {
        const row = grid[r];
        let c = 0;
        while (c < row.length) {
            const ch = row[c];
            if (ch in colors) {
                const s = c;
                while (c < row.length && row[c] === ch) c++;
                out.push(`<rect x="${x0 + s * scale}" y="${y0 + r * scale}" width="${(c - s) * scale}" height="${scale}" fill="${colors[ch]}"/>`);
            } else {
                c++;
            }
        }
    }
    return out;
}

function pixels(coords: Array<[number, number]>, color: string, x0: number, y0: number, scale = PX): string[] {
    return coords.map(([cx, cy]) => `<rect x="${x0 + cx * scale}" y="${y0 + cy * scale}" width="${scale}" height="${scale}" fill="${color}"/>`);
}

function blink(pal: Pal, y0: number): string[] {
    const openR = pixels(sprites.SIT_EYES, pal.accent, 0, y0).join("");
    const lidR = pixels(sprites.SIT_EYES, pal.lid, 0, y0).join("");
    return [
        `<g><animate attributeName="opacity" values="1;0;1" keyTimes="0;0.96;1" calcMode="discrete" dur="4.2s" repeatCount="indefinite"/>${openR}</g>`,
        `<g opacity="0"><animate attributeName="opacity" values="0;1;0" keyTimes="0;0.96;1" calcMode="discrete" dur="4.2s" repeatCount="indefinite"/>${lidR}</g>`,
    ];
}

function tailWag(pal: Pal, y0: number, dur = "1.4s"): string[] {
    const a = pixels(sprites.TAIL_A, pal.body, 0, y0).join("");
    const b = pixels(sprites.TAIL_B, pal.body, 0, y0).join("");
    return [
        `<g><animate attributeName="opacity" values="1;0;1" keyTimes="0;0.5;1" calcMode="discrete" dur="${dur}" repeatCount="indefinite"/>${a}</g>`,
        `<g opacity="0"><animate attributeName="opacity" values="0;1;0" keyTimes="0;0.5;1" calcMode="discrete" dur="${dur}" repeatCount="indefinite"/>${b}</g>`,
    ];
}

function headGroup(state: string, pal: Pal, colors: Record<string, string>, y0: number, masterDur: number, eatWindow?: [number, number], begin = 0): string[] {
    const [h0, h1] = sprites.SIT_HEAD_ROWS;
    const head: string[] = [];
    if (eatWindow) {
        const [w0, w1] = eatWindow;
        const step = (w1 - w0) / 6.0;
        const times = [0.0, w0, w0 + step, w0 + 2 * step, w0 + 3 * step, w0 + 4 * step, w0 + 5 * step, w1, 1.0].map((t) => Math.min(Math.max(t, 0), 1));
        const vals = ["0 0", "0 0", "0 8", "0 0", "0 8", "0 0", "0 8", "0 0", "0 0"];
        const kt = times.map((t) => t.toFixed(3)).join(";");
        head.push(`<g><animateTransform attributeName="transform" type="translate" values="${vals.join(";")}" keyTimes="${kt}" dur="${masterDur}s" begin="${begin}s" repeatCount="indefinite"/>`);
    } else {
        head.push("<g>");
    }
    head.push(...rects(sprites.SIT_FRONT.slice(h0, h1 + 1), colors, 0, y0));
    head.push(...pixels(sprites.SIT_INNER_EARS, PAL_CURRENT.pink, 0, y0));
    head.push(...pixels(sprites.SIT_WHISKERS, pal.body, 0, y0));
    head.push(...blink(pal, y0));
    if (state === "grumpy") head.push(...pixels(sprites.SIT_BROWS, pal.accent, 0, y0));
    head.push("</g>");
    return head;
}

function bodyGroup(pal: Pal, colors: Record<string, string>, y0: number, masterDur: number, batWindow?: [number, number], wag = "1.4s", begin = 0): string[] {
    const [b0, b1] = sprites.SIT_BODY_ROWS;
    const body = rects(sprites.SIT_FRONT.slice(b0, b1 + 1), colors, 0, y0 + b0 * PX);
    body.push(...pixels(sprites.SIT_COLLAR_BAND, PAL_CURRENT.collar, 0, y0));
    body.push(...pixels(sprites.SIT_COLLAR_TAG, PAL_CURRENT.tag, 0, y0));
    body.push(...tailWag(pal, y0, wag));
    if (batWindow) {
        const [w0, w1] = batWindow;
        const mid = (w0 + w1) / 2.0;
        const tucked = pixels(sprites.PAW_TUCKED, pal.body, 0, y0).join("");
        const out = pixels(sprites.PAW_EXTENDED, pal.body, 0, y0).join("");
        const kt = `0;${w0.toFixed(3)};${mid.toFixed(3)};${w1.toFixed(3)};1`;
        body.push(`<g><animate attributeName="opacity" values="1;1;0;0;1" keyTimes="${kt}" calcMode="discrete" dur="${masterDur}s" begin="${begin}s" repeatCount="indefinite"/>${tucked}</g>`);
        body.push(`<g opacity="0"><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="${kt}" calcMode="discrete" dur="${masterDur}s" begin="${begin}s" repeatCount="indefinite"/>${out}</g>`);
    }
    return body;
}

function hearts(pal: Pal): string[] {
    const out: string[] = [];
    for (const [bx, by, beg] of [[14, -2, "0.4s"], [17, -4, "1.9s"]] as Array<[number, number, string]>) {
        const cells = rects(sprites.HEART, { h: pal.heart }, bx * PX, by * PX, 3).join("");
        out.push(`<g opacity="0"><animateTransform attributeName="transform" type="translate" values="0 0;6 -22" dur="2.6s" begin="${beg}" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.2;0.7;1" dur="2.6s" begin="${beg}" repeatCount="indefinite"/>${cells}</g>`);
    }
    return out;
}

function yarnProp(pal: Pal, masterDur: number, batWindow?: [number, number], begin = 0): string[] {
    const y0 = GROUND_Y - 6 * PX;
    const cells = rects(sprites.YARN, { h: pal.yarn }, 0, y0);
    if (batWindow) {
        const [w0, w1] = batWindow;
        const kt = `0;${w0.toFixed(3)};${(w0 + 0.03).toFixed(3)};${w1.toFixed(3)};${Math.min(w1 + 0.08, 0.99).toFixed(3)};1`;
        const vals = "0 0;0 0;52 -10;52 0;52 0;0 0";
        return [`<g><animateTransform attributeName="transform" type="translate" values="${vals}" keyTimes="${kt}" dur="${masterDur}s" begin="${begin}s" repeatCount="indefinite"/>${cells.join("")}</g>`];
    }
    return cells;
}

function props(pal: Pal, colors: Record<string, string>, state: string, masterDur?: number, batWindow?: [number, number], begin = 0): string[] {
    const parts: string[] = [];
    parts.push(`<rect x="${HOME_X - 16}" y="${GROUND_Y - 40}" width="80" height="40" fill="none" stroke="${pal.ground}" stroke-width="2"/>`);
    parts.push(`<line x1="${HOME_X - 16}" y1="${GROUND_Y - 40}" x2="${HOME_X + 24}" y2="${GROUND_Y - 52}" stroke="${pal.ground}" stroke-width="2"/>`);
    if (masterDur && batWindow) {
        parts.push(`<g transform="translate(${YARN_X},0)">` + yarnProp(pal, masterDur, batWindow, begin).join("") + "</g>");
    } else {
        parts.push(`<g transform="translate(${YARN_X},0)">` + yarnProp(pal, 1, undefined).join("") + "</g>");
    }
    const bowlColor = state === "hungry" ? pal.ground : pal.body;
    parts.push(...rects(sprites.BOWL, { X: bowlColor }, BOWL_X, GROUND_Y - 5 * PX));
    if (state !== "hungry") {
        parts.push(`<rect x="${BOWL_X + 4 * PX}" y="${GROUND_Y - 5 * PX}" width="${PX}" height="${PX}" fill="${pal.pink}"/>`);
        parts.push(`<rect x="${BOWL_X + 6 * PX}" y="${GROUND_Y - 5 * PX}" width="${PX}" height="${PX}" fill="${pal.pink}"/>`);
    }
    return parts;
}

function zzz(pal: Pal): string[] {
    const out: string[] = [];
    for (const [dx, size, beg] of [[0, 12, "0s"], [14, 15, "1s"], [30, 18, "2s"]] as Array<[number, number, string]>) {
        out.push(`<text x="${170 + dx}" y="80" font-family="monospace" font-size="${size}" fill="${pal.accent}" opacity="0">z<animateTransform attributeName="transform" type="translate" values="0 0;8 -26" dur="3s" begin="${beg}" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.25;0.75;1" dur="3s" begin="${beg}" repeatCount="indefinite"/></text>`);
    }
    return out;
}

function sleepingCat(pal: Pal, colors: Record<string, string>, topLang = ""): string[] {
    const y0 = GROUND_Y - 14 * PX;
    const parts = rects(sprites.CURL_BODY, colors, 90, y0);
    for (const [ex, ey] of sprites.CURL_LIDS) {
        parts.push(`<rect x="${90 + ex * PX}" y="${y0 + ey * PX}" width="${PX}" height="${PX}" fill="${pal.lid}"/>`);
    }
    parts.push(...zzz(pal));
    if (topLang) {
        parts.push(`<text x="215" y="52" font-family="monospace" font-style="italic" font-size="12" fill="${pal.text}">dreaming in ${esc(topLang)}</text>`);
    }
    return parts;
}

function welcome(pal: Pal, greeting: string): string[] {
    const dur = INTRO_S;
    const fade = "0;0;1;1;0;0";
    const kt = "0;0.07;0.14;0.85;0.96;1";
    const out: string[] = [
        `<g opacity="0"><animate attributeName="opacity" values="${fade}" keyTimes="${kt}" dur="${dur}s" repeatCount="1" fill="freeze"/>`,
    ];
    out.push(`<rect x="60" y="12" width="380" height="46" rx="8" fill="${pal.ground}"/>`);
    out.push(`<polygon points="110,58 130,58 118,74" fill="${pal.ground}"/>`);
    out.push(`<text x="76" y="31" font-family="monospace" font-size="14" fill="${pal.text}">${esc(greeting)}</text>`);
    out.push(`<text x="76" y="48" font-family="monospace" font-size="13" fill="${pal.text}">a soft spot for small discoveries</text>`);
    out.push("</g>");
    return out;
}

// guide mode: rotating hint bubbles, top-right, one at a time on a loop.
// (pre-baked rotation - the svg cannot see where the visitor actually is)
function guideBubbles(pal: Pal, contact = "", hackingOn = ""): string[] {
    const hints: string[] = [];
    if (hackingOn) hints.push(`last public push: ${hackingOn}`);
    hints.push("one small step at a time", "a little break, a little yarn");
    if (contact) hints.push(`say hi: ${contact}`);
    const dur = 18, slot = dur / hints.length;
    const out: string[] = [];
    hints.forEach((hint, i) => {
        const w = hint.length * 8.5 + 22;
        const x = WIDTH - 16 - w;
        const t0 = (i * slot) / dur, t1 = (i * slot + slot - 1.2) / dur;
        const kt = `0;${t0.toFixed(3)};${(t0 + 0.04).toFixed(3)};${t1.toFixed(3)};${Math.min(t1 + 0.04, 0.99).toFixed(3)};1`;
        const vals = `0;0;1;1;0;0`;
        out.push(`<g opacity="0"><animate attributeName="opacity" values="${vals}" keyTimes="${kt}" dur="${dur}s" begin="${INTRO_S + 0.2}s" repeatCount="indefinite"/>` +
            `<rect x="${x}" y="14" width="${w}" height="30" rx="8" fill="${pal.ground}"/>` +
            `<polygon points="${x + 26},44 ${x + 44},44 ${x + 33},54" fill="${pal.ground}"/>` +
            `<text x="${x + 11}" y="33" font-family="monospace" font-size="14" fill="${pal.text}">${esc(hint)}</text>` +
            `</g>`);
    });
    return out;
}

// day/night sky by the owner's local hour: tint overlay, stars + moon at night.
// drawn first (behind everything); all animation pre-baked SMIL.
function sky(pal: Pal, phase: string, dark: boolean): string[] {
    const out: string[] = [];
    if (phase === "dawn") out.push(`<rect width="${WIDTH}" height="${GROUND_Y}" fill="#bcdff1" opacity="${dark ? 0.05 : 0.15}"/>`);
    if (phase === "dusk") out.push(`<rect width="${WIDTH}" height="${GROUND_Y}" fill="#e9b3c7" opacity="${dark ? 0.07 : 0.12}"/>`);
    if (phase === "night") {
        out.push(`<rect width="${WIDTH}" height="${GROUND_Y}" fill="${dark ? "#02060f" : "#0d1117"}" opacity="${dark ? 0.4 : 0.12}"/>`);
        out.push(...rects(sprites.MOON, { m: pal.moon }, 24, 16, 3));
        // twinkling stars, kept below the speech-bubble band
        const spots: Array<[number, number, string]> = [[120, 72, "0s"], [260, 88, "0.7s"], [400, 70, "1.3s"], [520, 86, "0.4s"], [700, 72, "1.7s"], [820, 90, "1s"]];
        for (const [sx, sy, beg] of spots) {
            out.push(`<rect x="${sx}" y="${sy}" width="3" height="3" fill="${pal.star}"><animate attributeName="opacity" values="1;0.2;1" dur="2.2s" begin="${beg}" repeatCount="indefinite"/></rect>`);
        }
    }
    return out;
}

// streak campfire: two-frame flame flicker + a rising smoke puff.
// shown when the owner has a 3+ day contribution streak.
function fireProp(pal: Pal): string[] {
    const y0 = GROUND_Y - 8 * 3;
    const colorsA = { f: pal.ember, F: pal.fire, w: pal.wood };
    const a = rects(sprites.FIRE_A, colorsA, FIRE_X, y0, 3).join("");
    const b = rects(sprites.FIRE_B, colorsA, FIRE_X, y0, 3).join("");
    return [
        `<g><animate attributeName="opacity" values="1;0;1" keyTimes="0;0.5;1" calcMode="discrete" dur="0.7s" repeatCount="indefinite"/>${a}</g>`,
        `<g opacity="0"><animate attributeName="opacity" values="0;1;0" keyTimes="0;0.5;1" calcMode="discrete" dur="0.7s" repeatCount="indefinite"/>${b}</g>`,
        `<rect x="${FIRE_X + 12}" y="${y0 - 8}" width="4" height="4" rx="2" fill="${pal.ground}" opacity="0"><animate attributeName="y" values="${y0 - 8};${y0 - 40}" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;0.7;0" keyTimes="0;0.3;1" dur="2s" repeatCount="indefinite"/></rect>`,
    ];
}

// github-iversary cake with a flickering candle (shown on the account's birthday)
function cakeProp(pal: Pal): string[] {
    const y0 = GROUND_Y - 7 * 3;
    const parts = rects(sprites.CAKE, { k: pal.body, p: pal.pink, c: pal.accent }, CAKE_X, y0, 3);
    const [fx, fy] = sprites.CAKE_FLAME[0];
    parts.push(`<rect x="${CAKE_X + fx * 3 - 1}" y="${y0 + fy * 3}" width="5" height="5" fill="${pal.fire}"><animate attributeName="opacity" values="1;0.4;1" dur="0.6s" repeatCount="indefinite"/></rect>`);
    return parts;
}

// v1.2: star/follower milestone confetti - colored pixels drifting from the top
function confettiProp(pal: Pal): string[] {
    const cols = [pal.accent, pal.pink, pal.heart, pal.tag, pal.yarn, pal.gold];
    const out: string[] = [];
    for (let i = 0; i < 10; i++) {
        const x = 60 + i * 82, beg = (i * 0.35).toFixed(2) + "s", col = cols[i % cols.length];
        out.push(`<rect x="${x}" y="-6" width="5" height="5" fill="${col}" opacity="0"><animate attributeName="y" values="-6;${GROUND_Y - 10}" dur="3.2s" begin="${beg}" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.8;1" dur="3.2s" begin="${beg}" repeatCount="indefinite"/></rect>`);
    }
    return out;
}

// v1.2: nye fireworks - three expanding/fading bursts in the sky band
function fireworksProp(pal: Pal): string[] {
    const bursts: Array<[number, number, string, string]> = [[180, 40, pal.heart, "0s"], [450, 30, pal.accent, "1.1s"], [720, 45, pal.gold, "2.2s"]];
    const out: string[] = [];
    for (const [bx, by, col, beg] of bursts) {
        const dots: string[] = [];
        const dirs: Array<[number, number]> = [[14, 0], [-14, 0], [0, 14], [0, -14], [10, 10], [-10, -10], [10, -10], [-10, 10]];
        for (const [dx, dy] of dirs) {
            dots.push(`<rect x="${bx}" y="${by}" width="3" height="3" fill="${col}"><animateTransform attributeName="transform" type="translate" values="0 0;${dx} ${dy}" dur="1.6s" begin="${beg}" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" keyTimes="0;0.25;1" dur="1.6s" begin="${beg}" repeatCount="indefinite"/></rect>`);
        }
        out.push(...dots);
    }
    return out;
}

// v1.2: touch-grass sign for extreme streaks (21+ days)
function signProp(pal: Pal): string[] {
    const x = 290, y = GROUND_Y - 26;
    return [
        `<rect x="${x + 18}" y="${y + 12}" width="4" height="22" fill="${pal.wood}"/>`,
        `<rect x="${x}" y="${y}" width="86" height="16" rx="3" fill="${pal.ground}"/>`,
        `<text x="${x + 43}" y="${y + 11}" font-family="monospace" font-size="9" fill="${pal.body}" text-anchor="middle">touch grass</text>`,
    ];
}

function routineCat(state: string, pal: Pal, colors: Record<string, string>, weekendShades = false): string[] {
    const dur = STATE_TEMPO[state] ?? 32;
    if (state === "sick") {
        // camps at home with a thermometer - no routine today
        const cat = [`<g transform="translate(${HOME_X},0)">`];
        cat.push(...bodyGroup(pal, colors, CAT_Y, dur, undefined, "2.8s"));
        cat.push(...headGroup(state, pal, colors, CAT_Y, dur));
        cat.push("</g>");
        cat.push(...rects(sprites.THERMOMETER, { w: pal.body, r: pal.heart }, HOME_X + 108, GROUND_Y - 7 * 3, 3));
        return cat;
    }
    if (state === "hungry") {
        const cat = [`<g transform="translate(${CAT_AT_BOWL},0)">`];
        cat.push(...bodyGroup(pal, colors, CAT_Y, dur));
        cat.push(...headGroup(state, pal, colors, CAT_Y, 6.0, [0.1, 0.9]));
        cat.push("</g>");
        return cat;
    }
    if (state === "grumpy") {
        const cat = [`<g transform="translate(${HOME_X - 6},14)">`];
        cat.push(...bodyGroup(pal, colors, CAT_Y, dur, undefined, "3.2s"));
        cat.push(...headGroup(state, pal, colors, CAT_Y, dur));
        cat.push("</g>");
        return cat;
    }
    const kt = "0;0.12;0.35;0.45;0.62;0.82;1";
    const xs = [HOME_X, CAT_AT_BOWL, CAT_AT_BOWL, CAT_AT_YARN, CAT_AT_YARN, HOME_X, HOME_X];
    const vals = xs.map((x) => `${x} 0`).join(";");
    const cat = [`<g transform="translate(${HOME_X},0)"><animateTransform attributeName="transform" type="translate" values="${vals}" keyTimes="${kt}" dur="${dur}s" begin="${INTRO_S}s" repeatCount="indefinite"/>`];
    cat.push(`<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur="0.7s" repeatCount="indefinite"/>`);
    cat.push(...bodyGroup(pal, colors, CAT_Y, dur, [0.66, 0.78], "1.4s", INTRO_S));
    cat.push(...headGroup(state, pal, colors, CAT_Y, dur, [0.15, 0.33], INTRO_S));
    // raised-paw wave while the cat sits at home (master-timeline windows 0-0.12, 0.82-1)
    const wave = pixels(sprites.PAW_WAVE, pal.body, 0, CAT_Y).join("");
    cat.push(`<g opacity="0"><animate attributeName="opacity" values="1;1;0;0;1;1" keyTimes="0;0.12;0.13;0.82;0.83;1" calcMode="discrete" dur="${dur}s" begin="${INTRO_S}s" repeatCount="indefinite"/>` +
        `<g><animate attributeName="opacity" values="1;0;1" calcMode="discrete" dur="0.5s" repeatCount="indefinite"/>${wave}</g></g>`);
    if (weekendShades) cat.push(...pixels(sprites.SHADES, pal.shades, 0, CAT_Y));
    if (state === "content") cat.push(...hearts(pal));
    if (state === "zoomies") {
        [[-46, 30], [-64, 55], [-40, 80]].forEach(([ox, oy], i) => {
            cat.push(`<rect x="${ox}" y="${CAT_Y + oy}" width="${6 * PX}" height="3" fill="${pal.body}" opacity="0.6"><animate attributeName="opacity" values="0.6;0.1;0.6" dur="0.5s" begin="${i * 0.15}s" repeatCount="indefinite"/></rect>`);
        });
    }
    if (state === "overheat") {
        // steam puffs rising off the overheating cat (rides inside the moving group)
        ([[40, "0s"], [56, "0.5s"], [72, "1s"]] as Array<[number, string]>).forEach(([sx, beg]) => {
            cat.push(`<rect x="${sx}" y="${CAT_Y - 10}" width="6" height="6" rx="3" fill="${pal.ground}" opacity="0"><animate attributeName="y" values="${CAT_Y - 10};${CAT_Y - 44}" dur="1.6s" begin="${beg}" repeatCount="indefinite"/><animate attributeName="opacity" values="0;0.9;0" keyTimes="0;0.3;1" dur="1.6s" begin="${beg}" repeatCount="indefinite"/></rect>`);
        });
    }
    cat.push("</g></g>");
    if (state === "release") cat.push(...rects(sprites.TROPHY, { y: pal.gold }, 740, GROUND_Y - 8 * 3, 3));
    return cat;
}

type SceneKey = [number, number | string];

function sceneAnimation(attribute: string, frames: SceneKey[], transform = "", smooth = false): string {
    const tag = transform ? "animateTransform" : "animate";
    const keys = [...frames];
    if (keys[0][0] > 0) keys.unshift([0, keys[0][1]]);
    if (keys.at(-1)![0] < PLAY_LOOP_SECONDS) keys.push([PLAY_LOOP_SECONDS, keys.at(-1)![1]]);
    const easing = smooth ? ` calcMode="spline" keySplines="${Array(keys.length - 1).fill("0.4 0 0.2 1").join(";")}"` : "";
    return `<${tag} attributeName="${attribute}"${transform ? ` type="${transform}"` : ""} values="${keys.map(key => key[1]).join(";")}" keyTimes="${keys.map(key => (key[0] / PLAY_LOOP_SECONDS).toFixed(6)).join(";")}" dur="${PLAY_LOOP_SECONDS}s" repeatCount="indefinite"${easing}/>`;
}

function gentleFace(pal: Pal, hungry: boolean): string {
    // Morph the same three paths; stacked faces produce ghosted eyes and mouths.
    const moods: SceneKey[] = hungry ? [
        [0, "calm"], [4.8, "calm"], [5.4, "hungry"], [6.4, "hungry"], [7, "calm"],
        [13, "calm"], [13.6, "happy"], [15.2, "happy"], [15.8, "calm"],
        [60, "calm"], [60.6, "happy"], [62.2, "happy"], [62.8, "calm"],
        [75, "calm"], [75.6, "hungry"], [76.4, "hungry"], [77, "calm"],
    ] : [
        [0, "calm"], [7.68, "calm"], [8.32, "happy"], [17.6, "happy"], [18.56, "calm"],
    ];
    const eyelids = [...moods];
    for (const at of [2.4, 10.8, 16.3, 23.2, 30.7, 37.1, 43.8, 50.4, 57.8, 64.1, 70.6, 78.4]) {
        const previous = moods.filter(([t]) => t <= at).at(-1);
        const next = moods.find(([t]) => t > at);
        if (previous?.[1] !== "calm" || (next && next[0] < at + 0.3)) continue;
        eyelids.push([at, "calm"], [at + 0.1, "blink"], [at + 0.16, "blink"], [at + 0.3, "calm"]);
    }
    eyelids.sort((a, b) => a[0] - b[0]);
    const gaze: SceneKey[] = [
        [0, "0 0"], [1.1, "0 0"], [1.7, "1.5 -0.5"], [2.3, "1.5 -0.5"], [2.9, "0 0"],
        [11.8, "0 0"], [12.4, "-1.5 -0.5"], [12.8, "-1.5 -0.5"], [13.4, "0 0"],
        [24, "0 0"], [24.6, "1.5 0"], [32.4, "1.5 0"], [33, "0 0"],
        [38, "0 0"], [38.6, "1.5 0"], [46, "1.5 0"], [46.6, "0 0"],
        [52, "0 0"], [52.6, "1.5 0"], [59, "1.5 0"], [59.6, "0 0"],
        [68, "0 0"], [68.6, "-1.5 0"], [69.5, "-1.5 0"], [70.1, "0 0"],
    ];
    const eye = (x: number, mood: number | string) => mood === "happy"
        ? `M${x - 4} 97 Q${x} 89 ${x + 4} 97 Q${x} 94 ${x - 4} 97 Z`
        : mood === "blink"
            ? `M${x - 3} 96 Q${x} 95.6 ${x + 3} 96 Q${x} 96.4 ${x - 3} 96 Z`
            : `M${x - 3} 96 Q${x} 89 ${x + 3} 96 Q${x} 103 ${x - 3} 96 Z`;
    const mouths: Record<string, string> = {
        calm: "M54 110 Q57 114 60 110 Q63 114 66 110",
        happy: "M54 110 Q57 115 60 110 Q63 115 66 110",
        hungry: "M54 112 Q57 110 60 111 Q63 110 66 112",
    };
    return `<g data-role="soft-face">` +
        `<g data-role="eye-gaze" transform="translate(0 0)">${sceneAnimation("transform", gaze, "translate", true)}` +
        [38, 82].map((x, index) => `<path data-role="eye-${index ? "right" : "left"}" d="${eye(x, "calm")}" fill="${pal.accent}">` +
            sceneAnimation("d", eyelids.map(([t, mood]) => [t, eye(x, mood)]), "", true) + "</path>").join("") +
        `</g><path data-role="face-nose" d="M57.5 104 L62.5 104 Q62 106 60 107 Q58 106 57.5 104 Z" fill="${pal.pink}"/>` +
        `<path data-role="face-mouth" d="${mouths.calm}" fill="none" stroke="${pal.accent}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">` +
        sceneAnimation("d", moods.map(([t, mood]) => [t, mouths[mood]]), "", true) + "</path></g>";
}

function playTracks(seed: number, hungry: boolean) {
    const plan = makePlayPlan(seed, hungry);
    const perch = YARN_X - 114;
    const home = hungry ? CAT_AT_BOWL : HOME_X;
    const cat: SceneKey[] = [[0, home], [3, home], [7, CAT_AT_BOWL], [18, CAT_AT_BOWL], [22, perch]];
    const ball: SceneKey[] = [[0, 0]];
    const paw: SceneKey[] = [[0, 0]];
    const hop: SceneKey[] = [[0, 0]];
    const thread: SceneKey[] = [[0, 0]];
    for (const { action, at: t, distance: d } of plan) {
        if (action === "chase") {
            ball.push([t, 0], [t + 1, d], [t + 3, d], [t + 5, 0], [t + 6, 0]);
            cat.push([t, perch], [t + 0.7, perch], [t + 2, perch + d], [t + 3, perch + d], [t + 5, perch], [t + 6, perch]);
            paw.push([t - 0.2, 0], [t, 1], [t + 0.5, 1], [t + 0.8, 0], [t + 2.5, 0], [t + 2.8, 1], [t + 5, 1], [t + 5.3, 0]);
            hop.push([t + 0.7, 0], [t + 1.1, hungry ? -1 : -3], [t + 1.6, 0]);
            thread.push([t + 2.5, 0], [t + 2.8, 1], [t + 5, 1], [t + 5.3, 0]);
        } else {
            const direction = action === "tug" ? -1 : 1;
            ball.push([t, 0], [t + 0.8, direction * d], [t + 1.8, direction * d], [t + 3, 0], [t + 4, 0]);
            if (action === "tug") {
                cat.push([t, perch], [t + 0.8, perch - d], [t + 1.8, perch - d], [t + 3, perch], [t + 4, perch]);
            }
            paw.push([t - 0.2, 0], [t, 1], [t + 2.8, 1], [t + 3.2, 0]);
            thread.push([t - 0.2, 0], [t, 1], [t + 2.8, 1], [t + 3.2, 0]);
        }
    }
    cat.push([65, perch], [72, home], [PLAY_LOOP_SECONDS, home]);
    const translate = (keys: SceneKey[], vertical = false): SceneKey[] => keys.map(([t, n]) => [t, vertical ? `0 ${n}` : `${n} 0`]);
    return {
        actions: plan.map(beat => beat.action).join(","),
        cat: sceneAnimation("transform", translate(cat), "translate", true),
        ball: sceneAnimation("transform", translate(ball), "translate", true),
        roll: sceneAnimation("transform", ball.map(([t, x]) => [t, `${Number(x) * 3} 18 140`]), "rotate", true),
        paw: sceneAnimation("transform", paw.map(([t, amount]) => [t, `${Number(amount) * 12} ${Number(amount) * -6}`]), "translate", true),
        hop: sceneAnimation("transform", translate(hop, true), "translate", true),
        thread: sceneAnimation("opacity", thread),
    };
}

function feedingHearts(pal: Pal): string {
    return `<g data-role="meal-hearts" opacity="1">` +
        sceneAnimation("opacity", [[0, 0], [10.2, 0], [11.5, 1], [16.6, 1], [18.2, 0]]) +
        [[92, 58, "0s"], [112, 76, "1.1s"], [77, 42, "1.8s"]].map(([x, y, begin]) =>
            `<g transform="translate(${x} ${y})" shape-rendering="crispEdges"><g opacity="0.8">` +
            `<animateTransform attributeName="transform" type="translate" values="0 0;4 -15" dur="2.8s" begin="${begin}" repeatCount="indefinite"/>` +
            `<animate attributeName="opacity" values="0;0.85;0.85;0" keyTimes="0;0.25;0.65;1" dur="2.8s" begin="${begin}" repeatCount="indefinite"/>` +
            rects(sprites.HEART, { h: pal.heart }, 0, 0, 2).join("") + "</g></g>"
        ).join("") + "</g>";
}

function mealBowl(pal: Pal, level: number): string {
    const x = BOWL_X;
    const fillHeight = Number((Math.max(0, Math.min(100, level)) * 0.28).toFixed(3));
    const parts = [
        `<g data-role="food-bowl" data-food-level="${level}">`,
        `<ellipse cx="${x + 36}" cy="156" rx="40" ry="4" fill="${pal.ground}" opacity="0.4"/>`,
        `<path d="M${x + 2} 133 Q${x + 36} 123 ${x + 70} 133 L${x + 59} 153 Q${x + 36} 162 ${x + 13} 153Z" fill="${pal.body}" stroke="${pal.collar}" stroke-width="2"/>`,
        `<ellipse cx="${x + 36}" cy="133" rx="32" ry="7" fill="${pal.bg}" stroke="${pal.collar}" stroke-width="2"/>`,
        `<defs><clipPath id="meal-fill"><rect x="${x + 7}" y="${138 - fillHeight}" width="58" height="${fillHeight}" /></clipPath></defs>`,
        `<g data-role="food-portions" clip-path="url(#meal-fill)">`,
    ];
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 6; col++) {
            const inset = row === 3 ? 9 : 0;
            if (row === 3 && (col === 0 || col === 5)) continue;
            parts.push(`<rect x="${x + 10 + col * 8 + (row % 2 ? 2 : 0)}" y="${132 - row * 6}" width="${6 - inset / 9}" height="5" rx="2" fill="${(row + col) % 3 ? pal.tag : pal.pink}"/>`);
        }
    }
    parts.push("</g>");
    // Only this little surface bite disappears; the stored ration is determined
    // by elapsed time and public pushes, never by how often visitors open it.
    if (level >= 12.5) {
        parts.push(`<circle data-role="little-bite" cx="${x + 36}" cy="${135 - fillHeight}" r="2.5" fill="${pal.pink}">` +
            `<animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.27;0.32;1" dur="32s" repeatCount="1" fill="freeze"/></circle>`);
    }
    parts.push(`<path d="M${x + 32} 143 Q${x + 32} 140 ${x + 36} 143 Q${x + 40} 140 ${x + 40} 143 Q${x + 40} 146 ${x + 36} 149 Q${x + 32} 146 ${x + 32} 143" fill="${pal.bg}"/>`, "</g>");
    return parts.join("");
}

function gentleFeedingScene(pal: Pal, feeding: { level: number; hungry: boolean }, seed: number): string[] {
    const { level, hungry } = feeding;
    const start = hungry ? CAT_AT_BOWL : HOME_X;
    const play = playTracks(seed, hungry);
    const parts = [
        `<g data-role="gentle-feeding" data-mood="${hungry ? "hungry" : "content"}" data-play-seed="${seed}" data-play-actions="${play.actions}">`,
        `<rect x="${HOME_X - 16}" y="${GROUND_Y - 40}" width="80" height="40" fill="none" stroke="${pal.ground}" stroke-width="2"/>`,
        `<path d="M${HOME_X - 16} 118 L${HOME_X + 24} 106 L${HOME_X + 64} 118" fill="none" stroke="${pal.ground}" stroke-width="2"/>`,
        `<g data-role="play-yarn" transform="translate(${YARN_X} 0)"><g>${play.ball}` +
            `<path data-role="yarn-thread" d="M18 145 Q5 157 -7 145" fill="none" stroke="${pal.yarn}" stroke-width="2" opacity="0">${play.thread}</path>` +
            `<g shape-rendering="crispEdges">${play.roll}${yarnProp(pal, PLAY_LOOP_SECONDS).join("")}</g></g></g>`,
        `<g data-role="cat-position" transform="translate(${start} 0)">`,
        play.cat,
        `<g data-role="play-hop">${play.hop}`,
    ];
    // One solid silhouette moves by two pixels: no detached head or large gulp.
    parts.push(`<g data-role="gentle-nibble">`);
    if (!hungry) parts.push(sceneAnimation("transform", [[0, "0 0"], [7.68, "0 0"], [8.96, "0 2"], [9.92, "0 0"], [11.2, "0 2"], [12.16, "0 0"]], "translate"));
    // Keep adjacent sprite rows solid at fractional animation positions.
    parts.push(`<g data-role="cat-silhouette" shape-rendering="crispEdges">`);
    // Move the original right foot, leaving no duplicate foot on the ground.
    const body = sprites.SIT_FRONT.map((row, index) => index === 15 ? row.slice(0, 14) + "..." + row.slice(17) : row);
    parts.push(...rects(body, { X: pal.body, p: pal.body, o: pal.body }, 0, CAT_Y));
    parts.push(...pixels(sprites.SIT_INNER_EARS, pal.pink, 0, CAT_Y));
    parts.push(...pixels(sprites.SIT_WHISKERS, pal.body, 0, CAT_Y));
    parts.push(...pixels(sprites.SIT_COLLAR_BAND, pal.collar, 0, CAT_Y));
    parts.push(...pixels(sprites.SIT_COLLAR_TAG, pal.tag, 0, CAT_Y));
    parts.push(...tailWag(pal, CAT_Y, hungry ? "4s" : "2.8s"));
    parts.push("</g>");
    parts.push(`<rect x="22" y="103" width="12" height="5" rx="2.5" fill="${pal.pink}" opacity="0.7"/><rect x="85" y="103" width="12" height="5" rx="2.5" fill="${pal.pink}" opacity="0.7"/>`);
    parts.push(gentleFace(pal, hungry));
    if (!hungry) {
        parts.push(`<g data-role="snack-paw" opacity="0">${sceneAnimation("opacity", [[0, 0], [7.68, 0], [8.32, 1], [11.52, 1], [12.48, 0]])}` +
            `<path d="M88 126 Q76 123 74 116" fill="none" stroke="${pal.collar}" stroke-width="8" stroke-linecap="round"/>` +
            `<circle cx="74" cy="116" r="5" fill="${pal.body}"/></g>`);
    }
    parts.push(`<g data-role="play-paw" transform="translate(0 0)" shape-rendering="crispEdges">${play.paw}` +
        `<rect x="84" y="146" width="18" height="12" fill="${pal.body}"/></g>`);
    parts.push("</g></g>");
    if (!hungry) parts.push(feedingHearts(pal));
    parts.push("</g>", mealBowl(pal, level));
    if (hungry) {
        const width = 156;
        const x = Math.min(WIDTH - width - 14, CAT_AT_BOWL + 2);
        const hint = level > 0 ? "Running low..." : "A little snack?";
        parts.push(`<g data-role="hungry-reminder" opacity="1">` +
            sceneAnimation("opacity", [[0, 0], [3, 0], [4, 1], [10, 1], [11, 0], [73, 0], [74, 1], [78, 1], [79, 0]]) +
            `<rect x="${x}" y="16" width="${width}" height="32" rx="8" fill="${pal.bg}" stroke="${pal.ground}" stroke-width="1.5"/>` +
            `<path d="M${x + 28} 48 L${x + 36} 55 L${x + 41} 48" fill="${pal.bg}" stroke="${pal.ground}" stroke-width="1.5"/>` +
            `<text x="${x + width / 2}" y="37" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="15" fill="${pal.text}">${hint}</text></g>`);
    }
    parts.push("</g>");
    return parts;
}

export interface SceneOpts {
    hackingOn?: string;   // repo name for the rotating "hacking on X" bubble
    streakDays?: number;  // >= 3 lights the campfire
    birthday?: boolean;   // account's github-iversary: cake with candle
    hour?: number;        // owner-local hour 0-23, drives the sky phase
    bodyOverride?: string;
    accent?: string;      // "#rrggbb" brand color override (accent + collar)
    weekend?: boolean;    // owner-local Sat/Sun: shades + lemonade for happy states
    topLang?: string;     // sleeping cat dreams in this language
    seasonal?: string;    // "pumpkin" | "nye" | ""
    touchGrass?: boolean; // streak >= 21: the sign appears
    confetti?: boolean;   // star/follower milestone this run
    labelExtra?: string[]; // extra " · "-joined caption-strip segments
    updatedAt?: string;   // UTC timestamp of this activity snapshot
    compact?: boolean;
    quiet?: boolean;     // hide speech bubbles and public-activity labels
    feeding?: { level: number; hungry: boolean };
    playSeed?: number;
}

export function buildSvg(state: string, caption: string, palette = "dark", greeting = "hey! welcome to my corner", contact = "", attribution = true, opts: SceneOpts = {}): string {
    WIDTH = opts.compact ? 450 : 894;
    HEIGHT = opts.quiet ? 190 : opts.compact ? 244 : 222;
    HOME_X = opts.compact ? 30 : 70;
    YARN_X = opts.compact ? 225 : 430;
    BOWL_X = opts.compact ? 360 : 640;
    CAT_AT_BOWL = opts.compact ? 235 : 500;
    CAT_AT_YARN = opts.compact ? 115 : 320;
    if (opts.feeding && opts.compact) {
        YARN_X = 195;
        CAT_AT_YARN = 75;
    }
    const pal: Pal = { ...PALETTES[palette] };
    PAL_CURRENT = pal;
    if (opts.bodyOverride) pal.body = opts.bodyOverride;
    if (opts.accent && /^#[0-9a-f]{6}$/i.test(opts.accent)) {
        pal.accent = opts.accent;
        pal.collar = opts.accent;
    }
    if (state === "overheat" && !opts.feeding) pal.body = "#ff7b72";
    const colors = { X: pal.body, p: pal.pink };
    const description = opts.quiet
        ? "A pale-blue pixel cat with a bowl, yarn, and a little home."
        : `${caption}. Public activity snapshot${opts.updatedAt ? ` generated ${opts.updatedAt}` : ""}.`;
    const parts = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${opts.quiet ? "Little company" : `github pet: ${esc(state)}`}">`,
        `<title>${opts.quiet ? "Little company" : `Little company - ${esc(state)}`}</title>`,
        `<desc>${esc(description)}</desc>`,
        `<rect width="${WIDTH}" height="${HEIGHT}" fill="${pal.bg}"/>`,
        ...sky(pal, skyPhase(opts.hour ?? 12), palette === "dark"),
        `<line x1="0" y1="${GROUND_Y}" x2="${WIDTH}" y2="${GROUND_Y}" stroke="${pal.ground}" stroke-width="2" stroke-dasharray="8 8"/>`,
    ];
    if ((opts.streakDays ?? 0) >= 3) parts.push(...fireProp(pal));
    if (opts.touchGrass) parts.push(...signProp(pal));
    if (opts.birthday) parts.push(...cakeProp(pal));
    if (opts.seasonal === "pumpkin") parts.push(...rects(sprites.PUMPKIN, { o: pal.pumpkin, g: pal.tag }, 150, GROUND_Y - 7 * 3, 3));
    if (opts.seasonal === "nye") parts.push(...fireworksProp(pal));
    const shadesOn = !!opts.weekend && ["content", "zoomies", "release"].includes(state);
    if (opts.weekend && state !== "sleeping" && state !== "hibernating") {
        parts.push(...rects(sprites.LEMONADE, { y: pal.lemon, s: pal.pink }, BOWL_X + 110, GROUND_Y - 6 * 3, 3));
    }
    if (opts.feeding) {
        parts.push(...gentleFeedingScene(pal, opts.feeding, opts.playSeed ?? 1));
    } else if (state === "sleeping" || state === "hibernating") {
        parts.push(...sleepingCat(pal, colors, opts.topLang ?? ""));
    } else {
        const dur = STATE_TEMPO[state] ?? 32;
        const intro = state === "content" || state === "zoomies" || state === "release";
        parts.push(...props(pal, colors, state, dur, [0.66, 0.78], intro ? INTRO_S : 0));
        parts.push(...routineCat(state, pal, colors, shadesOn));
        if (!opts.quiet) {
            parts.push(...welcome(pal, greeting));
            parts.push(...guideBubbles(pal, contact, opts.hackingOn ?? ""));
        }
    }
    if (opts.confetti) parts.push(...confettiProp(pal));
    if (!opts.quiet) {
        const label = caption.length > 92 ? caption.slice(0, 89) + "..." : caption;
        const lines: string[] = [];
        if (opts.compact && label.length > 46) {
            const at = label.lastIndexOf(" ", 46);
            const split = at > 0 ? at : 46;
            lines.push(label.slice(0, split), label.slice(split).trim().slice(0, 46));
        } else lines.push(label);
        lines.forEach((line, index) => parts.push(`<text x="16" y="${184 + index * 19}" font-family="monospace" font-size="14" fill="${pal.text}">${esc(line)}</text>`));
        const detail = opts.updatedAt ? `${opts.compact ? "SNAPSHOT" : "PUBLIC ACTIVITY"} / ${opts.updatedAt}` : "PUBLIC ACTIVITY SNAPSHOT";
        parts.push(`<text x="16" y="${HEIGHT - 15}" font-family="monospace" font-size="12" fill="${pal.text}">${esc(detail)}</text>`);
    }
    if (attribution && !opts.compact) parts.push(`<text x="${WIDTH - 16}" y="${HEIGHT - 15}" text-anchor="end" font-family="monospace" font-size="12" fill="${pal.text}">Tomo / prsdx</text>`);
    parts.push("</svg>");
    return parts.join("\n");
}
