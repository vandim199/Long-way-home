# Long Way Home — Game Design Document

*Working title.* Single-screen worker-placement roguelike.
**Status:** playable web prototype **v0.7** (12 Nov 2026). Villagers carry their goods home, 👣1 means "back next turn", watering is its own space, and the Bakery and Fletcher sit next to home.

This document is the source of truth for the design. The numbers live in `src/logic.js` (`CFG` and the tables at the top). If this doc and the code disagree, decide which one is right and fix the other.

---

## 1. Pitch

Send villagers out from your home to wells, fields, forests and workshops. They take the long way home: a villager is away for as many turns as the space is far, the space stays locked until they're back, and whatever they gathered only reaches your store when they walk in the door. Water your fields, bake bread, keep everyone fed, and stop each season's threat (fire, monsters) before time runs out. Stop it early and the rest of the season is yours: stock up, or chase an optional bonus threat for a second payday. Between seasons you spend coins on a few scarce upgrades that change how you play. The run structure is Balatro's: beat each season's target or the run is over.

## 2. Inspirations and what we take from each

| Source | What we borrow |
|---|---|
| Castles of Burgundy, Lost Ruins of Arnak | Few actions, more wants than you can do. Every action is simple and the depth comes from choosing. |
| Agricola, Caverna | Feeding pressure. Action spaces that pile up when nobody takes them. A food chain you have to build. |
| Balatro | Seasons work like blinds: beat the target or the run ends, with no second chances. A shop between seasons. Sandbox modifiers you apply to the villager you choose. Juicy scoring: payouts tick up one at a time, each a little higher in pitch. |
| Slay the Spire | The template: take a board game mechanic (worker placement) and put it inside a roguelike run. |

## 3. Design pillars

1. **Want more than you can do.** Too few actions is the core tension. If players can comfortably do everything, something is wrong.
2. **Simple actions, deep choices.** Every action must be explainable in one sentence.
3. **Time is the cost.** Distance means turns away. A computer can run these timers, which would be fiddly on a real table, and that's the reason this is a video game.
4. **Threats are final.** Failing a season's threat ends the run, with no hearts and no second chances. This is a firm designer decision: it's where the tension comes from.
5. **Accumulate, then cash in.** Upkeep must not be a treadmill. Let piles grow, then convert them in one satisfying visit.
6. **Scarce but impactful upgrades.** Each purchase should change how you play, not add +1%.
7. **No AI opponent.** Pressure comes from the board itself (threats, hunger, piles that grow), not from rivals that need their own balancing. The designer explicitly rejected AI rivals.

## 4. Structure

- **Run:** 8 seasons. Survive all 8 to win.
- **Season:** always 8 turns. The season's threat must be brought to 0 by the end of turn 8, or the run is over. Meals happen after turns 3, 6 and 8.
- **Stopping the threat early** pays its bounty immediately (bigger the earlier it is) and the season carries on. The remaining turns are free for farming and stocking up, and an optional bonus threat appears (§8). *Why: in v0.1 an early clear ended the season on the spot, with the season-end meal before anything could be baked, so winning early could starve you. Early victory should feel like a reward.*
- **Turn:**
  1. **Plan.** Assign any number of villagers who are home to spaces. Payouts are previewed on the tiles.
  2. **End turn**, which resolves in this order:
     1. Everyone sets out. Costs leave the store (converter input, fighting supplies). Fights deal damage immediately. What a villager gathers or makes goes into their pockets, not the store.
     2. Irrigation pours water into the fields, using whatever water the fights left (§6).
     3. Growth: every gathering space nobody is away from grows (see §6). A space visited this turn doesn't grow this turn.
     4. Everyone out takes one step home. Anyone who arrives unlocks their space and unloads their pockets into the store.
     5. If the season's threat is at 0, it's stopped: the bounty is paid and the bonus threat appears. Otherwise, if nobody fought it this turn, it grows.
     6. If the bonus threat is at 0, it's stopped and its reward is paid.
     7. The meal check, if it's a meal turn. Goods that arrived in step 4 count.
     8. After turn 8: if the threat is still above 0, the run is lost. Otherwise everyone comes home and unloads, the season-end meal happens and the market opens.
