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
// monsters ramp from ×1 in season 1 to ×monMax by season 3
const ramp = M => s => Math.min(M, 1 + ((M - 1) / 2) * (s - 1));
for (const hp0 of [6, 7, 8])
  for (const step of [6.5, 7.5])
    for (const monMax of [2.5, 3])
      for (const fireMul of [1, 0.85])
        for (const growEvery of [1, 2])
          grid.push({
            name: `hp ${hp0}+${step}/s · monsters ×1→×${monMax} · fire ×${fireMul} · grow +1 every ${growEvery}`,
            patch: {
              threatHp: s => hp0 + step * (s - 1), bonusHp: s => 0.5 * (hp0 + step * (s - 1)),
              threatGrowth: s => 1 + Math.floor((s - 1) / growEvery),
            },
            types: { monsters: ramp(monMax), fire: fireMul },
          });

const base = { ...G.CFG };
const baseMul = { fire: G.THREATS.fire.hpMul, monsters: G.THREATS.monsters.hpMul };
const results = [];
for (const g of grid) {
  Object.assign(G.CFG, base, g.patch);
  for (const t in g.types) G.THREATS[t].hpMul = g.types[t];
  const st = runMany(N);
  results.push({ name: g.name, score: score(st), st });
}
Object.assign(G.CFG, base);
G.THREATS.fire.hpMul = baseMul.fire; G.THREATS.monsters.hpMul = baseMul.monsters;
results.sort((a, b) => a.score - b.score);
for (const r of results.slice(0, 10)) {
  const s = summary(r.st);
  console.log(`${r.score.toFixed(3)}  ${r.name}\n        s1 ${s['clears season 1']}  win ${s['wins the run']}  hunger ${s['lost to hunger']}  fire ${s['fail rate per fire season']}  monsters ${s['fail rate per monster season']}  near ${s['near misses (threat ≤2)']}`);
}
