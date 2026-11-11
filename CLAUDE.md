# Long Way Home

Single-screen worker-placement roguelike, as a web prototype. **Read `GDD.md` first.** It's the source of truth for the design, the rules and the open questions.

## Commands

- `npm run build`: inlines `src/` into `index.html`. Open the file directly in a browser; no server is needed.
- `npm run sim`: a headless bot plays 2000 runs and prints the season reached and the reasons it lost. Run it after any rules or balance change.

## Layout

- `src/logic.js`: all rules and state, with **no DOM**. Tunable numbers sit at the top in `CFG`, `TYPES`, `THREATS`, `MODS` and `UPGRADES`. Functions the sim needs are exported at the bottom.
- `src/ui.js`: rendering, input (event delegation on `data-act`), sound, and the end-of-turn replay. `endTurn()` returns `report.events`, an ordered list (`act`, `step`, `pile`, `tgrow`, `clear`, `bounty`, `spawn` for the bonus threat, `meal`, `recall`, `overrun`). The UI swaps `S` for a copy of the pre-turn state, steps it forward one event at a time with a popup, a flying icon and a rising-pitch sound, then restores the real state.
- `src/template.html`: markup and CSS. Design tokens live in `:root`. `--px` is the whole-number sprite scale (2 on phones, 3 from 640px).
- `assets/`: Kenney CC0 tile sheets (`img/`) and sounds (`sfx/`); see `assets/CREDITS.md` for sources and how sprite codes like `F66` map to tiles.
- `tools/build.js`: inlines `src/` and every `{{asset:...}}` reference (as base64) into `index.html`. `tools/sim.js`: the headless bot.
- `index.html`: **generated**. Never edit it by hand. It's committed so the game opens without a build step.

## Working rules

- Keep `logic.js` free of DOM code so the sim keeps working. Export any new function the sim uses.
- When a rule changes, update `GDD.md` in the same commit: the relevant section plus a changelog line.
- After balance changes, run the sim and record the headline numbers in GDD §10.
- Mobile first: check layouts at about 390px wide.
- Respect the pillars in GDD §3. In particular, no AI opponents: pressure comes from the board.
- Rebuild (`npm run build`) before committing so `index.html` matches `src/`.