- **Between seasons:** the market (§9). Everyone comes home and all spaces unlock. Piles and soaked water carry over. An unfinished bonus threat leaves.

## 5. Board

- 5×5 grid with home at the center. **Travel time = Manhattan distance from home** (1–3).
- **Random layout each run.** 9 spaces: 4 at distance 1, 3 at distance 2, 2 at distance 3. Home is always fully surrounded.
  - Spaces: Irrigation, Bakery and Fletcher (always next to home), Field ×2, Well, Forest, Mine, plus one extra Field, Well or Forest.
  - **Layout rule:** the Bakery, Fletcher and Irrigation are the village workshops and always sit next to home (👣1). The Well and Forest are never at distance 3; the only exception is an extra Well or Forest, and only if its twin is closer. The Mine is never at distance 1.
  - *Why workshops are next to home (v0.7):* with goods arriving on return, a Fletcher at distance 2 made the arrow chain Forest → Fletcher → fight take 4–5 turns, and the first monster season was lost far more often than the first fire season (bot: 15% vs 0%). Next to home, the chain takes at most 3 turns, and baking gets just as quick. *Why: the threat is final, so the layout alone must never make a run unwinnable. The layout should change the puzzle, not decide whether it can be solved.*
- Each season the threat appears on a free cell at distance 2–3. The bonus threat takes another free cell at distance 2–3. Where a threat sits doesn't change its travel time (§7).

## 6. Spaces and the economy

```
Well ──💧──► Irrigation (2💧 per field) ──► Field (+2🌾 per soaked 💧) ──🌾──► Bakery (2🌾 → 1🍞) ──► meals
  └──💧───────────────────────────────────────────────────────────────► fight 🔥 Fire (gets its water first)
Forest ──🪵──► Fletcher (1🪵 → 2🏹) ──► fight 👹 Monsters
Mine ──🪙──► market
```

| Space | Kind | Visit does | Base | Grows when free |
|---|---|---|---|---|
| Well | gather | take 💧 | 2 | +1 per turn |
| Forest | gather | take 🪵 | 2 | +1 per turn |
| Mine | gather | take 🪙 | 1 | +1 per turn |
| Field | gather | take 🌾 | 1 | **+2🌾 per turn, using 1 soaked 💧** (none when dry) |
| Irrigation | water | pour 2💧 into **every** field the store can cover; bring nothing home. Always 👣1 | — | — |
| Bakery | convert | **all** wheat in store, 2🌾 → 1🍞 per batch | — | — |
| Fletcher | convert | **all** wood in store, 1🪵 → 2🏹 per batch | — | — |

- **Gather yield** = base + (distance − 1) + pile, +2 per Forager modifier. Far spaces start bigger. Harvesting resets the pile to 0.
- **Locked spaces don't grow.** Harvesting often has a hidden cost. A watered field also waits until its villager is home before the soaked water starts turning into wheat.
- **Fields and water (v0.6).**
  - A Field visit only harvests.
  - Watering is its own space, **Irrigation**, always next to home and always 👣1. One visit pours 2💧 into each field, driest first, for as many fields as the store can cover. The villager brings nothing home.
  - **Fire comes first.** Irrigation doesn't reserve water when you plan it. At the end of the turn the fights take their water, and Irrigation uses what's left. Its preview updates as you plan fights.
  - Each turn the field is free and has soaked water, it turns 1💧 into +2🌾 (+1 per Fertile). A dry field doesn't grow; it only gives its base.
  - The tile's water badge shows the soaked water, plus "+2" when a planned Irrigation will reach it.
  - Water is contested: the same 💧 grows food and fights fire. **Fire seasons are hungry seasons.**
  - *Why a separate space:* watering used to ride along with every harvest (with a "tap again for harvest only" toggle). Making it one visit that waters everything is clearer, and it turns watering into a real decision about a body, not a hidden default.
