# Long Way Home — Game Design Document

*Working title.* Single-screen worker-placement roguelike.
**Status:** playable web prototype **v0.5** (12 Nov 2026). The economy was rebuilt after the first playtests of v0.1. Seasons now always last 8 turns, with an optional bonus threat.

This document is the source of truth for the design. The numbers live in `src/logic.js` (`CFG` and the tables at the top). If this doc and the code disagree, decide which one is right and fix the other.

---

## 1. Pitch

Send villagers out from your home to wells, fields, forests and workshops. They pay out at the end of the turn, then take the long way home: a villager is away for as many turns as the space is far, and that space stays locked until they're back. Water your fields, bake bread, keep everyone fed, and stop each season's threat (fire, monsters) before time runs out. Stop it early and the rest of the season is yours: stock up, or chase an optional bonus threat for a second payday. Between seasons you spend coins on a few scarce upgrades that change how you play. The run structure is Balatro's: beat each season's target or the run is over.

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
     1. All payouts and costs resolve together. Fields are harvested and watered, converters convert, fights deal damage.
     2. Villagers who were sent this turn depart.
     3. Villagers already out walk one step home. Anyone who arrives unlocks their space.
     4. Growth: every free, unlocked gathering space grows (see §6).
     5. If the season's threat is at 0, it's stopped: the bounty is paid and the bonus threat appears. Otherwise, if nobody fought it this turn, it grows.
     6. If the bonus threat is at 0, it's stopped and its reward is paid.
     7. The meal check, if it's a meal turn.
     8. After turn 8: if the threat is still above 0, the run is lost. Otherwise the season-end meal happens and the market opens.
- **Between seasons:** the market (§9). Everyone comes home and all spaces unlock. Piles and soaked water carry over. An unfinished bonus threat leaves.

## 5. Board

- 5×5 grid with home at the center. **Travel time = Manhattan distance from home** (1–3).
- **Random layout each run.** 8 spaces: 3 at distance 1, 3 at distance 2, 2 at distance 3.
  - Spaces: Field ×2, Well, Forest, Bakery, Fletcher, Mine, plus one extra Field, Well or Forest.
  - **Layout rule:** the Bakery, Fletcher, Well and Forest are never at distance 3. The only exception is an extra Well or Forest, and only if its twin is closer. The Mine is never at distance 1. *Why: the threat is final, so the layout alone must never make a run unwinnable. The layout should change the puzzle, not decide whether it can be solved.*
- Each season the threat appears on a free cell at distance 2–3. The bonus threat takes another free cell at distance 2–3. Where a threat sits doesn't change its travel time (§7).

## 6. Spaces and the economy

```
Well ──💧──► Field (pour) ──🌾──► Bakery (2🌾 → 1🍞) ──► meals
  └──💧──────────────────────────► fight 🔥 Fire
Forest ──🪵──► Fletcher (1🪵 → 2🏹) ──► fight 👹 Monsters
Mine ──🪙──► market
```

| Space | Kind | Visit does | Base | Grows when free |
|---|---|---|---|---|
| Well | gather | take 💧 | 2 | +1 per turn |
| Forest | gather | take 🪵 | 2 | +1 per turn |
| Mine | gather | take 🪙 | 1 | +1 per turn |
| Field | gather + water | take 🌾 **and** pour up to 3💧 into the soil | 1 | **+3🌾 per turn, using 1 soaked 💧** (none when dry) |
| Bakery | convert | **all** wheat in store, 2🌾 → 1🍞 per batch | — | — |
| Fletcher | convert | **all** wood in store, 1🪵 → 2🏹 per batch | — | — |

- **Gather yield** = base + (distance − 1) + pile, +2 per Forager modifier. Far spaces start bigger. Harvesting resets the pile to 0.
- **Locked spaces don't grow.** Harvesting often has a hidden cost. A watered field also waits until its villager is home before the soaked water starts turning into wheat.
- **Fields and water.**
  - A Field visit always harvests. By default it also pours water from the store into the soil, up to the villager's carry (3, +3 per Strong).
  - Tapping a planned Field once switches it to "harvest only." Tapping again cancels the plan. The tile's water badge shows the soaked water, "+3" for water about to be poured, and ✕ for harvest only.
  - Each turn the field is free and has soaked water, it turns 1💧 into +3🌾 (+1 per Fertile). A dry field doesn't grow; it only gives its base.
  - Water is contested: the same 💧 grows food and fights fire. **Fire seasons are hungry seasons.**
