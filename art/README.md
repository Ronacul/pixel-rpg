# Art (first batch, not yet wired into the game)

Original, palette-indexed pixel art plus a lab to review it. Open `art/lab.html` through any static server (or the live site at `/art/lab.html`).

## Format
- `palette.json`: the 16-colour master palette. Sprite rows use its hex digits `0-9 A-F`, `.` for transparent, and lowercase letters as **recolour roles**.
- `roles.json`: role colour sets per group (`biome`, `race`, `class`, `monster`, `gem`). The renderer merges one entry per group, so one tile set serves all five biomes, and one hero body serves every race and class.
- `sprites/*.json`: `{ "id": { "mirror": true, "outline": true, "rows": [...] } }`. `mirror` stores only the left half of each row; `outline` adds a 1px outline around the opaque pixels. 16x16 unless `size` says otherwise.
- `sprite-lib.js`: loader, expander, role recolouring, `compose()` for stacking layers (the hero is body + race + class + weapon + shield), and the measurements below.
- `manifest.json`: list of sprite files to load.

## Measurements shown in the lab
pixels, colours used, fill, **readable** (share of pixels with at least 2:1 contrast against the dark floors; aim for 40%+), **look-alike** (closest other silhouette, IoU; above 0.75 reads as the same shape), and **delta** (pixels changed since a saved baseline).

## Adding a sprite
Add an entry to a `sprites/*.json` file (or a new file listed in `manifest.json`), reload the lab, fix any validation errors it reports, and check readable / look-alike.