- **Converters process the whole store in one visit.** The Bakery bakes floor(wheat ÷ 2) batches; leftover odd wheat stays. Output per batch = base output + Better tools, ×2 if the villager is an Artisan. The input leaves the store when the baker sets out; the bread arrives when they get home.
- **Only stock already in your store can be poured or converted.** Goods still in someone's pockets can't be used. This is intentional: sending everyone out can leave wheat sitting unbaked, and a far harvest can arrive too late for a meal.
- **Why converters aren't capped any more:** in v0.1 the Bakery baked at most 3 per visit and then locked. Feeding 3 villagers took about half of all actions, and players starved even while the Bakery was always busy. The only time food felt fine was with Strong, which raised that cap. An uncapped Bakery turns upkeep into accumulate-then-cash-in (pillar 5).

## 7. Villagers and travel

- Send as many villagers as you like each turn. One villager per space; a threat accepts any number (until the planned damage would finish it).
- **👣N means the villager is usable again N turns later.** 👣1 = back next turn, 👣2 = the turn after. N = distance − roads − Swift, minimum 1. While they're away you can't use that villager or that space.
- **Goods travel with the villager.** Whatever they gather or make lands in the store when they arrive home: from a 👣1 space it's usable next turn, from 👣2 in two turns, and so on. Far spaces start bigger, but their goods come late.
- **Threats and Irrigation are always a 1-turn trip**, wherever they sit. Fighters are back next turn, so fighting competes with gathering for *bodies*, not for walking time. Damage lands immediately.
- At season end everyone comes home and unloads before the season-end meal.
- *Why (v0.6):* before, 👣1 actually meant "misses the next turn", which read wrong, and goods appeared in the store the moment a villager left. Now the badge means what it looks like, and carrying goods home makes distance cost time twice: for the villager and for the goods. It's also the game's title.
- Pouring, converting and fighting **reserve** the input from your store when you assign them, so the preview is exactly what happens.
- Starting crew: 3 villagers.

## 8. Threats, food and failure

**Threats** alternate each season (the first is random).

| Threat | Fight with | Damage | Strength multiplier |
|---|---|---|---|
| 🔥 Fire | 💧 water | 1 per water | **×0.55 → ×0.85** (full by season 4) |
| 👹 Monsters | 🏹 arrows | 1 per arrow | **×1 → ×2.2** (full by season 4) |

- Strength in season *s* = **(7 + 7(s − 1)) × that season's multiplier**, rounded: fire 4, 9, 16, 24, 30, 36, 42, 48; monsters 7, 20, 38, 62, 77, 92, 108, 123.
- *Why monsters are tougher:* with the Fletcher making 2 arrows per wood and an uncapped visit, arrows are cheap, while water is split between fields and firefighting. At equal strength, monster seasons failed about a fifth as often as fire seasons. *Why the multipliers ramp (v0.7):* the two threats have different curves. Fire is hardest early, while water is split between the fields and firefighting and the Wells deliver late. Monsters are easy early (one Fletcher visit doubles your wood) and hard late. Flat multipliers either crushed early fire or let late monsters run away; ramping both to their full values by season 4 keeps every season's fail rate for both types between about 0% (seasons 1–2) and 25%.
- It grows by **1 + floor((s − 1)/2)** on any turn nobody fights it: +1 in seasons 1–2, +2 in 3–4, +3 in 5–6, +4 in 7–8.
- Each villager delivers up to their carry (3, +3 per Strong). Brave adds +2 damage, even with nothing to deliver. Bigger threats mean you send several fighters at once.
- **Not stopped by end of turn 8: the run is over.** This is final; see pillar 4.
- **Bounty** for stopping it = 3 + season + unused turns, paid the turn it's stopped.

**Bonus threat (optional)**
- Appears as soon as the season's threat is stopped (unless that happened on turn 8). It's the other type: stopping fire summons a bonus monster band, and vice versa. Chasing it usually means setting up a supply chain you haven't been using this season.
- **Half** the season's starting strength (with its multiplier): fire 2, 5, 8, 12 … 24; monsters 4, 10, 19, 31 … 62. It never grows and ignoring it costs nothing. It leaves at season end.
- Reward for stopping it by the end of turn 8: 3 + season 🪙.
- The point: early victory buys free turns, and the player chooses between safe farming (bread for the meals ahead) and a second payday.

