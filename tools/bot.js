// Heuristic bot shared by sim.js and sweep.js. A floor and a crash detector, not a stand-in for a good player.
const G = require('../src/logic.js');

const mealsLeft = S => G.CFG.mealTurns.filter(m => m >= S.turn && m < G.CFG.turns).length + 1;

function botPlan() {
  const S = G.S;
  let guard = 0;
  while (G.freeWorkers().length && guard++ < 20) {
    const w = G.freeWorkers()[0];
    const T = S.threat;
    const threatLive = !T.cleared;
    const tr = G.THREATS[T.type].res;
    const turnsLeft = G.CFG.turns - S.turn;            // turns after this one
    const hpLeft = threatLive ? T.hp - G.plannedDmg('T') : 0;
    const need = G.totalAppetite();
    const foodNeed = need * (S.turn + 1 >= G.nextMeal() ? 1 : 0) + need * (mealsLeft(S) - 1) * 0.6;
    const bread = S.res.bread + G.onRoad('bread') + G.incoming('bread');
    const bakeable = Math.floor((G.avail('wheat') + G.onRoad('wheat') + G.incoming('wheat')) / 2);
    const breadShort = bread + bakeable < foodNeed + need;
    const fightStock = G.avail(tr) + G.onRoad(tr) + G.incoming(tr) + (tr === 'arrows' ? 2 * (G.avail('wood') + G.onRoad('wood') + G.incoming('wood')) : 0);
    const fightShort = threatLive && fightStock < hpLeft + T.growth;
    const opts = [];

    for (const th of G.threats()) {
      const pv = G.preview(w, th);
      if (!pv.ok || th.hp - G.plannedDmg(th.id) <= 0) continue;
      if (th === S.threat) {
        // fight when it finishes the job, when time is short, or when we can afford it
        const finishes = pv.dmg >= hpLeft;
        opts.push({ id: th.id, score: finishes ? 120 : turnsLeft <= 3 ? 100 : 75 + 3 * pv.dmg });
      } else if (!breadShort) opts.push({ id: th.id, score: 30 + pv.dmg }); // optional bonus
    }
    for (const sp of S.spaces) {
      if (sp.lockedBy || S.plans.some(p => p.tid === sp.id)) continue;
      const ty = G.TYPES[sp.type];
      const p = G.preview(w, sp);
      if (!p.ok) continue;
      const amt = p.gain[ty.res || ty.to] || 0;
      let sc = 0;
      if (sp.type === 'field') sc = (breadShort ? 50 : 30) + 2 * Math.min(amt, 10);
      else if (sp.type === 'irrigation') {
        // keep the fields soaking, unless the fire needs every drop
        const minSoak = Math.min(...G.fields().map(f => f.soak));
        const spare = tr === 'water' && threatLive ? G.avail('water') - hpLeft : G.avail('water');
        sc = spare >= G.CFG.irrigatePer ? (minSoak <= 1 ? 70 : minSoak <= 3 ? 40 : 10) : 0;
      } else if (sp.type === 'bakery') sc = breadShort ? 95 : 45 + 4 * amt;
      else if (sp.type === 'fletcher') sc = tr === 'arrows' && threatLive ? (G.avail('arrows') + G.incoming('arrows') < hpLeft ? 92 : 40) + amt : 5;
      else if (ty.res === 'water') sc = (tr === 'water' && fightShort ? 75 : G.avail('water') < 4 ? 45 : 25) + amt;
      else if (ty.res === 'wood') sc = (tr === 'arrows' && fightShort ? 75 : 10) + amt;
      else if (ty.res === 'coins') sc = 25 + amt * 2;
      sc -= p.travel * 3;
      opts.push({ id: sp.id, score: sc });
    }
    opts.sort((a, b) => b.score - a.score);
    let done = false;
    for (const o of opts) {
      if (o.score <= 0 || !G.assign(w.id, o.id).ok) continue;
      done = true;
      break;
    }
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

// Plays N runs. Returns aggregate stats.
function runMany(N) {
  const st = { N, wins: 0, s1: 0, seasons: 0, reached: {}, why: {}, faced: { fire: 0, monsters: 0 }, failed: { fire: 0, monsters: 0 }, near: 0, bonusTaken: 0 };
  for (let n = 0; n < N; n++) {
    G.newRun();
    let steps = 0, lastSeason = 0;
    while (steps++ < 2000) {
      const S = G.S;
      if (S.season !== lastSeason) { lastSeason = S.season; st.faced[S.threat.type]++; }
      if (S.phase === 'play') { botPlan(); G.endTurn(); }
      else if (S.phase === 'shop') { if (S.bonus && S.bonus.cleared) st.bonusTaken++; botShop(); }
      else break;
    }
    const S = G.S;
    if (S.phase === 'won') st.wins++;
    if (S.season > 1 || S.phase === 'won') st.s1++;
    st.seasons += S.phase === 'won' ? S.season : S.season - 1;
    st.reached[S.season] = (st.reached[S.season] || 0) + 1;
    const why = S.over ? S.over.why : 'stuck:' + S.phase;
    st.why[why] = (st.why[why] || 0) + 1;
    if (S.phase === 'lost' && !S.over.why.includes('hungry')) {
      st.failed[S.threat.type]++;
      if (S.threat.hp <= 2) st.near++;
    }
  }
  return st;
}

function summary(st) {
  const pct = x => (100 * x / st.N).toFixed(1) + '%';
  const hunger = Object.entries(st.why).filter(([k]) => k.includes('hungry')).reduce((a, [, v]) => a + v, 0);
  return {
    'clears season 1': pct(st.s1),
    'wins the run': pct(st.wins),
    'avg seasons cleared': (st.seasons / st.N).toFixed(2),
    'lost to hunger': pct(hunger),
    'fail rate per fire season': (100 * st.failed.fire / Math.max(1, st.faced.fire)).toFixed(1) + '%',
    'fail rate per monster season': (100 * st.failed.monsters / Math.max(1, st.faced.monsters)).toFixed(1) + '%',
    'near misses (threat ≤2)': pct(st.near),
    'bonus threats stopped per run': (st.bonusTaken / st.N).toFixed(2),
  };
}

module.exports = { G, botPlan, botShop, runMany, summary };
