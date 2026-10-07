# Credits and Maintenance

- Pixel cat: adapted from [prsdx/YourTomo](https://github.com/prsdx/YourTomo), commit `62052fd7f26da4d43bf5eb6d44499dcb6c82ecf9`, MIT license. Only `render.ts`, `sprites.ts`, and `state.ts` are vendored in `scripts/vendor/tomo/`. Changes: pale-blue palettes, compact mobile layout, accessible descriptions, gentle feeding poses, smiling faces, meal hearts, a data-driven food bowl, and playful yarn routines.
- Technology icons: [tandpfun/skill-icons](https://github.com/tandpfun/skill-icons), commit `7f7e691e71aec64e8354bf697835e009d1ad80f8`, MIT license in `assets/skill-icons-LICENSE`. Locally stored light/dark icon strips retain the upstream artwork.
- Project screenshot: from this account's public [Agent_Platform](https://github.com/Sevrenaie/Agent_Platform) repository.
- The original snowy-cat banner and paw trail are retained.

## Activity Snapshot

The cat reads only the account's public events and public owned-repository list.
Private events, private repositories, other authors, future-dated events, and
the profile repository itself are excluded. Repository `pushed_at` is not used
as evidence of the owner's work. The public feed is limited to the latest 100
available events, so a quiet feed does not mean there was no other activity.

Each eligible public push adds 25% of a bowl, capped at 100%. A serving is
consumed over 48 hours of elapsed time. The calculation replays recent pushes
in time order, discards overflow, and deduplicates event IDs. Private work and
profile updates do not feed the cat. Food below 12.5% produces a gentle,
occasional reminder; otherwise the cat nibbles, smiles, and releases hearts.

Reminders are in English. Between meals the cat taps, chases, and tugs the
yarn, with quiet pauses in an 80-second loop. Each snapshot seeds a new
pseudo-random action order, timing, and travel distance, shared across themes
and screen sizes. A hungry cat still plays, but more gently, and returns to
the bowl for its reminder. This is pre-rendered SVG animation, not per-visitor
randomness or pointer interaction. Reduced-motion artwork remains still.

The yarn-playing paw is the original rectangular front foot, not an extra
curved arm. It keeps its size and moves at most 12 pixels sideways and
6 pixels upward. The cat sits close to the yarn and scoots with it while
tugging, so its paw stays connected without stretching.

The resting face has round eyes, a tiny nose, and a small smile. Single eye
and mouth paths morph continuously instead of crossfading overlapping faces.
Glances travel at most 1.5 pixels; occasional blinks take 300 milliseconds.
Even when food is low, a slight pout appears for only about four seconds per
80-second loop, while asking near the bowl. The cat otherwise smiles,
including in the reduced-motion artwork.

The workflow runs on a six-hour schedule and can be run manually. GitHub may
delay scheduled runs. The bowl is a snapshot from the available public feed,
not a live measure of all work. Its level falls on subsequent scheduled
updates; the small animated bite is decorative. Page visits do not consume
or refill the stored ration. Old activity labels and timestamps stay hidden.
No personal access token, external app, or hosted statistics service is needed.
API failures fail the job without replacing the previous artwork.

## Local Checks

Requires Node.js 24 and Python 3, with no third-party package installation:

```sh
node --test scripts/update-cat.test.mjs
node scripts/update-cat.mjs
python3 scripts/static-scenes.py
python3 scripts/check-assets.py
```

The scheduled workflow stages only the eight generated `assets/cat-*.svg` files.