**Food**
- Meals after turns 3 and 6, and at season end (after turn 8). `CFG.mealTurns` sets the mid-season ones.
- Each villager eats 1🍞, **+1 for every modifier past their first**, −1 per Hearty (minimum 0). **Hearty doesn't count toward the stacking penalty** (fixed in v0.7): Hearty + Golden eats 0, Hearty + Golden + Swift eats 1. Before, Hearty + any one modifier still ate 1, because Hearty itself triggered the penalty it was meant to offset.
- Each missing bread costs 1 ❤. You start with 5 ❤ (max 5). **At 0 ❤ the run is over.**
- Feeding 3 villagers takes 9🍞 a season, which is 18🌾: about 9 soaked 💧, or 2–3 Irrigation visits for two fields.

**Starting state:** store 2🌾 4🍞 4💧 1🪵 0🏹 2🪙. Each Field starts with a pile of 2 and 2 soaked water.

## 9. Economy and market

**Coins** come from the Mine, the Golden modifier, season bounties and bonus-threat rewards.

**Market:** 3 random offers after each season. New offers cost 2🪙, and each further reroll costs 1 more. Buy as many as you can afford. Targeted upgrades go into "pick a target" mode, and cancelling is free.

| Offer | Price | Effect |
|---|---|---|
| New villager | 7, +4 each time | +1 worker (eats at every meal) |
| Swift 👟 | 5 | Travel −1 (minimum 1) |
| Strong 💪 | 4 | +3 carry when fighting |
| Forager 🧺 | 5 | +2 when gathering |
| Artisan 🔨 | 5 | Double output at the Bakery or Fletcher |
| Golden ✨ | 6 | +1🪙 every time they act |
| Brave 🛡️ | 4 | +2 damage when fighting |
| Hearty 🍖 | 4 | Eats 1 less |
| Road 🛤️ | 4 | One space: travel −1 (minimum 1) |
| Fertile 🌱 | 4 | One gathering space grows +1 more per turn (Fields: +1🌾 per soaked 💧) |
| Better tools ⚒️ | 5 | Bakery or Fletcher: +1 output per batch |
| Festival 🎉 | 3 | +2 ❤ (only offered below max hearts) |

**Stacking modifiers (decided):** modifiers stack freely on one villager. A jack of all trades is allowed, but they're a single point of failure: they're in one place at a time and spend turns walking home. Their appetite also grows with every modifier past the first. If heroes still dominate, the fallback is a hard limit of 2–3 modifiers per villager.

**Specialists multiply, they don't rescue.** The base economy must be survivable with no modifiers. Modifiers like Artisan double what you get; they shouldn't be needed just to stay alive.

## 10. Balance (bot simulation)

`npm run sim` runs a heuristic bot (`tools/bot.js`) through 2000 runs. `npm run sweep` runs a grid of `CFG` overrides and ranks them against the targets below. The bot is a floor and a crash detector, not a stand-in for a good player.

**Targets for the bot:** about 90% clear season 1; about 10–15% win the full run; fire and monsters fail at about the same rate per season faced; hunger and threats both matter.

**v0.7 tuned values** (4000 runs):

| Metric | Result |
|---|---|
| Clears season 1 | 100% |
| Wins the full run | 15% |
| Average seasons cleared | 4.3 |
| Runs lost to hunger | 21% |
| Fail rate per fire season | 11.7% |
| Fail rate per monster season | 12.8% |
| Fail rate in seasons 1 / 2 / 3 (fire, monsters) | 0%, 0% / 3%, 0% / 23%, 13% |
| Losses with the threat at ≤2 strength ("near misses") | 7% of runs |
| Bonus threats stopped per run | 0.19 |

**What the v0.7 tuning found**
- The designer found monsters far too strong early. The overall per-season averages (fire 13%, monsters 13%) hid it: split by season, the first monster season failed 15% and the first fire season 0%. **Always check fail rates per season and type, not just the averages.**
- Moving the Bakery and Fletcher next to home fixed early monsters but made them too easy overall (6% vs 16.5% for fire), and fire then hit a wall in season 2 (32%).
- Per-type ramps (fire ×0.55 → ×0.85, monsters ×1 → ×2.2, both full by season 4), threats at 7 + 7 per season and growth stepping up every 2 seasons smoothed both curves.
- Season 1 is now never lost by the bot (target was about 90%). That fits the designer's feedback, since early game felt too harsh. If season 1 feels dull, raise the season 1 multipliers.

