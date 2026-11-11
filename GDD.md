# Long Way Home — Game Design Document

*Working title.* Single-screen worker-placement roguelike.
**Status:** playable web prototype v0.1 (Nov 2026). One season playtested by the designer: "looks solid, could be improved."

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
- **Season:** up to 8 turns. One threat must be brought to 0 by the end of turn 8. Meals happen after turn 4 and at season end. Clearing the threat early ends the season right away and pays a bigger bounty.
- **Turn:**
  1. **Plan.** Assign any number of villagers who are home to spaces. Payouts are previewed on the tiles.
  2. **End turn.** All payouts resolve together, then villagers depart. Villagers already out walk one step home, and anyone who arrives unlocks their space. Free gathering spaces grow. The threat grows if nobody fought it this turn. Then the meal check, if it's a meal turn.
- **Between seasons:** the market (see §9). Everyone comes home and all spaces unlock. Piles carry over.

## 5. Board

- 5×5 grid with home at the center. **Travel time = Manhattan distance from home** (1–3).
- **Random layout each run.** 8 spaces: 3 at distance 1, 3 at distance 2, 2 at distance 3.
  - The Bakery and Fletcher are never at distance 3. The Mine is never at distance 1.
  - Spaces: Field ×2, Well, Forest, Bakery, Fletcher, Mine, plus one extra Field, Well or Forest.
- Each season the threat appears on a free cell at distance 2–3.

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
- Converting and fighting **reserve** the input from your store when you assign them, so the preview is exactly what happens.
- Starting crew: 3 villagers.

## 8. Threats, food and failure

**Threats** alternate each season (the first is random).

| Threat | Fight with | Damage per unit |
|---|---|---|
| 🔥 Fire | 💧 water | 1 |
| 👹 Monsters | 🏹 arrows | 2 (they take an extra step to make: wood → Fletcher → arrows) |

- Strength in season *s* = 5 + 2(s − 1). It grows by 1 + floor((s − 1)/3) on any turn nobody fights it.
- Each villager delivers up to their carry. Brave adds +2 damage, even with nothing to deliver.
- **Not stopped by end of turn 8: the run is over.**
- **Bounty** for clearing it = 3 + season + unused turns.

**Food**
- Meals after turn 4 and at season end.
- Each villager eats 1 🍞, **+1 for every modifier past their first**, −1 per Hearty (minimum 0).
- Each missing bread costs 1 ❤. You start with 5 ❤ (max 5). **At 0 ❤ the run is over.**

**Starting store:** 2🌾 3🍞 1💧 1🪵 0🏹 2🪙

## 9. Economy and market

**Coins** come from the Mine, the Golden modifier and season bounties.

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

- `npm run sim` runs a naive bot through 2000 runs. As of v0.1 it clears season 1 about 94% of the time and wins the full run about 2%. Humans should do much better. Treat the bot as a floor and a crash detector, not as a target.
- Monsters were far harder than fire at first (the bot lost to them about 20× as often), because they need three kinds of trips instead of two. Fixed by making each arrow deal 2 damage and setting the Fletcher ratio to 1.
- Hunger is the bot's most common loss. Watch whether humans feel the same.

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
- `src/logic.js` holds the rules and state and has no DOM. `src/ui.js` handles rendering and input. `tools/build.js` inlines both into `index.html`.
- If the loop proves fun, consider porting to Unity. Keeping the rules DOM-free makes that port mostly a translation job.

## Changelog

- **v0.1 (2026-11-11):** first playable. Core loop, 6 space types, 2 threats, food, market with 11 offers, stackable modifiers, headless bot sim.
