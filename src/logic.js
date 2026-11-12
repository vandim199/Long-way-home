// ===== Long Way Home — game logic (no DOM) =====
const STATE_V = 5; // bump when the shape of S changes; the UI discards older saved state

const CFG = {
  seasons: 8,
  turns: 8,
  mealTurns: [3, 6],       // mid-season meals; there's always one more after the last turn
  startHearts: 5,
  maxHearts: 5,
  carry: 3,
  start: { wheat: 2, bread: 4, water: 4, wood: 1, arrows: 0, coins: 2 },
  fieldStart: { pile: 2, soak: 2 }, // each Field starts with some wheat and soaked water
  fieldGrow: 3,                     // wheat per soaked water, each free turn
  threatHp: s => 4 + 4 * (s - 1),          // × the threat's hpMul
  threatGrowth: s => 1 + Math.floor((s - 1) / 2),
  bounty: (s, unused) => 3 + s + unused,   // paid the moment the season's threat is stopped
  bonusHp: s => 4 + 4 * (s - 1),           // optional bonus threat that appears once the main one is stopped
  bonusBounty: s => 3 + s,
};

const RES = ['wheat', 'bread', 'water', 'wood', 'arrows'];
const ICON = { wheat: '🌾', bread: '🍞', water: '💧', wood: '🪵', arrows: '🏹', coins: '🪙' };

const TYPES = {
  field:    { name: 'Field',    icon: '🌾', kind: 'gather',  res: 'wheat',  base: 1, waters: true },
  well:     { name: 'Well',     icon: '🪣', kind: 'gather',  res: 'water',  base: 2 },
  forest:   { name: 'Forest',   icon: '🌲', kind: 'gather',  res: 'wood',   base: 2 },
  mine:     { name: 'Mine',     icon: '⛏️', kind: 'gather',  res: 'coins',  base: 1 },
  // converters process the whole store in one visit, in batches of `in` → `out`
  bakery:   { name: 'Bakery',   icon: '🥖', kind: 'convert', from: 'wheat', to: 'bread',  in: 2, out: 1, verb: 'bake' },
  fletcher: { name: 'Fletcher', icon: '🪚', kind: 'convert', from: 'wood',  to: 'arrows', in: 1, out: 2, verb: 'make arrows' },
};

const THREATS = {
  fire:     { name: 'Fire',     icon: '🔥', res: 'water',  per: 1, hpMul: 1, done: 'put out' },
  // arrows come 2 per wood, so monsters are tougher to keep fire and monster seasons equally hard
  monsters: { name: 'Monsters', icon: '👹', res: 'arrows', per: 1, hpMul: 1.5, done: 'driven off' },
};

const MODS = {
  swift:   { name: 'Swift',   icon: '👟', text: 'Travels 1 turn faster (never below 1).', price: 5 },
  strong:  { name: 'Strong',  icon: '💪', text: 'Carries 3 more when watering or fighting.', price: 4 },
  forager: { name: 'Forager', icon: '🧺', text: '+2 every time they gather.', price: 5 },
  artisan: { name: 'Artisan', icon: '🔨', text: 'Double output at the Bakery or Fletcher.', price: 5 },
  golden:  { name: 'Golden',  icon: '✨', text: '+1 🪙 every time they act.', price: 6 },
  brave:   { name: 'Brave',   icon: '🛡️', text: '+2 damage when fighting, even empty-handed.', price: 4 },
  hearty:  { name: 'Hearty',  icon: '🍖', text: 'Eats 1 less 🍞 at meals.', price: 4 },
};

const UPGRADES = {
  worker:   { name: 'New villager', icon: '🧑', text: '+1 worker. Eats 1 🍞 at every meal.', target: null },
  road:     { name: 'Road',         icon: '🛤️', text: 'One space: travel time −1 (never below 1).', target: 'space', price: 4 },
  fertile:  { name: 'Fertile',      icon: '🌱', text: 'One gathering space grows +1 more each turn (Fields: +1 🌾 per soaked 💧).', target: 'space', price: 4 },
  tools:    { name: 'Better tools', icon: '⚒️', text: 'Bakery or Fletcher: +1 output per batch.', target: 'space', price: 5 },
  festival: { name: 'Festival',     icon: '🎉', text: '+2 ❤ (up to 5).', target: null, price: 3 },
};

