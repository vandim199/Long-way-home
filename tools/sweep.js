// node tools/sweep.js [runs]: tries a grid of CFG overrides and ranks them against the balance targets (GDD §10).
const { G, runMany, summary } = require('./bot.js');
const N = +process.argv[2] || 600;

const TARGET = { s1: 0.9, win: 0.125 };
function score(st) {
  const s1 = st.s1 / st.N, win = st.wins / st.N;
  const fire = st.failed.fire / Math.max(1, st.faced.fire), mon = st.failed.monsters / Math.max(1, st.faced.monsters);
  const hunger = Object.entries(st.why).filter(([k]) => k.includes('hungry')).reduce((a, [, v]) => a + v, 0) / st.N;
  // distance from targets: season 1 and win rate matter most, then fire/monster parity, then hunger in a 20–45% band
  return 3 * Math.abs(s1 - TARGET.s1) + 4 * Math.abs(win - TARGET.win) + 1.5 * Math.abs(fire - mon) + (hunger < 0.2 ? 0.2 - hunger : hunger > 0.45 ? hunger - 0.45 : 0);
}

const grid = [];
for (const hp0 of [4, 5])
  for (const step of [3, 4, 5])
    for (const growEvery of [2, 3])
      for (const monMul of [1.5, 2])
        for (const fireMul of [0.8, 1])
          grid.push({
            name: `hp ${hp0}+${step}/s · grow +1 every ${growEvery} · monsters ×${monMul} · fire ×${fireMul}`,
            patch: {
              threatHp: s => hp0 + step * (s - 1), bonusHp: s => hp0 + step * (s - 1),
              threatGrowth: s => 1 + Math.floor((s - 1) / growEvery),
            },
            types: { monsters: monMul, fire: fireMul },
          });

const base = { ...G.CFG };
const results = [];
for (const g of grid) {
  Object.assign(G.CFG, base, g.patch);
  for (const t in g.types) G.THREATS[t].hpMul = g.types[t];
  const st = runMany(N);
  results.push({ name: g.name, score: score(st), st });
}
Object.assign(G.CFG, base);
G.THREATS.fire.hpMul = G.THREATS.monsters.hpMul = 1;
results.sort((a, b) => a.score - b.score);
for (const r of results.slice(0, 8)) {
  const s = summary(r.st);
  console.log(`${r.score.toFixed(3)}  ${r.name}\n        s1 ${s['clears season 1']}  win ${s['wins the run']}  hunger ${s['lost to hunger']}  fire ${s['fail rate per fire season']}  monsters ${s['fail rate per monster season']}  near ${s['near misses (threat ≤2)']}`);
}
