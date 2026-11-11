const G = require('../src/logic.js');

function botPlan() {
  const S = G.S;
  let guard = 0;
  while (G.freeWorkers().length && guard++ < 20) {
    const w = G.freeWorkers()[0];
    const T = S.threat, tr = G.THREATS[T.type].res;
    const turnsLeft = G.CFG.turns - S.turn;
    const hpLeft = T.hp - G.plannedDmg();
    const breadProj = S.res.bread + G.incoming('bread');
    const need = G.totalAppetite();
    const opts = [];
    const pv = G.preview(w, T);
    if (pv.ok && hpLeft > 0) opts.push({ id: 'T', score: 90 + pv.dmg });
    for (const sp of S.spaces) {
      if (sp.lockedBy || S.plans.some(p => p.tid === sp.id)) continue;
      const p = G.preview(w, sp);
      if (!p.ok) continue;
      const ty = G.TYPES[sp.type];
      let sc = 0;
      const amt = Object.values(p.gain)[0] || 0;
      if (ty.kind === 'gather') {
        if (ty.res === tr) sc = (G.avail(tr) + G.incoming(tr) < hpLeft + 2 ? 70 : 20) + amt;
        else if (ty.res === 'wheat') sc = (breadProj + G.avail('wheat') < need * 2 ? 60 : 15) + amt;
        else if (ty.res === 'wood') sc = (tr === 'arrows' ? 65 : 5) + amt;
        else if (ty.res === 'coins') sc = 25 + amt;
        else sc = 5 + amt;
        sc -= p.travel * 3;
      } else {
        if (ty.to === 'bread') sc = breadProj < need * 2 ? 80 : 10;
        if (ty.to === 'arrows') sc = tr === 'arrows' ? 85 : 3;
      }
      opts.push({ id: sp.id, score: sc });
    }
    opts.sort((a, b) => b.score - a.score);
    let done = false;
    for (const o of opts) { if (G.assign(w.id, o.id).ok) { done = true; break; } }
    if (!done) break;
  }
}

function botShop() {
  const S = G.S;
  for (let k = 0; k < 3; k++) {
    const i = S.shop.offers.findIndex(o => !o.sold && G.upgradePrice(o.id) <= S.res.coins);
    if (i < 0) break;
    const r = G.buy(i);
    if (r.targeting) {
      const id = S.pending.id;
      const cands = [...S.workers, ...S.spaces].filter(x => G.validTarget(id, x));
      if (!cands.length) { G.cancelTarget(); S.shop.offers[i].sold = true; continue; }
      G.applyTarget(cands[Math.floor(Math.random() * cands.length)].id);
    }
  }
  G.nextSeason();
}

const N = +process.argv[2] || 2000;
const reached = {}; let wins = 0; const reasons = {};
for (let n = 0; n < N; n++) {
  G.newRun();
  let steps = 0;
  while (steps++ < 1000) {
    const S = G.S;
    if (S.phase === 'play') { botPlan(); G.endTurn(); }
    else if (S.phase === 'shop') botShop();
    else break;
  }
  const S = G.S;
  if (S.phase === 'won') wins++;
  reached[S.season] = (reached[S.season] || 0) + 1;
  reasons[S.over ? S.over.why : 'stuck:' + S.phase] = (reasons[S.over ? S.over.why : 'stuck'] || 0) + 1;
}
console.log('runs', N, 'wins', wins);
console.log('season reached', reached);
console.log('reasons', reasons);