const NAMES = ['Ada', 'Bram', 'Cora', 'Dov', 'Esme', 'Finn', 'Greta', 'Hal', 'Ines', 'Jory', 'Kit', 'Lena', 'Milo', 'Nell', 'Otto', 'Pia', 'Rosa', 'Sven', 'Tova', 'Wren'];
const COLORS = ['#f2a93b', '#5bb8ea', '#ef6f8c', '#8ccf6a', '#b994ec', '#f08a4b', '#46c9ad', '#e4d04a'];

let S = null;

const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const dist = c => Math.abs(c.x - 2) + Math.abs(c.y - 2);
function cellsAt(d) { const out = []; for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (dist({ x, y }) === d) out.push({ x, y }); return out; }

// ----- derived values -----
const cnt = (w, m) => w.mods.filter(x => x === m).length;
const appetite = w => Math.max(0, 1 + Math.max(0, w.mods.length - 1) - cnt(w, 'hearty'));
const carry = w => CFG.carry + 3 * cnt(w, 'strong');
const totalAppetite = () => S.workers.reduce((a, w) => a + appetite(w), 0);
// Fields grow only from soaked water (none when dry); other gathering spaces grow every free turn
const growth = sp => (TYPES[sp.type].waters ? (sp.soak > 0 ? CFG.fieldGrow + sp.fert : 0) : 1 + sp.fert);
const batchOut = (sp, w) => (TYPES[sp.type].out + sp.tools) * (1 + (w ? cnt(w, 'artisan') : 0));
const gatherBase = sp => TYPES[sp.type].base + (sp.dist - 1);
const gatherAmt = (sp, w) => gatherBase(sp) + sp.pile + (w ? 2 * cnt(w, 'forager') : 0);
// threats are always a 1-turn round trip; spaces cost their distance
const travelOf = (t, w) => (t.isThreat ? 1 : Math.max(1, t.dist - (t.road || 0) - (w ? cnt(w, 'swift') : 0)));
const W = id => S.workers.find(w => w.id === id);
const target = id => (id === 'T' ? S.threat : id === 'B' ? S.bonus : S.spaces.find(s => s.id === id));
const threats = () => [S.threat, S.bonus].filter(t => t && !t.cleared);
const planOf = wid => S.plans.find(p => p.wid === wid);
const isFree = w => w.away === 0 && !planOf(w.id);
const freeWorkers = () => S.workers.filter(isFree);
const avail = r => S.res[r] - S.plans.reduce((a, p) => a + (p.cost[r] || 0), 0);
const incoming = r => S.plans.reduce((a, p) => a + (p.gain[r] || 0), 0);
const plannedDmg = (tid = 'T') => S.plans.reduce((a, p) => a + (p.tid === tid ? p.dmg || 0 : 0), 0);
const threatStart = (type, s) => Math.round(CFG.threatHp(s) * THREATS[type].hpMul);
const nextMeal = () => CFG.mealTurns.find(m => m >= S.turn) || CFG.turns;
function upgradePrice(id) {
  if (id === 'worker') return 7 + 4 * S.bought.worker;
  if (MODS[id]) return MODS[id].price;
  return UPGRADES[id].price;
}
function offerDef(id) {
  if (MODS[id]) return { ...MODS[id], target: 'worker', mod: true };
  return UPGRADES[id];
}

// ----- setup -----
function addWorker() {
  const used = new Set(S.workers.map(w => w.name));
  const name = S.namePool.find(n => !used.has(n)) || ('V' + S.nextId);
  const w = { id: 'w' + (S.nextId++), name, color: COLORS[S.workers.length % COLORS.length], mods: [], away: 0, at: null, fresh: false };
  S.workers.push(w);
  return w;
}