- **Converters process the whole store in one visit.** The Bakery bakes floor(wheat ÷ 2) batches; leftover odd wheat stays. Output per batch = base output + Better tools, ×2 if the villager is an Artisan.
- **Only stock already in your store can be poured or converted.** Resources arriving this turn can't be used until next turn. This is intentional: sending everyone out can leave wheat sitting unbaked.
- **Why converters aren't capped any more:** in v0.1 the Bakery baked at most 3 per visit and then locked. Feeding 3 villagers took about half of all actions, and players starved even while the Bakery was always busy. The only time food felt fine was with Strong, which raised that cap. An uncapped Bakery turns upkeep into accumulate-then-cash-in (pillar 5).

## 7. Villagers and travel

- Send as many villagers as you like each turn. One villager per space; a threat accepts any number (until the planned damage would finish it).
- Payout comes at the end of the turn.
- A villager is **away** for (distance − roads − Swift) turns, minimum 1. While they're away you can't use that villager or that space.
- **Threats are always a 1-turn trip**, wherever they sit. Fighters are back next turn, so fighting competes with gathering for *bodies*, not for walking time.
- Pouring, converting and fighting **reserve** the input from your store when you assign them, so the preview is exactly what happens.
- Starting crew: 3 villagers.

## 8. Threats, food and failure

**Threats** alternate each season (the first is random).

| Threat | Fight with | Damage | Strength multiplier |
|---|---|---|---|
| 🔥 Fire | 💧 water | 1 per water | ×1 |
| 👹 Monsters | 🏹 arrows | 1 per arrow | **×1.5** |

- Strength in season *s* = **(4 + 4(s − 1)) × multiplier**: fire 4, 8, 12 … 32; monsters 6, 12, 18 … 48.
- *Why monsters are tougher:* with the Fletcher making 2 arrows per wood and an uncapped visit, arrows are cheap, while water is split between fields and firefighting. At equal strength, monster seasons failed about a fifth as often as fire seasons; ×1.5 evens them out.
- It grows by **1 + floor((s − 1)/2)** on any turn nobody fights it: +1 in seasons 1–2, +2 in 3–4, +3 in 5–6, +4 in 7–8.
- Each villager delivers up to their carry (3, +3 per Strong). Brave adds +2 damage, even with nothing to deliver.
- **Not stopped by end of turn 8: the run is over.** This is final; see pillar 4.
- **Bounty** for stopping it = 3 + season + unused turns, paid the turn it's stopped.

**Bonus threat (optional)**
- Appears as soon as the season's threat is stopped (unless that happened on turn 8). It's the other type: stopping fire summons a bonus monster band, and vice versa. Chasing it usually means setting up a supply chain you haven't been using this season.
- Same strength formula as the season's threat (with its multiplier). It never grows and ignoring it costs nothing. It leaves at season end.
- Reward for stopping it by the end of turn 8: 3 + season 🪙.
- The point: early victory buys free turns, and the player chooses between safe farming (bread for the meals ahead) and a second payday.

**Food**
- Meals after turns 3 and 6, and at season end (after turn 8). `CFG.mealTurns` sets the mid-season ones.
- Each villager eats 1🍞, **+1 for every modifier past their first**, −1 per Hearty (minimum 0).
- Each missing bread costs 1 ❤. You start with 5 ❤ (max 5). **At 0 ❤ the run is over.**
- Feeding 3 villagers takes 9🍞 a season, which is 18🌾 and about 6💧 poured into fields.

**Starting state:** store 2🌾 4🍞 4💧 1🪵 0🏹 2🪙. Each Field starts with a pile of 2 and 2 soaked water.

## 9. Economy and market

**Coins** come from the Mine, the Golden modifier, season bounties and bonus-threat rewards.

**Market:** 3 random offers after each season. New offers cost 2🪙, and each further reroll costs 1 more. Buy as many as you can afford. Targeted upgrades go into "pick a target" mode, and cancelling is free.

| Offer | Price | Effect |
|---|---|---|
| New villager | 7, +4 each time | +1 worker (eats at every meal) |
| Swift 👟 | 5 | Travel −1 (minimum 1) |
| Strong 💪 | 4 | +3 carry when watering or fighting |
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

**v0.5 tuned values** (4000 runs):

