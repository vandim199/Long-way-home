// ===== Long Way Home — game logic (no DOM) =====
const CFG = {
  seasons: 8,
  turns: 8,
  mealTurn: 4,
  startHearts: 5,
  maxHearts: 5,
  carry: 3,
  start: { wheat: 2, bread: 3, water: 1, wood: 1, arrows: 0, coins: 2 },
  threatHp: s => 5 + 2 * (s - 1),
  threatGrowth: s => 1 + Math.floor((s - 1) / 3),
  bounty: (s, unused) => 3 + s + unused,
};

const RES = ['wheat', 'bread', 'water', 'wood', 'arrows'];
const ICON = { wheat: '🌾', bread: '🍞', water: '💧', wood: '🪵', arrows: '🏹', coins: '🪙' };

const TYPES = {
  field:    { name: 'Field',    icon: '🌾', kind: 'gather',  res: 'wheat',  base: 2 },
  well:     { name: 'Well',     icon: '🪣', kind: 'gather',  res: 'water',  base: 2 },
  forest:   { name: 'Forest',   icon: '🌲', kind: 'gather',  res: 'wood',   base: 2 },
  mine:     { name: 'Mine',     icon: '⛏️', kind: 'gather',  res: 'coins',  base: 1 },
  bakery:   { name: 'Bakery',   icon: '🥖', kind: 'convert', from: 'wheat', to: 'bread',  ratio: 1, verb: 'bake' },
  fletcher: { name: 'Fletcher', icon: '🪚', kind: 'convert', from: 'wood',  to: 'arrows', ratio: 1, verb: 'make arrows' },
};

const THREATS = {
  fire:     { name: 'Fire',     icon: '🔥', res: 'water',  per: 1, done: 'put out' },
  monsters: { name: 'Monsters', icon: '👹', res: 'arrows', per: 2, done: 'driven off' },
};

const MODS = {
  swift:   { name: 'Swift',   icon: '👟', text: 'Travels 1 turn faster (never below 1).', price: 5 },
  strong:  { name: 'Strong',  icon: '💪', text: 'Carries 3 more when baking, fletching or fighting.', price: 4 },
  forager: { name: 'Forager', icon: '🧺', text: '+2 every time they gather.', price: 5 },
  golden:  { name: 'Golden',  icon: '✨', text: '+1 🪙 every time they act.', price: 6 },
  brave:   { name: 'Brave',   icon: '🛡️', text: '+2 damage when fighting, even empty-handed.', price: 4 },
  hearty:  { name: 'Hearty',  icon: '🍖', text: 'Eats 1 less 🍞 at meals.', price: 4 },
};

const UPGRADES = {
  worker:   { name: 'New villager', icon: '🧑', text: '+1 worker. Eats 1 🍞 at every meal.', target: null },
  road:     { name: 'Road',         icon: '🛤️', text: 'One space: travel time −1 (never below 1).', target: 'space', price: 4 },
  fertile:  { name: 'Fertile',      icon: '🌱', text: 'One gathering space grows +1 more each turn.', target: 'space', price: 4 },
  tools:    { name: 'Better tools', icon: '⚒️', text: 'Bakery or Fletcher: +1 output per input.', target: 'space', price: 5 },
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
const growth = sp => 1 + sp.fert;
const ratio = sp => TYPES[sp.type].ratio + sp.tools;
const gatherBase = sp => TYPES[sp.type].base + (sp.dist - 1);
const gatherAmt = (sp, w) => gatherBase(sp) + sp.pile + (w ? 2 * cnt(w, 'forager') : 0);
const travelOf = (t, w) => Math.max(1, t.dist - (t.road || 0) - (w ? cnt(w, 'swift') : 0));
const W = id => S.workers.find(w => w.id === id);
const target = id => (id === 'T' ? S.threat : S.spaces.find(s => s.id === id));
const planOf = wid => S.plans.find(p => p.wid === wid);
const isFree = w => w.away === 0 && !planOf(w.id);
const freeWorkers = () => S.workers.filter(isFree);
const avail = r => S.res[r] - S.plans.reduce((a, p) => a + (p.cost[r] || 0), 0);
const incoming = r => S.plans.reduce((a, p) => a + (p.gain[r] || 0), 0);
const plannedDmg = () => S.plans.reduce((a, p) => a + (p.dmg || 0), 0);
const nextMealIsMid = () => S.turn <= CFG.mealTurn;
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
    const ok = chosen.every((c, i) => {
      const d = dist(c), t = types[i];
      if ((t === 'bakery' || t === 'fletcher') && d === 3) return false;
      if (t === 'mine' && d === 1) return false;
      return true;
    });
    if (ok) break;
  }
  S.spaces = chosen.map((c, i) => ({ id: 's' + i, type: types[i], x: c.x, y: c.y, dist: dist(c), road: 0, fert: 0, tools: 0, pile: 1, lockedBy: null }));
}

function newThreat() {
  const taken = new Set(S.spaces.map(s => s.x + ',' + s.y));
  const free = [...cellsAt(2), ...cellsAt(3)].filter(c => !taken.has(c.x + ',' + c.y));
  const c = pick(free);
  const type = S.nextThreat;
  S.threat = { id: 'T', isThreat: true, type, x: c.x, y: c.y, dist: dist(c), hp: CFG.threatHp(S.season), max: CFG.threatHp(S.season), growth: CFG.threatGrowth(S.season) };
  S.nextThreat = type === 'fire' ? 'monsters' : 'fire';
}