function layout() {
  const chosen = [...shuffle(cellsAt(1)).slice(0, 3), ...shuffle(cellsAt(2)).slice(0, 3), ...shuffle(cellsAt(3)).slice(0, 2)];
  const types = ['field', 'field', 'well', 'forest', 'bakery', 'fletcher', 'mine', pick(['field', 'well', 'forest'])];
  for (let tries = 0; tries < 500; tries++) {
    shuffle(types);
    // the threat is final, so the layout alone must never make a run unwinnable:
    // Bakery, Fletcher, Well and Forest stay within distance 2 (an extra Well/Forest may sit at 3 if its twin is closer)
    const ok = chosen.every((c, i) => {
      const d = dist(c), t = types[i];
      if (t === 'mine' && d === 1) return false;
      if (d < 3 || t === 'field' || t === 'mine') return true;
      if (t === 'well' || t === 'forest') return chosen.some((c2, j) => j !== i && types[j] === t && dist(c2) < 3);
      return false;
    });
    if (ok) break;
  }
  S.spaces = chosen.map((c, i) => {
    const field = TYPES[types[i]].waters;
    return { id: 's' + i, type: types[i], x: c.x, y: c.y, dist: dist(c), road: 0, fert: 0, tools: 0,
      pile: field ? CFG.fieldStart.pile : 1, soak: field ? CFG.fieldStart.soak : 0, lockedBy: null };
  });
}

function newThreat() {
  const taken = new Set(S.spaces.map(s => s.x + ',' + s.y));
  const free = [...cellsAt(2), ...cellsAt(3)].filter(c => !taken.has(c.x + ',' + c.y));
  const c = pick(free);
  const type = S.nextThreat;
  const hp = threatStart(type, S.season);
  S.threat = { id: 'T', isThreat: true, type, x: c.x, y: c.y, dist: dist(c), hp, max: hp, growth: CFG.threatGrowth(S.season), cleared: false };
  S.bonus = null;
  S.nextThreat = type === 'fire' ? 'monsters' : 'fire';
}

// Optional: the other threat type, on another free cell. Never grows, never ends the run.
function spawnBonus() {
  const taken = new Set([...S.spaces, S.threat].map(s => s.x + ',' + s.y));
  const free = [...cellsAt(2), ...cellsAt(3)].filter(c => !taken.has(c.x + ',' + c.y));
  if (!free.length) return null;
  const c = pick(free);
  const type = S.threat.type === 'fire' ? 'monsters' : 'fire';
  const hp = Math.round(CFG.bonusHp(S.season) * THREATS[type].hpMul);
  S.bonus = { id: 'B', isThreat: true, bonus: true, type, x: c.x, y: c.y, dist: dist(c), hp, max: hp, growth: 0, cleared: false };
  return S.bonus;
}

function newRun() {
  S = {
    v: STATE_V, season: 1, turn: 1, hearts: CFG.startHearts, res: { ...CFG.start }, workers: [], spaces: [], threat: null, bonus: null, notes: [],
    plans: [], phase: 'play', selected: null, log: ['Tap a villager, then a space. Press End turn to collect.'],
    shop: null, pending: null, bought: { worker: 0 }, nextId: 1, namePool: shuffle([...NAMES]),
    nextThreat: pick(['fire', 'monsters']), over: null, stats: { turns: 0 },
  };
  for (let i = 0; i < 3; i++) addWorker();
  layout();
  newThreat();
  autoSelect();
}

function autoSelect() {
  const cur = S.selected && W(S.selected);
  if (cur && isFree(cur)) return;
  const f = freeWorkers()[0];
  S.selected = f ? f.id : null;
}

// ----- planning -----
// opts.dry: a Field visit that only harvests (no watering)
function preview(w, t, opts = {}) {
  const gain = {}, cost = {};
  let dmg = 0, pour = 0;
  if (t.isThreat) {
    const r = THREATS[t.type].res;
    const amount = Math.min(carry(w), avail(r));
    dmg = amount * THREATS[t.type].per + 2 * cnt(w, 'brave');
    if (dmg <= 0) return { ok: false, why: `You have no ${ICON[r]} to fight the ${THREATS[t.type].name.toLowerCase()} with.` };
    if (amount) cost[r] = amount;
  } else {
    const T = TYPES[t.type];
    if (T.kind === 'gather') {
      gain[T.res] = gatherAmt(t, w);
      if (T.waters && !opts.dry) {
        pour = Math.min(carry(w), avail('water'));
        if (pour) cost.water = pour;
      }
    } else {
      const batches = Math.floor(avail(T.from) / T.in);
      if (!batches) return { ok: false, why: `You need at least ${T.in}${ICON[T.from]} in stock to ${T.verb}. Gather it first.` };
      cost[T.from] = batches * T.in;
      gain[T.to] = batches * batchOut(t, w);
    }
  }
  const g = cnt(w, 'golden');
  if (g) gain.coins = (gain.coins || 0) + g;
  return { ok: true, gain, cost, dmg, pour, dry: !!opts.dry, travel: travelOf(t, w) };
}