| Metric | Result |
|---|---|
| Clears season 1 | 90% |
| Wins the full run | 11% |
| Average seasons cleared | 3.7 |
| Runs lost to hunger | 43% |
| Fail rate per fire season | 10.6% |
| Fail rate per monster season | 9.9% |
| Losses with the threat at ≤2 strength ("near misses") | 5% of runs |

**What the sweeps found**
- **Seasons that always last 8 turns** made the game much easier: free turns after an early clear are worth far more than the bounty. With 1-turn threats on top, the old bot won about 61%. A third meal (turns 3 and 6) was the strongest single lever to bring pressure back.
- **The new economy needed a smarter bot.** The v0.1 bot ignored watering and sat on 19 wheat without baking. `tools/bot.js` now waters fields, bakes in bulk, fletches when arrows run short and fights early; it clears season 1 about 98% of the time on the pre-tune numbers.
- **Fire vs monsters:** with cheap arrows, monster seasons failed about 2% of the time against 15% for fire. A ×1.5 strength multiplier for monsters lands them at parity.
- **Growth every 2 seasons vs 3:** every 3 wins about 15% with fire slightly harder than monsters; every 2 wins about 11% with near-perfect parity. Chose every 2.
- **Bonus threat:** the bot attacks it with spare villagers but almost never finishes one, because it only commits leftovers. Its strength and reward haven't been tuned for human players yet (see §11).
- *Earlier history:* the designer's first economy draft cleared season 1 only 60% of the time with threats at 5 + 2 per season; growing 3🌾 per soaked 💧 beat 2; starting bread and water mostly set how safe season 1 feels; buying villagers raises hunger losses but raises wins more. With uncapped converters alone, monster losses dropped about 80%, which confirmed the old caps were the bottleneck.

## 11. Known issues and open questions

- **Hunger is the bot's biggest loss** (43% of runs). The bot is naive about food, so playtest whether humans feel the same. The levers are starting bread, the meal schedule (`CFG.mealTurns`) and `fieldGrow`.
- **Bonus threat value:** is 3 + season coins worth chasing at full season strength? If players never take it, try lower strength (×0.75) or a non-coin reward (a free modifier, +1 ❤).
- **Near misses** end about 5% of bot runs. The threat stays final, so the fix has to come from information. Recommended next: the threat card shows the damage you have in stock (and arriving) against its strength, plus a warning when the math no longer works. That way a shortfall shows up on turn 5, not turn 8.
- **Dead turns:** when everyone is away, the only move is pressing End turn. Options: a home action that needs no villager, or skipping ahead to the next return automatically.
- **Wood has only one use** (arrows), while water has two. Should wood also build something (roads, a granary) so monster seasons have their own squeeze?
- **The watering UI** (tap again for harvest only) needs a playtest on a phone. Is it discoverable?
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
| Threats are a 1-turn trip | Adopted (v0.4) | Designer's call: fighting costs bodies, not walking time |
| Monsters ×1.5 strength | Adopted (v0.5) | Cheap arrows made monster seasons much easier than fire |
| Modifiers stack | Adopted (v0.1) | Sandbox; appetite is the brake |

## 14. Tech

- Vanilla JS, no dependencies, one self-contained page. Mobile-first (designed at about 390px wide).
- `src/logic.js` holds the rules and state and has no DOM. `src/ui.js` handles rendering and input. `tools/build.js` inlines both into `index.html`, along with the art and sound as base64, so the page still opens from `file://`.
- Saved state carries a version (`S.v`, `STATE_V` in `logic.js`). The UI discards state from an older version instead of crashing.
- **Look and feel:** pixel-art harvest farm built from Kenney's CC0 Tiny Farm, Tiny Town and Tiny Dungeon sheets (`assets/`, see `assets/CREDITS.md`), scaled by whole numbers so pixels stay crisp. Parchment panels, wooden buttons, a wheat-field backdrop, Jersey 15 pixel font. Emoji only for small icons (modifiers, fire, footsteps).
- **End-of-turn replay:** `endTurn()` returns an ordered event list (`report.events`). The UI plays it back one beat at a time so the player can follow it: each villager walks out and pops their payout ("+3 🪵"), the icon flies into the store, then each walking villager's timer ticks down (or they walk home), fields and piles grow, the threat grows or is stopped, the bonus appears, then the meal. Every beat plays a Kenney sound pitched one step higher on a major pentatonic scale, so a big turn builds up. Tapping during the replay speeds it up. A mute toggle sits in the top bar.
- If the loop proves fun, consider porting to Unity. Keeping the rules DOM-free makes that port mostly a translation job.

## Changelog

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