**v0.6 tuned values** (for reference): season 1 92%, wins 12%, fire 13.1% / monsters 12.6% per season, losses split evenly between fire, monsters and hunger. Superseded because the first monster season was much harder than the first fire season.

**What the v0.6 sweep found** (on the v0.6 rules)
- 👣1 = next turn, plus goods carried home, plus the Irrigation space, on the v0.5 numbers: the bot won 62% and monster seasons almost never failed (0.3%). Faster villagers outweigh goods arriving later.
- The 216-combination sweep (threat start and step, growth, monster multiplier, meal schedule, field growth) favoured steeper threats (5 + 6.5 per season), monsters ×2, and fields at +2🌾 per soaked 💧 instead of +3. Meals after 3 and 6 beat 2/4/6, which pushed hunger above 40%.
- Steps of 6 and 7 per season bracketed the target (16% and 9% wins); 6.5 lands at 12%.
- The bonus threat at full strength was never stopped by the bot. At half strength it's stopped occasionally (0.08 per run) with no effect on the win rate, so it's a temptation rather than a wall.
- Losses are now split almost evenly between fire, monsters and hunger.

**What the v0.5 sweeps found**
- **Seasons that always last 8 turns** made the game much easier: free turns after an early clear are worth far more than the bounty. With 1-turn threats on top, the old bot won about 61%. A third meal (turns 3 and 6) was the strongest single lever to bring pressure back.
- **The new economy needed a smarter bot.** The v0.1 bot ignored watering and sat on 19 wheat without baking. `tools/bot.js` now waters fields, bakes in bulk, fletches when arrows run short and fights early; it clears season 1 about 98% of the time on the pre-tune numbers.
- **Fire vs monsters:** with cheap arrows, monster seasons failed about 2% of the time against 15% for fire. A ×1.5 strength multiplier for monsters lands them at parity.
- **Growth every 2 seasons vs 3:** every 3 wins about 15% with fire slightly harder than monsters; every 2 wins about 11% with near-perfect parity. Chose every 2.
- **Bonus threat:** the bot attacks it with spare villagers but almost never finishes one, because it only commits leftovers. Its strength and reward haven't been tuned for human players yet (see §11).
- *Earlier history:* the designer's first economy draft cleared season 1 only 60% of the time with threats at 5 + 2 per season; growing 3🌾 per soaked 💧 beat 2; starting bread and water mostly set how safe season 1 feels; buying villagers raises hunger losses but raises wins more. With uncapped converters alone, monster losses dropped about 80%, which confirmed the old caps were the bottleneck.

## 11. Known issues and open questions

- **Big threat numbers:** monsters reach 101 in season 8. The whole-store Fletcher makes that reachable, but check that late seasons don't feel like arithmetic. An alternative is fewer, bigger arrows (e.g. 1 wood → 1 arrow worth 2).
- **Carried goods visibility:** walkers show what they carry on their tile, and store chips show "+N" (arrives this turn) and "+N⏳" (later). Playtest whether players plan around arrival times or get surprised at meals.
- **Bonus threat value:** now half strength for 3 + season coins. If players never take it, try a non-coin reward (a free modifier, +1 ❤).
- **Near misses** end about 5% of bot runs. The threat stays final, so the fix has to come from information. Recommended next: the threat card shows the damage you have in stock (and arriving) against its strength, plus a warning when the math no longer works. That way a shortfall shows up on turn 5, not turn 8.
- **Dead turns:** when everyone is away, the only move is pressing End turn. Options: a home action that needs no villager, or skipping ahead to the next return automatically.
- **Wood has only one use** (arrows), while water has two. Should wood also build something (roads, a granary) so monster seasons have their own squeeze?
- **Irrigation choice:** it always waters the driest fields first. Should players be able to pick which fields?
- **Solved routes:** the layout is fixed within a run. Consider shuffling a space each season, or events.
- **Reservation quirk:** unassigning an earlier plan doesn't recalculate what later plans reserved.
- **Threats are passive:** should fire spread to a neighbouring space? Should monsters steal from piles?
- **Is Artisan too strong** with uncapped converters? Watch it in playtests.