function assign(wid, tid) {
  if (S.phase !== 'play') return { ok: false };
  const w = W(wid), t = target(tid);
  if (!w || !t) return { ok: false };
  if (!isFree(w)) return { ok: false, why: `${w.name} isn't home.` };
  if (t.isThreat && (t.cleared || t.hp - plannedDmg(tid) <= 0)) return { ok: false, why: t.cleared ? `The ${THREATS[t.type].name.toLowerCase()} is already dealt with.` : 'Enough villagers are already heading there to finish it.' };
  if (!t.isThreat) {
    if (t.lockedBy) { const o = W(t.lockedBy); return { ok: false, why: `${o ? o.name : 'Someone'} is still walking back from here.` }; }
    if (S.plans.some(p => p.tid === tid)) return { ok: false, why: 'Someone is already going there this turn.' };
  }
  const pv = preview(w, t);
  if (!pv.ok) return pv;
  S.plans.push({ wid, tid, ...pv });
  S.selected = null;
  autoSelect();
  return { ok: true };
}

// tapping a planned Field again: switch between "harvest and water" and "harvest only"
function toggleDry(wid) {
  const i = S.plans.findIndex(p => p.wid === wid);
  if (i < 0) return { ok: false };
  const p = S.plans[i], t = target(p.tid);
  if (!t || t.isThreat || !TYPES[t.type].waters) return { ok: false };
  S.plans.splice(i, 1);
  const pv = preview(W(wid), t, { dry: !p.dry });
  S.plans.splice(i, 0, { wid, tid: p.tid, ...pv });
  return { ok: true, dry: pv.dry };
}

function unassign(wid) {
  S.plans = S.plans.filter(p => p.wid !== wid);
  S.selected = wid;
}

// ----- resolution -----
// report.events is an ordered list of what happened, for the UI to replay one step at a time.
function meal(report, label) {
  const need = totalAppetite();
  const eat = Math.min(need, S.res.bread);
  S.res.bread -= eat;
  const short = need - eat;
  S.hearts -= short;
  report.events.push({ k: 'meal', need, eat, short, hearts: S.hearts });
  report.log.push(short ? `${label}: ate ${eat}🍞, ${short} short. −${short}❤.` : `${label}: everyone ate (${eat}🍞).`);
}