function newRun() {
  S = {
    season: 1, turn: 1, hearts: CFG.startHearts, res: { ...CFG.start }, workers: [], spaces: [], threat: null,
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
function preview(w, t) {
  const gain = {}, cost = {};
  let dmg = 0;
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
    } else {
      const amount = Math.min(carry(w), avail(T.from));
      if (!amount) return { ok: false, why: `You need ${ICON[T.from]} in stock to ${T.verb}. Gather it first.` };
      cost[T.from] = amount;
      gain[T.to] = amount * ratio(t);
    }
  }
  const g = cnt(w, 'golden');
  if (g) gain.coins = (gain.coins || 0) + g;
  return { ok: true, gain, cost, dmg, travel: travelOf(t, w) };
}

function assign(wid, tid) {
  if (S.phase !== 'play') return { ok: false };
  const w = W(wid), t = target(tid);
  if (!w || !t) return { ok: false };
  if (!isFree(w)) return { ok: false, why: `${w.name} isn't home.` };
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

function unassign(wid) {
  S.plans = S.plans.filter(p => p.wid !== wid);
  S.selected = wid;
}

// ----- resolution -----
function meal(log, label) {
  const need = totalAppetite();
  const eat = Math.min(need, S.res.bread);
  S.res.bread -= eat;
  const short = need - eat;
  S.hearts -= short;
  log.push(short ? `${label}: ate ${eat}🍞, ${short} short. −${short}❤.` : `${label}: everyone ate (${eat}🍞).`);
}

function fmtGain(p) {
  const parts = [];
  if (p.dmg) parts.push('−' + p.dmg + (S.threat ? THREATS[S.threat.type].icon : ''));
  for (const r in p.gain) parts.push('+' + p.gain[r] + ICON[r]);
  return parts.join(' ');
}

function endTurn() {
  if (S.phase !== 'play') return null;
  const report = { fx: [], log: [] };
  let fought = false;
  const before = S.threat.hp;
  const got = {};
  for (const p of S.plans) {
    const w = W(p.wid), t = target(p.tid);
    for (const r in p.cost) S.res[r] -= p.cost[r];
    for (const r in p.gain) { S.res[r] += p.gain[r]; got[r] = (got[r] || 0) + p.gain[r]; }
    if (t.isThreat) { S.threat.hp = Math.max(0, S.threat.hp - p.dmg); fought = true; }
    else {
      if (TYPES[t.type].kind === 'gather') t.pile = 0;
      t.lockedBy = w.id;
    }
    w.away = p.travel; w.at = p.tid; w.fresh = true;
    report.fx.push({ tid: p.tid, text: fmtGain(p) });
  }
  const gotTxt = Object.keys(got).map(r => `+${got[r]}${ICON[r]}`).join(' ');
  if (gotTxt) report.log.push('Collected ' + gotTxt + '.');
  S.plans = [];

  // travel home
  for (const w of S.workers) {
    if (w.away > 0 && !w.fresh) {
      w.away--;
      if (w.away === 0) {
        const sp = w.at === 'T' ? null : target(w.at);
        if (sp && sp.lockedBy === w.id) sp.lockedBy = null;
        w.at = null;
      }
    }
    w.fresh = false;
  }
  // accumulation
  for (const sp of S.spaces) if (!sp.lockedBy && TYPES[sp.type].kind === 'gather') sp.pile += growth(sp);

  const T = THREATS[S.threat.type];
  if (fought) report.log.push(`${T.name} ${before} → ${S.threat.hp}.`);
  S.stats.turns++;
  S.log = report.log;
  if (S.threat.hp <= 0) { finishSeason(report); return report; }
  if (!fought) { S.threat.hp += S.threat.growth; report.log.push(`${T.name} grew to ${S.threat.hp}.`); }

  if (S.turn === CFG.mealTurn) meal(report.log, 'Meal');
  if (S.hearts <= 0) { lose('Your village went hungry.'); return report; }
  if (S.turn >= CFG.turns) {
    lose(S.threat.type === 'fire' ? 'The fire burned through the village.' : 'The monsters overran the village.');
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

function finishSeason(report) {
  const T = THREATS[S.threat.type];
  meal(report.log, 'Season-end meal');
  recallAll();
  if (S.hearts <= 0) { lose('Your village went hungry.'); return; }
  const unused = CFG.turns - S.turn;
  const b = CFG.bounty(S.season, unused);
  S.res.coins += b;
  report.log.unshift(`${T.name} ${T.done} on turn ${S.turn}. Bounty +${b}🪙.`);
  S.log = report.log;
  if (S.season >= CFG.seasons) { S.phase = 'won'; S.over = { win: true, why: `You survived all ${CFG.seasons} seasons.` }; return; }
  S.phase = 'shop';
  S.shop = { offers: rollOffers(), reroll: 2, summary: report.log.slice() };
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
  newThreat();
  S.phase = 'play';
  S.shop = null;
  S.log = [`Season ${S.season}: ${THREATS[S.threat.type].icon} ${THREATS[S.threat.type].name} at strength ${S.threat.hp}, growing +${S.threat.growth} each turn you don't fight.`];
  S.selected = null;
  autoSelect();
}

if (typeof module !== 'undefined') {
  module.exports = { CFG, TYPES, THREATS, MODS, UPGRADES, ICON, RES, get S() { return S; }, set S(v) { S = v; },
    newRun, assign, unassign, endTurn, buy, applyTarget, cancelTarget, nextSeason, reroll, preview, freeWorkers,
    target, W, avail, incoming, totalAppetite, appetite, validTarget, upgradePrice, offerDef, gatherAmt, plannedDmg };
}