## 12. Ideas backlog (not yet in the game)

- "Bad piles": spaces that grow trouble (rot, pests) and need a villager sent to clear them.
- Space upgrade: pays again when the villager gets home.
- Recall: pay to bring a villager home early.
- Events between or during seasons.
- More threat types, each fought with a different resource or route.
- Other themes considered: a lighthouse sending boats, a wizard sending familiars.

## 13. Decisions log

| Decision | Status | Why |
|---|---|---|
| No AI opponent | Rejected AI rivals | Extra balancing; pressure should come from the board |
| Threat failure ends the run | Kept (v0.2) | Tension, Balatro-style. Softening it to cost hearts was considered and rejected |
| Converters process everything in one visit | Adopted (v0.2 economy) | Capped converters made food a treadmill |
| 2🌾 → 1🍞, 1🪵 → 2🏹, fields need water | Adopted (v0.2 economy) | Designer's economy: water feeds wheat and competes with firefighting |
| Seasons always last 8 turns; early clear pays at once | Adopted (v0.3) | Winning early must never starve you; free turns are the reward |
| Optional bonus threat after an early clear | Adopted (v0.3) | Gives the free turns a goal without adding failure |
| Threats are a 1-turn trip | Adopted (v0.4) | Designer's call: fighting costs bodies, not walking time. Since v0.6 that truly means back next turn |
| Monsters ×1.5 strength (×2 in v0.6) | Adopted (v0.5) | Cheap arrows made monster seasons much easier than fire |
| Bakery and Fletcher always next to home | Adopted (v0.7) | Carried goods made the arrow chain too slow; early monster seasons were lopsided |
| Threat multipliers ramp by season, per type | Adopted (v0.7) | Fire is hard early, monsters late; flat multipliers couldn't balance both |
| Hearty excluded from the stacking penalty | Fixed (v0.7) | Hearty + one modifier still ate 1, which read as a bug |
| 👣N = usable again in N turns; goods arrive with the villager | Adopted (v0.6) | Badge means what it says; carrying home makes distance cost time twice |
| Watering is its own space (Irrigation), fire takes water first | Adopted (v0.6) | One clear decision instead of a hidden default on every harvest |
| Modifiers stack | Adopted (v0.1) | Sandbox; appetite is the brake |

## 14. Tech

