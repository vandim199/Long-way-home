# Long Way Home

Single-screen worker-placement roguelike, as a web prototype. **Read `GDD.md` first.** It's the source of truth for the design, the rules and the open questions.

## Commands

- `npm run build`: inlines `src/` into `index.html`. Open the file directly in a browser; no server is needed.
- `npm run sim`: a headless bot plays 2000 runs and prints the season reached and the reasons it lost. Run it after any rules or balance change.

## Layout

- `src/logic.js`: all rules and state, with **no DOM**. Tunable numbers sit at the top in `CFG`, `TYPES`, `THREATS`, `MODS` and `UPGRADES`. Functions the sim needs are exported at the bottom.
- `src/ui.js`: rendering and input (event delegation on `data-act`).
- `src/template.html`: markup and CSS. Design tokens live in `:root`.
- `tools/build.js`, `tools/sim.js`.
- `index.html`: **generated**. Never edit it by hand. It's committed so the game opens without a build step.

## Working rules

- Keep `logic.js` free of DOM code so the sim keeps working. Export any new function the sim uses.
- When a rule changes, update `GDD.md` in the same commit: the relevant section plus a changelog line.
- After balance changes, run the sim and record the headline numbers in GDD §10.
- Mobile first: check layouts at about 390px wide.
- Respect the pillars in GDD §3. In particular, no AI opponents: pressure comes from the board.
- Rebuild (`npm run build`) before committing so `index.html` matches `src/`.
