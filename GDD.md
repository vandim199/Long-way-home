# Long Way Home — Game Design Document

*Working title.* Single-screen worker-placement roguelike.
**Status:** playable web prototype v0.4 (Nov 2026). One season playtested by the designer: "looks solid, could be improved."

This document is the source of truth for the design. The numbers live in `src/logic.js` (`CFG` and the tables at the top). If this doc and the code disagree, decide which one is right and fix the other.

---

## 1. Pitch

Send villagers out from your home to fields, wells, forests and workshops. They pay out at the end of the turn, then take the long way home: a villager is away for as many turns as the space is far, and that space stays locked until they're back. Keep everyone fed (wheat → bread), stop the season's threat (fire, monsters), and spend your coins on a few scarce upgrades that change how you play. The run structure is Balatro's: beat each season's target, then shop.

## 2. Inspirations and what we take from each

| Source | What we borrow |
|---|---|
| Castles of Burgundy, Lost Ruins of Arnak | Few actions, more wants than you can do. Every action is simple and the depth comes from choosing. |
| Agricola, Caverna | Feeding pressure. Action spaces that pile up when nobody takes them. |
| Balatro | Seasons work like blinds: beat the target or the run ends. A shop between seasons. Sandbox modifiers you apply to the villager you choose, the way Balatro enhances a card. |
| Slay the Spire | The template: take a board game mechanic (here worker placement) and put it inside a roguelike run. |

## 3. Design pillars

1. **Want more than you can do.** Too few actions is the core tension. If players can comfortably do everything, something is wrong.
2. **Simple actions, deep choices.** Every action must be explainable in one sentence.
3. **Time is the cost.** Distance means turns away. A computer can run these timers, which would be fiddly on a real table, and that's the reason this is a video game.
4. **Threats must feel threatening.** Failing to stop a season's threat ends the run.
5. **Scarce but impactful upgrades.** Each purchase should change how you play, not add +1%.
6. **No AI opponent.** Pressure comes from the board itself (threats, hunger, piles that grow), not from rivals that need their own balancing. The designer explicitly rejected AI rivals.

## 4. Structure

- **Run:** 8 seasons. Survive all 8 to win.
- **Season:** always 8 turns. One threat must be brought to 0 by the end of turn 8. Meals happen after turns 3, 6 and 8. Stopping the threat early pays its bounty immediately (bigger the earlier it is) and the season carries on: the remaining turns are free for farming and stocking up, and an optional bonus threat appears (§8).
- **Turn:**
  1. **Plan.** Assign any number of villagers who are home to spaces. Payouts are previewed on the tiles.
  2. **End turn.** All payouts resolve together, then villagers depart. Villagers already out walk one step home, and anyone who arrives unlocks their space. Free gathering spaces grow. If the threat reached 0 it's stopped and the bounty is paid; otherwise it grows if nobody fought it this turn. Then the meal check, if it's a meal turn.
- **Between seasons:** the market (see §9). Everyone comes home and all spaces unlock. Piles carry over.

## 5. Board

- 5×5 grid with home at the center. **Travel time = Manhattan distance from home** (1–3).
- **Random layout each run.** 8 spaces: 3 at distance 1, 3 at distance 2, 2 at distance 3.
  - The Bakery and Fletcher are never at distance 3. The Mine is never at distance 1.
  - Spaces: Field ×2, Well, Forest, Bakery, Fletcher, Mine, plus one extra Field, Well or Forest.
- Each season the threat appears on a free cell at distance 2–3. The bonus threat, if it appears, takes another free cell at distance 2–3. Their distance is only where they sit: travel to a threat is always 1 turn (§7).

## 6. Spaces

| Space | Kind | Gives / converts | Base |
|---|---|---|---|
| Field | gather | 🌾 wheat | 2 |
| Well | gather | 💧 water | 2 |
| Forest | gather | 🪵 wood | 2 |
| Mine | gather | 🪙 coins | 1 |
| Bakery | convert | 🌾 → 🍞, ratio 1 | — |
| Fletcher | convert | 🪵 → 🏹, ratio 1 | — |

- **Gather yield** = base + (distance − 1) + pile (+2 per Forager modifier). Far spaces start bigger.
- **Pile:** resets to 0 when harvested. It grows +1 each turn the space is free and unlocked (+1 more per Fertile upgrade). A locked space doesn't grow, so harvesting often has a hidden cost.
- **Convert:** takes up to the villager's carry (3, +3 per Strong) of the input. Output = input × ratio (+1 ratio per Better tools).
- **Only stock already in your store can be converted.** Resources arriving this turn can't be used until next turn. This is intentional: sending everyone out can leave wheat sitting unbaked.