- Vanilla JS, no dependencies, one self-contained page. Mobile-first (designed at about 390px wide).
- `src/logic.js` holds the rules and state and has no DOM. `src/ui.js` handles rendering and input. `tools/build.js` inlines both into `index.html`, along with the art and sound as base64, so the page still opens from `file://`.
- Saved state carries a version (`S.v`, `STATE_V` in `logic.js`). The UI discards state from an older version instead of crashing.
- **Save and session log** (`src/save.js`): the run autosaves to `localStorage` (`lwh-save`) after every action, so closing the page resumes at the same spot. A session log (`lwh-log`, last 5 runs) records one entry per turn (the pre-turn state with the plans, a readable plan list and the turn's result lines), market buys and rerolls, season starts, how each run ended, and notes the player types in the 💾 sheet (each note carries a snapshot). **Download log** saves it as JSON with a plain-text `summary` at the top, the `current` state and every entry. **Load from file** restores the `current` state from a downloaded log (or a save), which is how a reported scenario gets reproduced. If storage is full, old runs and then old snapshots are dropped before the save is.
- **Look and feel:** pixel-art harvest farm built from Kenney's CC0 Tiny Farm, Tiny Town and Tiny Dungeon sheets (`assets/`, see `assets/CREDITS.md`), scaled by whole numbers so pixels stay crisp. Parchment panels, wooden buttons, a wheat-field backdrop, Jersey 15 pixel font. Emoji only for small icons (modifiers, fire, footsteps).
- **End-of-turn replay:** `endTurn()` returns an ordered event list (`report.events`). The UI plays it back one beat at a time so the player can follow it: each villager walks out and pops their payout ("+3 🪵"), the icon flies into the store, then Irrigation sends water to each field, fields and piles grow, each walking villager's timer ticks down or they walk home and their goods fly into the store, the threat grows or is stopped, the bonus appears, then the meal. Every beat plays a Kenney sound pitched one step higher on a major pentatonic scale, so a big turn builds up. Tapping during the replay speeds it up. A mute toggle sits in the top bar.
- If the loop proves fun, consider porting to Unity. Keeping the rules DOM-free makes that port mostly a translation job.

## Changelog

- **v0.7.1 (2026-11-13):** save and session log. The run autosaves in the browser and resumes on reload. The 💾 button opens a sheet to add notes, download the session log as JSON, or load a save/log file back in. The end-of-run screen also has Download log. No rule changes.
- **v0.7 (2026-11-12):** early monsters and Hearty.
  - Bug fix: Hearty no longer counts toward the stacking penalty, so Hearty + one other modifier eats 0.
  - The Bakery and Fletcher always sit next to home (with Irrigation), so wood → arrows → fight takes at most 3 turns.
  - Threat strength is 7 + 7 per season × a per-type multiplier that ramps by season 4: fire ×0.55 → ×0.85, monsters ×1 → ×2.2. Growth +1 every 2 seasons. The bonus threat stays at half strength.
  - Bot: season 1 100%, wins 15%. First monster season fails 0% (was 15%).
- **v0.6 (2026-11-12):** travel, carrying and watering.
  - 👣N now means the villager is usable again N turns later (👣1 = next turn). Previously 👣1 meant missing the next turn.
  - Goods are carried home and reach the store when the villager arrives. Converter input leaves the store at departure; output arrives on return. Fight damage is immediate. Everyone unloads before the season-end meal.
  - New space: Irrigation, always next to home and 👣1. Pours 2💧 into each field (driest first) as far as the store allows; fights take their water first. Field visits only harvest; the "harvest only" toggle is gone.
  - Strong now only adds fighting carry.
  - Retuned: threats 5 + 6.5 per season (rounded), monsters ×2, fields +2🌾 per soaked 💧, bonus threat at half strength. Bot: season 1 92%, wins 12%.
  - Store chips show goods arriving this turn (+N) and later (+N⏳). Walkers show what they carry. The End turn summary marks goods that arrive later with ⏳.
- **v0.5 (2026-11-12):** brought in the designer's new economy (their doc called it v0.2):
  - Bakery and Fletcher convert the whole store in one visit, at 2🌾→1🍞 and 1🪵→2🏹. Better tools adds +1 output per batch.
  - Fields grow only from soaked water: a visit harvests and pours up to carry 💧 (tap again for harvest only), and each free turn turns 1💧 into +3🌾. Dry fields only give their base of 1. Fields start with a pile of 2 and 2 soaked water.
  - Arrows deal 1 damage each (was 2). Strong now applies to watering and fighting. New modifier: Artisan.
  - Layout rule keeps the Bakery, Fletcher, Well and Forest within distance 2.
  - Kept from v0.3–v0.4: 8-turn seasons, bonus threat, 1-turn threats, meals after 3/6/8.
  - Retuned: threats 4 + 4 per season, monsters ×1.5, growth +1 every 2 seasons, starting 4🍞 4💧.
  - New `tools/bot.js` (smarter bot shared by sim and sweep) and `tools/sweep.js`. State versioning.
- **v0.4 (2026-11-11):** threats are always a 1-turn trip. Meals after turns 3, 6 and 8. Retuned threat strength and growth.
- **v0.3 (2026-11-11):** stopping the threat no longer ends the season. Bounty is paid at once, the season runs to turn 8, and an optional bonus threat of the other type appears with its own reward. Monster tiles show only creatures.
- **v0.2 (2026-11-11):** visual and audio pass. Pixel-art farm theme with Kenney assets, sequenced end-of-turn replay with popups, flying icons and rising-pitch sounds, mute toggle.
- **v0.1 (2026-11-11):** first playable. Core loop, 6 space types, 2 threats, food, market with 11 offers, stackable modifiers, headless bot sim.