function endTurn() {
  if (S.phase !== 'play') return null;
  const report = { log: [], events: [] };
  let fought = false;
  const before = S.threat.hp;
  const got = {};
  for (const p of S.plans) {
    const w = W(p.wid), t = target(p.tid);
    for (const r in p.cost) S.res[r] -= p.cost[r];
    for (const r in p.gain) { S.res[r] += p.gain[r]; got[r] = (got[r] || 0) + p.gain[r]; }
    if (t.isThreat) { t.hp = Math.max(0, t.hp - p.dmg); if (t === S.threat) fought = true; }
    else {
      if (TYPES[t.type].kind === 'gather') t.pile = 0;
      if (p.pour) t.soak += p.pour;
      t.lockedBy = w.id;
    }
    w.away = p.travel; w.at = p.tid; w.fresh = true;
    report.events.push({ k: 'act', wid: w.id, tid: p.tid, gain: { ...p.gain }, cost: { ...p.cost }, dmg: p.dmg || 0, pour: p.pour || 0, soak: t.soak || 0, travel: p.travel, hp: t.isThreat ? t.hp : null });
  }
  const gotTxt = Object.keys(got).map(r => `+${got[r]}${ICON[r]}`).join(' ');
  if (gotTxt) report.log.push('Collected ' + gotTxt + '.');
  S.plans = [];

  // travel home
  for (const w of S.workers) {
    if (w.away > 0 && !w.fresh) {
      w.away--;
      const from = w.at;
      if (w.away === 0) {
        const sp = target(w.at);
        if (sp && !sp.isThreat && sp.lockedBy === w.id) sp.lockedBy = null;
        w.at = null;
      }
      report.events.push({ k: 'step', wid: w.id, tid: from, away: w.away });
    }
    w.fresh = false;
  }
  // accumulation
  for (const sp of S.spaces) if (!sp.lockedBy && TYPES[sp.type].kind === 'gather') {
    const n = growth(sp);
    if (!n) continue; // a dry field doesn't grow
    if (TYPES[sp.type].waters) sp.soak--;
    sp.pile += n;
    report.events.push({ k: 'pile', tid: sp.id, n, pile: sp.pile, soak: sp.soak });
  }

  const T = THREATS[S.threat.type];
  if (fought) report.log.push(`${T.name} ${before} → ${S.threat.hp}.`);
  S.stats.turns++;
  S.log = report.log;

  // the season's threat stopped: pay the bounty now, then the season carries on to the last turn
  if (!S.threat.cleared && S.threat.hp <= 0) {
    S.threat.cleared = true;
    const b = CFG.bounty(S.season, CFG.turns - S.turn);
    S.res.coins += b;
    const line = `${T.name} ${T.done} on turn ${S.turn}. Bounty +${b}🪙.`;
    report.events.push({ k: 'clear', tid: 'T', type: S.threat.type }, { k: 'bounty', tid: 'T', n: b });
    report.log.unshift(line);
    S.notes.push(line);
    const bo = S.turn < CFG.turns && spawnBonus();
    if (bo) {
      report.events.push({ k: 'spawn', bonus: { ...bo } });
      report.log.push(`Bonus: ${THREATS[bo.type].name.toLowerCase()} appeared (strength ${bo.hp}). Optional, +${CFG.bonusBounty(S.season)}🪙 if stopped by turn ${CFG.turns}.`);
    }
  } else if (!S.threat.cleared && !fought) {
    S.threat.hp += S.threat.growth;
    report.events.push({ k: 'tgrow', n: S.threat.growth, hp: S.threat.hp });
    report.log.push(`${T.name} grew to ${S.threat.hp}.`);
  }
  if (S.bonus && !S.bonus.cleared && S.bonus.hp <= 0) {
    S.bonus.cleared = true;
    const BT = THREATS[S.bonus.type];
    const b = CFG.bonusBounty(S.season);
    S.res.coins += b;
    const line = `Bonus ${BT.name.toLowerCase()} ${BT.done}. +${b}🪙.`;
    report.events.push({ k: 'clear', tid: 'B', type: S.bonus.type }, { k: 'bounty', tid: 'B', n: b });
    report.log.push(line);
    S.notes.push(line);
  }

  if (CFG.mealTurns.includes(S.turn) && S.turn < CFG.turns) meal(report, 'Meal');
  if (S.hearts <= 0) { lose('Your village went hungry.'); return report; }
  if (S.turn >= CFG.turns) {
    if (!S.threat.cleared) {
      lose(S.threat.type === 'fire' ? 'The fire burned through the village.' : 'The monsters overran the village.');
      report.events.push({ k: 'overrun' });
      return report;
    }
    finishSeason(report);
    return report;
  }
  S.turn++;
  autoSelect();
  S.log = report.log;
  return report;
}

function recallAll() {
  for (const w of S.workers) { w.away = 0; w.at = null; w.fresh = false; }
  for (const sp of S.spaces) sp.lockedBy = null;
  S.plans = [];
}

// end of the last turn, with the season's threat already stopped
function finishSeason(report) {
  if (S.bonus && !S.bonus.cleared) report.log.push(`The bonus ${THREATS[S.bonus.type].name.toLowerCase()} wandered off.`);
  meal(report, 'Season-end meal');
  recallAll();
  report.events.push({ k: 'recall' });
  if (S.hearts <= 0) { lose('Your village went hungry.'); return; }
  S.log = report.log;
  if (S.season >= CFG.seasons) { S.phase = 'won'; S.over = { win: true, why: `You survived all ${CFG.seasons} seasons.` }; return; }
  S.phase = 'shop';
  const summary = [...S.notes, ...report.log.filter(l => !S.notes.includes(l))];
  S.shop = { offers: rollOffers(), reroll: 2, summary };
}

