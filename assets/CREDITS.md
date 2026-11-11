# Asset credits

All art and sound here is by **Kenney** (https://kenney.nl), released under **CC0 1.0** (public domain). Credit isn't required, but it's appreciated.

| File | Source pack |
|---|---|
| `img/tiny-farm.png` | [Tiny Farm](https://kenney.nl/assets/tiny-farm) (`Tilemap/tilemap_packed.png`) |
| `img/tiny-town.png` | [Tiny Town](https://kenney.nl/assets/tiny-town) (`Tilemap/tilemap_packed.png`) |
| `img/tiny-dungeon.png` | [Tiny Dungeon](https://kenney.nl/assets/tiny-dungeon) (`Tilemap/tilemap_packed.png`) |
| `sfx/clink.mp3` | [Casino Audio](https://kenney.nl/assets/casino-audio) `chips-collide-1` |
| `sfx/place.mp3` | Casino Audio `chip-lay-1` |
| `sfx/coins.mp3` | [RPG Audio](https://kenney.nl/assets/rpg-audio) `handleCoins` |
| `sfx/step.mp3` | RPG Audio `footstep00` |
| `sfx/meal.mp3` | RPG Audio `metalPot1` (trimmed to 0.7 s) |
| `sfx/ding.mp3`, `hit.mp3`, `hurt.mp3`, `grow.mp3`, `bell.mp3` | [Impact Sounds](https://kenney.nl/assets/impact-sounds) `impactGlass_light_000`, `impactPunch_medium_000`, `impactPunch_heavy_000`, `impactSoft_heavy_000`, `impactBell_heavy_000` |
| `sfx/pluck.mp3`, `home.mp3`, `select.mp3`, `error.mp3` | [Interface Sounds](https://kenney.nl/assets/interface-sounds) `pluck_001`, `drop_002`, `select_002`, `error_004` |

Sounds were converted from OGG to mono 64 kbps MP3 (`ffmpeg`) so Safari can play them.

Tile sheets are 12 × 11 tiles of 16 px with no spacing. In `src/ui.js`, a sprite code such as `F66` means sheet **F**arm / **T**own / **D**ungeon, tile index 66 (row = 66 / 12, column = 66 % 12).
