# Credits and Maintenance

- Pixel cat: adapted from [prsdx/YourTomo](https://github.com/prsdx/YourTomo), commit `62052fd7f26da4d43bf5eb6d44499dcb6c82ecf9`, MIT license. Only `render.ts`, `sprites.ts`, and `state.ts` are vendored in `scripts/vendor/tomo/`. Changes: pale-blue palettes, shorter scene text, bounded footer, compact mobile layout, timestamp and accessible description.
- Technology icons: [tandpfun/skill-icons](https://github.com/tandpfun/skill-icons), commit `7f7e691e71aec64e8354bf697835e009d1ad80f8`, MIT license in `assets/skill-icons-LICENSE`. Locally stored light/dark icon strips retain the upstream artwork.
- Project screenshot: from this account's public [Agent_Platform](https://github.com/Sevrenaie/Agent_Platform) repository.
- The original snowy-cat banner and paw trail are retained.

## Activity Snapshot

The cat reads only the account's public events and public owned-repository list.
Private events, private repositories, other authors, future-dated events, and
the profile repository itself are excluded. Repository `pushed_at` is not used
as evidence of the owner's work. The public feed is limited to the latest 100
available events, so a quiet feed does not mean there was no other activity.

The workflow runs on a six-hour schedule and can be run manually. GitHub may
delay scheduled runs, and the SVGs show the UTC time of their last snapshot.
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