function lose(why) {
  S.phase = 'lost';
  S.over = { win: false, why };
  recallAll();
}

// ----- shop -----
function rollOffers() {
  let pool = ['worker', 'worker', ...Object.keys(MODS), 'road', 'fertile', 'tools', 'festival'];
  if (S.hearts >= CFG.maxHearts) pool = pool.filter(x => x !== 'festival');
  const out = [];
  while (out.length < 3 && pool.length) {
    const id = pick(pool);
    pool = pool.filter(x => x !== id);
    out.push({ id, sold: false });
  }
  return out;
}

function reroll() {
  if (S.phase !== 'shop' || S.res.coins < S.shop.reroll) return false;
  S.res.coins -= S.shop.reroll;
  S.shop.reroll++;
  S.shop.offers = rollOffers();
  return true;
}

function validTarget(id, obj) {
  const d = offerDef(id);
  if (d.target === 'worker') return !!obj && !obj.isThreat && !!obj.mods;
  if (d.target === 'space') {
    if (!obj || obj.isThreat || obj.mods) return false;
    const kind = TYPES[obj.type].kind;
    if (id === 'road') return obj.dist - obj.road > 1;
    if (id === 'fertile') return kind === 'gather';
    if (id === 'tools') return kind === 'convert';
  }
  return false;
}

function buy(i) {
  if (S.phase !== 'shop') return { ok: false };
  const o = S.shop.offers[i];
  if (!o || o.sold) return { ok: false };
  const price = upgradePrice(o.id);
  if (S.res.coins < price) return { ok: false, why: `Costs ${price}🪙. You have ${S.res.coins}.` };
  const d = offerDef(o.id);
  if (!d.target) {
    S.res.coins -= price;
    o.sold = true;
    if (o.id === 'worker') { S.bought.worker++; addWorker(); }
    if (o.id === 'festival') S.hearts = Math.min(CFG.maxHearts, S.hearts + 2);
    return { ok: true };
  }
  S.phase = 'target';
  S.pending = { i, id: o.id };
  return { ok: true, targeting: true };
}

function applyTarget(objId) {
  if (S.phase !== 'target') return { ok: false };
  const { i, id } = S.pending;
  const obj = W(objId) || target(objId);
  if (!validTarget(id, obj)) return { ok: false, why: 'That can’t take this upgrade.' };
  const price = upgradePrice(id);
  S.res.coins -= price;
  S.shop.offers[i].sold = true;
  if (MODS[id]) obj.mods.push(id);
  if (id === 'road') obj.road++;
  if (id === 'fertile') obj.fert++;
  if (id === 'tools') obj.tools++;
  S.phase = 'shop';
  S.pending = null;
  return { ok: true };
}

function cancelTarget() { if (S.phase === 'target') { S.phase = 'shop'; S.pending = null; } }

function nextSeason() {
  if (S.phase !== 'shop') return;
  S.season++;
  S.turn = 1;
  S.notes = [];
  newThreat();
  S.phase = 'play';
  S.shop = null;
  S.log = [`Season ${S.season}: ${THREATS[S.threat.type].icon} ${THREATS[S.threat.type].name} at strength ${S.threat.hp}, growing +${S.threat.growth} each turn you don't fight.`];
  S.selected = null;
  autoSelect();
}

if (typeof module !== 'undefined') {
  module.exports = { CFG, TYPES, THREATS, MODS, UPGRADES, ICON, RES, get S() { return S; }, set S(v) { S = v; },
    newRun, assign, unassign, toggleDry, endTurn, buy, applyTarget, cancelTarget, nextSeason, reroll, preview, freeWorkers,
    target, threats, nextMeal, W, avail, incoming, totalAppetite, appetite, validTarget, upgradePrice, offerDef, gatherAmt, batchOut, threatStart, growth, carry, plannedDmg, STATE_V };
}