## 7. Villagers and travel

- Send as many villagers as you like each turn. One villager per space; the threat accepts any number.
- Payout comes at the end of the turn.
- A villager is **away** for (distance − roads − Swift) turns, minimum 1. While they're away you can't use that villager or that space.
- **Threats are always a 1-turn trip**, wherever they are on the board. Fighters are back next turn, so fighting competes with gathering for *bodies*, not for walking time.
- Converting and fighting **reserve** the input from your store when you assign them, so the preview is exactly what happens.
- Starting crew: 3 villagers.

## 8. Threats, food and failure

**Threats** alternate each season (the first is random).

| Threat | Fight with | Damage per unit |
|---|---|---|
| 🔥 Fire | 💧 water | 1 |
| 👹 Monsters | 🏹 arrows | 2 (they take an extra step to make: wood → Fletcher → arrows) |

- Strength in season *s* = 5 + 4(s − 1) (5, 9, 13, … 33). It grows by 1 + floor((s − 1)/2) (1, 1, 2, 2, 3, 3, 4, 4) on any turn nobody fights it.
- Each villager delivers up to their carry. Brave adds +2 damage, even with nothing to deliver.
- **Not stopped by end of turn 8: the run is over.**
- **Bounty** for stopping it = 3 + season + unused turns, paid the turn it's stopped. The season still runs to turn 8.

**Bonus threat (optional)**
- Appears as soon as the season's threat is stopped (unless that happened on turn 8). It's the other type: stopping fire summons a bonus monster band, and vice versa. So chasing it usually means setting up a supply chain you haven't been using this season.
- Strength 5 + 4(s − 1), the same as the season's starting threat. It never grows and ignoring it costs nothing. It leaves at season end.
- Reward for stopping it by the end of turn 8: 3 + season 🪙.
- The point: early victory buys free turns, and the player chooses between safe farming (bread for the meals ahead) and a second payday.

**Food**
- Meals after turns 3 and 6, and at season end (after turn 8). Set in `CFG.mealTurns`; the season-end meal is always added.
- Each villager eats 1 🍞, **+1 for every modifier past their first**, −1 per Hearty (minimum 0).
- Each missing bread costs 1 ❤. You start with 5 ❤ (max 5). **At 0 ❤ the run is over.**

**Starting store:** 2🌾 5🍞 1💧 1🪵 0🏹 2🪙

## 9. Economy and market

**Coins** come from the Mine, the Golden modifier, season bounties and bonus-threat rewards.

**Market:** 3 random offers after each season. New offers cost 2🪙, and each further reroll costs 1 more. Buy as many as you can afford. Targeted upgrades go into "pick a target" mode, and cancelling is free.

| Offer | Price | Effect |
|---|---|---|
| New villager | 7, +4 each time | +1 worker (eats at every meal) |
| Swift 👟 | 5 | Travel −1 (minimum 1) |
| Strong 💪 | 4 | +3 carry when converting or fighting |
| Forager 🧺 | 5 | +2 when gathering |
| Golden ✨ | 6 | +1🪙 every time they act |
| Brave 🛡️ | 4 | +2 damage when fighting |
| Hearty 🍖 | 4 | Eats 1 less |
| Road 🛤️ | 4 | One space: travel −1 (minimum 1) |
| Fertile 🌱 | 4 | One gathering space grows +1 more per turn |
| Better tools ⚒️ | 5 | Bakery or Fletcher: ratio +1 |
| Festival 🎉 | 3 | +2 ❤ (only offered below max hearts) |

**Stacking modifiers (decided):** modifiers stack freely on one villager. A jack of all trades is allowed, but they're a single point of failure: they're in one place at a time and spend turns walking home. Their appetite also grows with every modifier past the first. If heroes still dominate, the fallback is a hard limit of 2–3 modifiers per villager.

## 10. Balance notes

- `npm run sim` runs a naive bot through 2000 runs. Treat the bot as a floor and a crash detector, not as a target. The bot never fights the bonus threat.
  - v0.1: clears season 1 about 94% of the time, wins the full run about 2%.
  - **v0.3 (seasons always last 8 turns): clears season 1 about 93%, wins the full run about 39%.** The jump comes from the free turns after an early clear, not from the bounty: cutting the early-clear coin bonus barely moved it (35–36%). In v0.1 an early clear triggered the season-end meal before anything could be baked. If the game now feels too easy, the levers are threat strength/growth, meal size, or a later meal turn, not the bounty.
  - Making threats a 1-turn trip pushed the bot to about 61%.
  - **v0.4 retune: clears season 1 100%, wins about 10% (196/2000).** Seasons reached: 2→18%, 3→25%, 4→19%, 5→14%, 6→7%, 7→5%, 8→13% (incl. wins). Losses: hunger 67%, monsters 15%, fire 8%.
  - How we got there (1000-run sweeps): a third meal was the strongest lever (61% → 21% on its own). Raising season 1's strength made season 1 harsh (only about 83% cleared), so season 1 stays at 5 and the scaling is steeper instead. Growth of 1 + floor(s/2) put a wall at season 2 (39% of runs ended there), so growth starts at 1 for two seasons. Starting with 5 bread instead of 3 smooths season 2.
  - Season 1 is now never lost by the bot. That's intended onboarding; if players find it dull, start the threat at 6.
- Monsters were far harder than fire at first (the bot lost to them about 20× as often), because they need three kinds of trips instead of two. Fixed by making each arrow deal 2 damage and setting the Fletcher ratio to 1.
- Hunger is the bot's dominant loss (about 67% of runs in v0.4). The bot's food rule is naive (it bakes only when projected bread is under two meals), so humans should feel this less. Watch for it in playtests.

## 11. Known issues and open questions

- **Dead turns:** when everyone is away, the only move is pressing End turn. Options: a home action that needs no villager (convert or build at home), or skip ahead to the next return automatically.
- **Solved routes:** the layout is random per run but fixed within it, so one best rotation may emerge. Consider shuffling a space or two each season, or events that change the map.
- **Reservation quirk:** unassigning an earlier plan doesn't recalculate how much a later converter or fight plan reserved.
- **Threats are passive:** should fire spread and lock a neighbouring space? Should monsters steal from piles?
- **Length:** are 8 seasons of 8 turns right?
- **Designer's first playtest:** one season, "solid but could be improved." Specifics TBD.

## 12. Ideas backlog (not yet in the game)

- "Bad piles": spaces that grow trouble (rot, monsters, fire) and need a villager sent to clear them.
- Space upgrade: pays again when the villager gets home.
- Recall: pay to bring a villager home early.
- Events between or during seasons.
- More threat types, each fought with a different resource or route.
- Other themes considered: a lighthouse sending boats, a wizard sending familiars.

## 13. Tech

- Vanilla JS, no dependencies, one self-contained page. Mobile-first (designed at about 390px wide).
- `src/logic.js` holds the rules and state and has no DOM. `src/ui.js` handles rendering and input. `tools/build.js` inlines both into `index.html`, along with the art and sound as base64.
- **Look and feel:** pixel-art harvest farm built from Kenney's CC0 Tiny Farm, Tiny Town and Tiny Dungeon sheets, scaled by whole numbers so pixels stay crisp. Parchment panels, wooden buttons, a wheat-field backdrop, Jersey 15 pixel font. Emoji only for small icons (modifiers, fire, footsteps).
- **End-of-turn replay:** `endTurn()` emits an ordered event list. The UI plays it back one beat at a time so the player can follow it: each villager walks out and pops their payout ("+3 🪵"), the icon flies into the store, then each walking villager's timer ticks down (or they walk home), piles grow, the threat grows, then the meal. Every beat plays a Kenney sound pitched one step higher on a major pentatonic scale, so a big turn builds up. Tapping during the replay speeds it up. A mute toggle sits in the top bar.
- If the loop proves fun, consider porting to Unity. Keeping the rules DOM-free makes that port mostly a translation job.

## Changelog

- **v0.4 (2026-11-11):** threats are always a 1-turn trip. Retune: meals after turns 3, 6 and 8 (was 4 and 8), threat strength 5 + 4(s − 1) (was 5 + 2(s − 1)), growth 1 + floor((s − 1)/2) (was 1 + floor((s − 1)/3)), bonus strength matches, starting bread 5 (was 3). Bot win rate about 61% → 10%.
- **v0.3 (2026-11-11):** stopping the threat no longer ends the season. Bounty is paid at once, the season runs to turn 8 (both meals still happen), and an optional bonus threat of the other type appears with its own reward. Monster tiles show only creatures (no human-looking sprite). Bot win rate rose from about 2% to about 39%.
- **v0.2 (2026-11-11):** visual and audio pass, no rule changes. Pixel-art farm theme with Kenney assets, sequenced end-of-turn replay with popups, flying icons and rising-pitch sounds, mute toggle. `endTurn()` now returns `report.events`.
- **v0.1 (2026-11-11):** first playable. Core loop, 6 space types, 2 threats, food, market with 11 offers, stackable modifiers, headless bot sim.
