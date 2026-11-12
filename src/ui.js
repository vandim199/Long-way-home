// ===== Long Way Home — UI =====
// Rendering reads the global S. While a turn is being replayed, S temporarily points at a copy of the
// pre-turn state that the replay steps forward one event at a time; the real post-turn state is restored at the end.
const $ = s => document.querySelector(s);
let toastTimer = null;
let helpOpen = false;
let anim = null; // { fast, combo } while a turn is being replayed
const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

// ---------- sprites (Kenney Tiny Farm F, Tiny Town T, Tiny Dungeon D; 12 tiles per row) ----------
function sp(code, k, extra = '', cls = '') {
  const i = +code.slice(1);
  return `<i class="sp ${code[0]} ${cls}" style="--sx:${i % 12};--sy:${(i / 12) | 0};${k ? `--k:${k};` : ''}${extra}" aria-hidden="true"></i>`;
}
const SPR = { wheat: 'F68', bread: 'F125', water: 'T131', wood: 'T106', arrows: 'T119', coins: 'T93' };
const ico = (r, k = 1) => sp(SPR[r], k);
const threatIco = (type, k = 1) => (type === 'fire' ? `<span style="font-size:${14 * k}px;line-height:1">🔥</span>` : sp('D110', k));
const VILLAGER = ['F109', 'D99', 'D86', 'F108', 'D100', 'D85', 'D88', 'D98', 'D87', 'D84'];
const vsp = (w, k, cls = '') => sp(VILLAGER[(parseInt(w.id.slice(1), 10) - 1) % VILLAGER.length], k, '', cls);

// layered 2×2-tile art; x/y in tile units
const art = layers => `<span class="art">${layers.map(([c, x, y]) => sp(c, 0, `left:calc(${x} * var(--u));top:calc(${y} * var(--u))`)).join('')}</span>`;
function hash(x, y) { let h = 2166136261 ^ (x * 73856093) ^ (y * 19349663) ^ ((S.spaces[0] && S.spaces[0].x * 31 + S.spaces[0].y * 7) || 0); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; }
const grass = h => { const g = ['T0', 'T0', 'T0', 'T1', 'T2']; return [[g[h % 5], 0, 0], [g[(h >>> 3) % 5], 1, 0], [g[(h >>> 6) % 5], 0, 1], [g[(h >>> 9) % 5], 1, 1]]; };
const cottage = roof => roof === 'red' ? [['T52', 0, 0], ['T54', 1, 0], ['T72', 0, 1], ['T85', 1, 1]] : [['T48', 0, 0], ['T50', 1, 0], ['T84', 0, 1], ['T85', 1, 1]];
const SPACE_ART = {
  field: () => [['F0', 0, 0], ['F1', 1, 0], ['F36', 0, 1], ['F37', 1, 1], ['F66', 0, 0], ['F66', 1, 0], ['F66', 0, 1], ['F66', 1, 1]],
  well: h => [...grass(h), ['T17', 0, 1.05], ['T104', 0.5, 0.35], ['T131', 1.05, 1]],
  forest: h => [...grass(h), ['T4', 0, 0], ['T16', 0, 1], ['T3', 1, -0.1], ['T15', 1, 0.9], ['T28', 0.5, 0.95]],
  mine: h => [...grass(h), ['F89', 0.1, 0.15], ['F77', 1, 0.3], ['T115', 0.45, 1], ['T93', 1.1, 1]],
  bakery: () => [...grass(0), ...cottage('red'), ['F74', 0, 1.05]],
  fletcher: h => [...grass(h), ['T95', 0.1, 0.1], ['T106', 1, 0.25], ['T118', 0.15, 1], ['T119', 1, 1]],
};
// empty meadow cells: mostly bare grass, sometimes a bit of life (never wheat, so Fields stay readable)
const DECO = [[], [], [], [], [['T5', 0.9, 0.9]], [['T29', 0.2, 0.7]], [['F83', 0.8, 0.2]], [['F122', 0.5, 0.6]], [['F120', 0.3, 0.4]],
  [['T28', 1, 0.1]], [['F77', 1, 1]], [['T2', 0.4, 0.4]], [['F121', 0.5, 0.5]]];

// pixel heart, drawn as SVG so it stays crisp at any size
const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
function heartSVG(full) {
  const on = (x, y) => HEART[y] && HEART[y][x] === 'X';
  let r = '';
  for (let y = -1; y <= 6; y++) for (let x = -1; x <= 7; x++) {
    if (on(x, y)) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([dx, dy]) => on(x + dx, y + dy))) r += `<rect x="${x + 1}" y="${y + 1}" width="1" height="1" fill="#3e2731"/>`;
  }
  for (let y = 0; y < 6; y++) for (let x = 0; x < 7; x++) if (on(x, y)) r += `<rect x="${x + 1}" y="${y + 1}" width="1" height="1" fill="${full ? '#e43b44' : '#d9c39b'}"/>`;
  if (full) r += '<rect x="2" y="2" width="1" height="1" fill="#fff"/>';
  return `<span class="heart"><svg viewBox="0 0 9 8">${r}</svg></span>`;
}
const HEART_ON = heartSVG(true), HEART_OFF = heartSVG(false);

// ---------- sound: Kenney audio, pitched up step by step during a turn ----------
const sound = { ctx: null, master: null, bufs: {}, muted: store.get('lwh-muted') === '1' };
function audioInit() {
  if (sound.ctx) { if (sound.ctx.state === 'suspended') sound.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC || typeof SFX_SRC === 'undefined') return;
  sound.ctx = new AC();
  sound.master = sound.ctx.createGain();
  sound.master.gain.value = 0.7;
  sound.master.connect(sound.ctx.destination);
  for (const k in SFX_SRC) {
    try {
      const bin = atob(SFX_SRC[k].split(',')[1]);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      sound.ctx.decodeAudioData(u8.buffer).then(b => { sound.bufs[k] = b; }, () => {});
    } catch (e) {}
  }
}
// major pentatonic, so a long run of rising clinks stays musical
const PENTA = [0, 2, 4, 7, 9];
const semis = n => Math.min(21, 12 * Math.floor(n / 5) + PENTA[n % 5]);
function sfx(name, st = 0, vol = 1) {
  if (sound.muted || !sound.ctx) return;
  const b = sound.bufs[name];
  if (!b) return;
  const src = sound.ctx.createBufferSource();
  src.buffer = b;
  src.playbackRate.value = Math.pow(2, st / 12);
  const g = sound.ctx.createGain();
  g.gain.value = vol;
  src.connect(g).connect(sound.master);
  src.start();
}
// one rising note per event in a turn's replay
function riser(name, base = 0, vol = 1) {
  const n = anim ? anim.combo++ : 0;
  const st = base + semis(n);
  sfx(name, st, vol);
  if (n >= 4) sfx('ding', st - 5, Math.min(0.5, 0.12 + n * 0.03));
  return n;
}

// ---------- small helpers ----------
function toast(msg, bad) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  if (bad) sfx('error', 0, 0.6);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
const cellOf = t => $(`#board .cell[data-x="${t.x}"][data-y="${t.y}"]`);
const homeCell = () => $('#board .cell[data-x="2"][data-y="2"]');
const chipOf = r => (r === 'coins' ? $('#coinsBox') : $(`#res .chip[data-r="${r}"]`));
function center(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + window.scrollX + r.width / 2, y: r.top + window.scrollY + r.height / 2 };
}
function bump(el, cls = 'bump') {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
function pop(el, html, cls = '', size) {
  if (!el) return;
  const p = center(el);
  const d = document.createElement('div');
  d.className = 'pop ' + cls;
  d.innerHTML = html;
  d.style.left = p.x + 'px';
  d.style.top = (p.y - 6) + 'px';
  if (size) d.style.setProperty('--fs', size + 'px');
  d.style.setProperty('--rot', (Math.random() * 10 - 5).toFixed(1) + 'deg');
  if (anim && anim.fast) d.style.setProperty('--dur', '.6s');
  $('#fx').appendChild(d);
  setTimeout(() => d.remove(), 1300);
}
// fly a sprite from one element to another along a little arc
function fly(fromEl, toEl, html, dur = 360) {
  if (!fromEl || !toEl || reduceMotion()) return Promise.resolve();
  if (anim && anim.fast) dur *= 0.4;
  const a = center(fromEl), b = center(toEl);
  const d = document.createElement('div');
  d.className = 'flyer';
  d.innerHTML = html;
  $('#fx').appendChild(d);
  const w = d.offsetWidth / 2, h = d.offsetHeight / 2;
  const mx = (a.x + b.x) / 2, my = Math.min(a.y, b.y) - 40;
  const k = d.animate([
    { transform: `translate(${a.x - w}px, ${a.y - h}px) scale(1)` },
    { transform: `translate(${mx - w}px, ${my - h}px) scale(1.25)`, offset: 0.45 },
    { transform: `translate(${b.x - w}px, ${b.y - h}px) scale(.8)` },
  ], { duration: dur, easing: 'cubic-bezier(.45,0,.55,1)' });
  return k.finished.then(() => d.remove(), () => d.remove());
}
const wait = ms => new Promise(r => setTimeout(r, reduceMotion() ? Math.min(ms, 80) : anim && anim.fast ? ms * 0.3 : ms));

// ---------- render ----------
function render() {
  renderTop();
  renderHud();
  renderRes();
  renderBoard();
  renderCrew();
  renderFoot();
  renderOverlay();
}

function renderTop() {
  $('#season').textContent = `${S.season}/${CFG.seasons}`;
  $('#turn').textContent = `${S.turn}/${CFG.turns}`;
  let h = '';
  for (let i = 0; i < CFG.maxHearts; i++) h += i < S.hearts ? HEART_ON : HEART_OFF;
  $('#hearts').innerHTML = `<span class="hearts" aria-label="${S.hearts} hearts">${h}</span>`;
  $('#coins').innerHTML = `${ico('coins', 1)}<span>${S.res.coins}</span>`;
  $('#heartsBox').classList.toggle('low', S.hearts <= 2);
  $('#muteBtn').textContent = sound.muted ? '🔈' : '🔊';
}

function threatHead(t, title) {
  const T = THREATS[t.type];
  const dmg = plannedDmg(t.id);
  const after = Math.max(0, t.hp - dmg);
  const pct = Math.min(100, Math.round((t.hp / Math.max(t.max, t.hp)) * 100));
  const afterPct = Math.min(100, Math.round((after / Math.max(t.max, t.hp)) * 100));
  return `<div class="card-head"><span class="big-ico">${threatIco(t.type, t.type === 'fire' ? 1.3 : 2)}</span><span class="card-title">${title}</span>
      <span class="hp" id="threatHp">${dmg ? `<s>${t.hp}</s> ${after}` : t.hp}</span></div>
    <div class="bar"><i style="width:${pct}%"></i><b style="width:${afterPct}%"></b></div>`;
}

function renderHud() {
  const t = S.threat, T = THREATS[t.type];
  const left = CFG.turns - S.turn;
  const card = $('#threat');
  if (!t.cleared) {
    card.className = 'card panel threat ' + t.type;
    card.innerHTML = threatHead(t, T.name) + `
      <div class="card-line">Fight with ${ico(T.res)}${T.per > 1 ? ` (${T.per} dmg each)` : ''} · grows +${t.growth} if ignored</div>
      <div class="card-line strong">${left === 0 ? 'Last turn to stop it!' : `${left + 1} turns left to stop it`}</div>`;
  } else if (S.bonus && !S.bonus.cleared) {
    const B = S.bonus, BT = THREATS[B.type];
    card.className = 'card panel threat bonus ' + B.type;
    card.innerHTML = threatHead(B, `<span class="star">★</span> Bonus ${BT.name.toLowerCase()}`) + `
      <div class="card-line">Optional · fight with ${ico(BT.res)}${BT.per > 1 ? ` (${BT.per} dmg each)` : ''} · never grows · +${CFG.bonusBounty(S.season)}${ico('coins')}</div>
      <div class="card-line strong">${T.name} ${T.done} ✓ · ${left === 0 ? 'last turn' : `${left + 1} turns left`}</div>`;
  } else {
    card.className = 'card panel threat calm';
    card.innerHTML = `<div class="card-head"><span class="big-ico">${sp('F83', 2)}</span><span class="card-title">All quiet</span><span class="hp">✓</span></div>
      <div class="card-line">${T.name} ${T.done}${S.bonus ? `, bonus ${THREATS[S.bonus.type].name.toLowerCase()} too` : ''}. Farm freely and stock up.</div>
      <div class="card-line strong">${left === 0 ? 'Season ends after this turn' : `Season ends after turn ${CFG.turns} · ${left + 1} turns left`}</div>`;
  }

  const need = totalAppetite();
  const have = S.res.bread, inc = incoming('bread'), out = S.plans.reduce((a, p) => a + (p.cost.bread || 0), 0);
  const proj = have + inc - out;
  const nm = nextMeal();
  const when = nm === S.turn ? 'after this turn' : nm === CFG.turns ? `at season end (turn ${CFG.turns})` : `after turn ${nm}`;
  const short = proj < need;
  $('#meal').className = 'card panel meal' + (short ? ' short' : '');
  $('#meal').innerHTML = `
    <div class="card-head"><span class="big-ico">${sp('F123', 2)}</span><span class="card-title">Meal</span><span class="hp">${need}${ico('bread')}</span></div>
    <div class="card-line strong">${when}</div>
    <div class="card-line">${short ? `Short by ${need - proj}. Each missing ${ico('bread')} costs a heart.` : `Covered: ${proj} bread after this turn.`}</div>`;
}

function renderRes() {
  $('#res').innerHTML = RES.map(r => {
    const inc = incoming(r), out = S.res[r] - avail(r);
    return `<div class="chip panel" data-r="${r}" title="${r}">${ico(r, 2)}<span class="rv">${S.res[r]}</span>
      <span class="delta">${out ? `<span class="rout">−${out}</span>` : ''}${inc ? `<span class="rin">+${inc}</span>` : ''}</span></div>`;
  }).join('');
}

function gainHTML(p, type = S.threat.type) {
  const parts = [];
  if (p.dmg) parts.push(`−${p.dmg}${threatIco(type)}`);
  for (const r in p.gain) parts.push(`+${p.gain[r]}${ico(r)}`);
  return parts.join(' ');
}

function tileHTML(x, y) {
  const h = hash(x, y);
  if (x === 2 && y === 2) {
    const home = S.workers.filter(w => w.away === 0);
    return `<div class="tile home" aria-label="Home">${art([...grass(h), ...cottage('blue')])}
      <span class="home-who">${home.map(w => `<span style="--wc:${w.color}">${vsp(w, 1, '', planOf(w.id) ? 'ghost' : '')}</span>`).join('')}</span></div>`;
  }
  const spc = S.spaces.find(s => s.x === x && s.y === y);
  const th = [S.threat, S.bonus].find(t => t && t.x === x && t.y === y);
  const isT = !!th;
  if (!spc && !isT) return `<div class="tile empty" aria-hidden="true">${art([...grass(h), ...DECO[h % DECO.length]])}</div>`;
  const t = isT ? th : spc;
  const comingBack = isT ? S.workers.filter(w => w.at === t.id && w.away > 0) : [];
  const backHTML = () => comingBack.length ? `<span class="who">${comingBack.map(w => `<span style="--wc:${w.color}">${vsp(w, 1)}</span>`).join('')}</span>` : '';
  // a stopped threat leaves a quiet cell behind (villagers may still be walking back from it)
  if (isT && t.cleared) {
    const T = THREATS[t.type];
    const scene = t.type === 'fire' ? [['T24', 0, 0], ['T25', 1, 0], ['T26', 0, 1], ['T25', 1, 1], ...cottage('red')] : [...grass(h), ['F77', 0.2, 0.9], ['T29', 1, 0.2]];
    return `<div class="tile foe cleared ${t.type}" aria-label="${esc(`${t.bonus ? 'Bonus ' : ''}${T.name} ${T.done}`)}">${art(scene)}<span class="pill done">✓</span>${backHTML()}</div>`;
  }
  const sel = S.selected && W(S.selected);
  const plans = S.plans.filter(p => p.tid === t.id);
  const targetable = S.phase === 'target' && validTarget(S.pending.id, t);
  let cls = 'tile', body = '', label;
  const travel = travelOf(t, sel || null);
  if (isT) {
    const T = THREATS[t.type];
    label = `${t.bonus ? 'Optional bonus: ' : ''}${T.name}, strength ${t.hp}`;
    cls += ' foe ' + t.type + (t.bonus ? ' bonus' : '');
    if (t.type === 'fire') {
      body = art([['T24', 0, 0], ['T25', 1, 0], ['T26', 0, 1], ['T25', 1, 1], ...cottage('red')]) +
        `<span class="flame" style="left:8%;top:22%">🔥</span><span class="flame" style="left:48%;top:8%;animation-delay:.25s">🔥</span><span class="flame" style="left:30%;top:46%;animation-delay:.1s">🔥</span>`;
    } else {
      // only creatures here, no people, so it never reads as a villager standing on the tile
      body = art([...grass(h), ['T29', 0.9, 0.05], ['D120', 0.1, 0], ['D110', 0, 0.85], ['D122', 1, 0.8]]);
    }
    body += `<span class="pill">${t.bonus ? '<span class="star">★</span>' : ''}${threatIco(t.type)}<span>${t.hp}</span></span><span class="trav">👣${travel}</span>`;
    if (!plans.length) body += backHTML();
  } else {
    const ty = TYPES[spc.type];
    label = ty.name;
    cls += ' ' + ty.kind + ' t-' + spc.type;
    body = art(SPACE_ART[spc.type](h));
    let mid;
    if (ty.kind === 'gather') mid = `<span>${gatherAmt(spc, sel || null)}</span>${ico(ty.res)}`;
    else mid = `<span>${ty.in}</span>${ico(ty.from)}<em>▸</em><span>${batchOut(spc, sel || null)}</span>${ico(ty.to)}`;
    if (ty.waters) label += spc.soak ? `, ${spc.soak} water soaked (+${growth(spc)} wheat per turn)` : ', dry';
    const extras = (spc.fert ? '🌱' : '') + (spc.road ? '🛤️' : '') + (spc.tools ? '⚒️' : '');
    if (spc.lockedBy) {
      const w = W(spc.lockedBy);
      cls += ' locked';
      label += `, ${w.name} back in ${w.away}`;
      body += `<span class="walker" style="--wc:${w.color}">${vsp(w)}<span class="ring"></span></span><span class="bubble">${w.away}</span>`;
    } else {
      const p = plans[0];
      const pv = p ? gainHTML(p) : mid;
      body += `<span class="pill">${pv}</span><span class="trav">👣${travel}</span>${extras ? `<span class="ext">${extras}</span>` : ''}`;
    }
    if (ty.waters) {
      const pour = !spc.lockedBy && plans[0] && plans[0].pour;
      body += `<span class="soak ${spc.soak || pour ? '' : 'dry'}" title="Soaked water">${ico('water')}<b>${spc.soak}</b>${pour ? `<i class="pour">+${pour}</i>` : ''}${!spc.lockedBy && plans[0] && plans[0].dry ? '<i class="hold" title="Harvest only">✕</i>' : ''}</span>`;
    }
  }
  if (plans.length) {
    cls += ' planned';
    body += `<span class="who">${plans.map(p => { const w = W(p.wid); return `<span style="--wc:${w.color}">${vsp(w)}</span>`; }).join('')}</span>`;
    if (isT) body += `<span class="pill dmgpv">${gainHTML({ dmg: plans.reduce((a, p) => a + p.dmg, 0), gain: {} }, t.type)}</span>`;
  }
  const canGo = S.phase === 'play' && !anim && sel && isFree(sel) && (isT ? t.hp - plannedDmg(t.id) > 0 : !spc.lockedBy && !plans.length);
  if (canGo) cls += ' avail';
  if (targetable) cls += ' targetable';
  return `<button class="${cls}" data-act="tile" data-id="${t.id}" aria-label="${esc(label)}">${body}</button>`;
}

function renderBoard() {
  let h = '';
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) h += `<div class="cell" data-x="${x}" data-y="${y}">${tileHTML(x, y)}</div>`;
  $('#board').innerHTML = h;
  const banner = $('#banner');
  if (S.phase === 'target') {
    const d = offerDef(S.pending.id);
    banner.hidden = false;
    banner.innerHTML = `<span>${d.icon} <b>${esc(d.name)}</b> (${upgradePrice(S.pending.id)} coins): tap ${d.target === 'worker' ? 'a villager' : 'a highlighted space'}</span><button data-act="cancel">Cancel</button>`;
  } else banner.hidden = true;
}

function renderCrew() {
  $('#crew').innerHTML = S.workers.map(w => {
    const p = planOf(w.id);
    let st, cls = 'worker panel';
    if (w.away > 0) { st = `Walking home · ${w.away}`; cls += ' away'; }
    else if (p) { const t = target(p.tid); st = `→ ${t.isThreat ? THREATS[t.type].name : TYPES[t.type].name}${p.dry ? ' (harvest only)' : ''}`; cls += ' planned'; }
    else st = S.selected === w.id ? 'Ready' : 'Home';
    if (S.selected === w.id && S.phase === 'play' && !anim) cls += ' sel';
    if (S.phase === 'target' && validTarget(S.pending.id, w)) cls += ' targetable';
    const mods = w.mods.map(m => `<span title="${MODS[m].name}">${MODS[m].icon}</span>`).join('');
    return `<button class="${cls}" data-act="worker" data-id="${w.id}" style="--wc:${w.color}">
      <span class="portrait">${vsp(w, 2)}</span><span class="wtext"><span class="wname">${esc(w.name)}</span><span class="wstat">${st}</span></span>
      <span class="wside"><span class="mods">${mods}</span><span class="eat">eats ${appetite(w)}${ico('bread')}</span></span></button>`;
  }).join('');
}

function renderFoot() {
  const free = freeWorkers().length, planned = S.plans.length;
  const btn = $('#endTurn');
  btn.disabled = S.phase !== 'play' || !!anim;
  btn.classList.toggle('busy', !!anim);
  if (anim) btn.innerHTML = `Harvesting… <small>tap anywhere to speed up</small>`;
  else if (!planned && !free) btn.innerHTML = `Wait <small>everyone is away</small>`;
  else {
    // this turn's payout at a glance: "+5 coins +3 wheat −3 fire"
    const gains = {};
    for (const p of S.plans) for (const r in p.gain) gains[r] = (gains[r] || 0) + p.gain[r];
    const parts = [...RES, 'coins'].filter(r => gains[r]).map(r => `<span>+${gains[r]}${ico(r)}</span>`);
    for (const th of threats()) { const d = plannedDmg(th.id); if (d) parts.push(`<span class="dmg">−${d}${threatIco(th.type)}</span>`); }
    const esum = parts.length ? parts.join('') : '<span class="none">nobody sent</span>';
    btn.innerHTML = `End turn<span class="esum">${esum}</span>${planned && free ? `<small>${free} still home</small>` : ''}`;
  }
  $('#log').innerHTML = anim ? '' : (S.log || []).map(l => `<li>${esc(l)}</li>`).join('');
}

function offerCard(o, i) {
  const d = offerDef(o.id);
  const price = upgradePrice(o.id);
  const afford = S.res.coins >= price;
  return `<div class="offer ${o.sold ? 'sold' : ''}">
    <span class="oi">${d.icon}</span>
    <span class="ot"><b>${esc(d.name)}</b><span>${esc(d.text)}</span>${d.mod ? '<em>Stacks. Each modifier past the first adds +1 🍞 to that villager’s meals.</em>' : ''}</span>
    <button data-act="buy" data-i="${i}" ${o.sold || !afford ? 'disabled' : ''}>${o.sold ? 'Bought' : `${price}${ico('coins')}`}</button></div>`;
}

function renderOverlay() {
  const ov = $('#overlay');
  if (anim) { ov.hidden = true; ov.innerHTML = ''; return; }
  if (S.phase === 'shop') {
    const nextT = THREATS[S.nextThreat];
    ov.hidden = false;
    ov.innerHTML = `<div class="sheet panel">
      <p class="eyebrow">Season ${S.season} cleared</p>
      <h2>Market day</h2>
      <ul class="sum">${S.shop.summary.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
      <div class="purse">You have <b>${S.res.coins}${ico('coins', 1)}</b> · <span class="hearts">${HEART_ON}</span> ${S.hearts}</div>
      <div class="offers">${S.shop.offers.map(offerCard).join('')}</div>
      <div class="sheet-actions">
        <button class="ghost" data-act="reroll" ${S.res.coins < S.shop.reroll ? 'disabled' : ''}>New offers · ${S.shop.reroll}${ico('coins')}</button>
        <button class="go" data-act="next">Start season ${S.season + 1}</button>
      </div>
      <p class="next">Next up: ${nextT.icon} ${nextT.name}, strength ${CFG.threatHp(S.season + 1)}, grows +${CFG.threatGrowth(S.season + 1)}.</p>
    </div>`;
  } else if (S.phase === 'lost' || S.phase === 'won') {
    ov.hidden = false;
    ov.innerHTML = `<div class="sheet panel end ${S.over.win ? 'win' : 'loss'}">
      <p class="eyebrow">${S.over.win ? 'Victory' : 'Run over'}</p>
      <h2>${esc(S.over.why)}</h2>
      <p>Reached season ${S.season}, turn ${S.turn}, with ${S.workers.length} villagers.</p>
      <ul class="sum">${(S.log || []).map(l => `<li>${esc(l)}</li>`).join('')}</ul>
      <div class="sheet-actions"><button class="go" data-act="newrun">New run</button></div></div>`;
  } else if (helpOpen) {
    ov.hidden = false;
    ov.innerHTML = `<div class="sheet panel help">
      <h2>How to play</h2>
      <ul class="rules">
        <li><b>Send villagers.</b> Tap a villager, then a space. Send as many as you like, then press <b>End turn</b>. Everything pays out at the end of the turn.</li>
        <li><b>The long way home.</b> 👣 is how many turns the villager stays away. Until they're back, you can't use that villager <i>or</i> that space.</li>
        <li><b>Piles grow.</b> Wells, Forests and the Mine grow +1 every turn nobody is using them. Far spaces start bigger.</li>
        <li><b>Water your fields.</b> A Field visit harvests the wheat and pours up to ${CFG.carry} ${ico('water')} into the soil. Each free turn, the field turns 1 soaked ${ico('water')} into +${CFG.fieldGrow} ${ico('wheat')}. A dry field doesn't grow. Tap a planned Field again for <i>harvest only</i> (keep your water), and once more to cancel.</li>
        <li><b>Bake and fletch everything at once.</b> The Bakery turns all your wheat into bread (2 ${ico('wheat')} → 1 ${ico('bread')}); the Fletcher turns all your wood into arrows (1 ${ico('wood')} → 2 ${ico('arrows')}). They only use what's already in your store, not what's arriving this turn.</li>
        <li><b>Meals.</b> After turn ${CFG.mealTurns.join(', ')} and at season end, each villager eats ${ico('bread')}. Each missing bread costs a heart. At 0 hearts the run ends.</li>
        <li><b>The threat.</b> Fight it by sending villagers with ${ico('water')} (fire) or ${ico('arrows')} (monsters). Water is also what grows your wheat, so fire seasons are hungry seasons. Each carries ${CFG.carry}. Any number can go at once, and fighters are always back next turn (👣1). It grows on turns you don't fight it. Stop it by turn ${CFG.turns} or the run ends. The season always lasts ${CFG.turns} turns, so stopping it early leaves free turns to farm.</li>
        <li><b>Bonus threat.</b> Once the season's threat is stopped, a <span class="star">★</span> bonus threat of the other kind appears. It's optional: it never grows and ignoring it costs nothing, but stopping it pays extra ${ico('coins')}.</li>
        <li><b>Market.</b> After turn ${CFG.turns}. Stopping the threat early pays a bigger bounty. Spend coins between seasons on villagers, modifiers and space upgrades.</li>
      </ul>
      <p class="credits">Art and sound: Kenney (kenney.nl), CC0.</p>
      <div class="sheet-actions"><button class="go" data-act="closehelp">Got it</button></div></div>`;
  } else {
    ov.hidden = true;
    ov.innerHTML = '';
  }
}

// ---------- turn replay ----------
const STEP = { spawn: 900, act: 430, step: 330, home: 380, pile: 170, tgrow: 520, clear: 950, meal: 750, recall: 600, bounty: 800, overrun: 700 };
const pace = n => Math.max(0.55, 1 - n * 0.035);

async function playTurn() {
  const before = JSON.parse(JSON.stringify(S));
  const report = endTurn();
  if (!report) return;
  const after = S;
  if (reduceMotion() && sound.muted) { render(); return; }
  S = before;
  anim = { fast: false, combo: 0 };
  render();
  try {
    for (const ev of report.events) await playEvent(ev);
    await wait(200);
  } catch (e) { console.error(e); }
  S = after;
  anim = null;
  render();
}

async function playEvent(ev) {
  if (ev.k === 'act') {
    const w = W(ev.wid), t = target(ev.tid);
    S.plans = S.plans.filter(p => p.wid !== ev.wid);
    if (ev.pour && !t.isThreat) t.soak = ev.soak;
    for (const r in ev.cost) S.res[r] -= ev.cost[r];
    renderRes(); renderHud(); renderBoard();
    await fly(homeCell(), cellOf(t), vsp(w), 300);
    w.away = ev.travel; w.at = ev.tid;
    if (t.isThreat) t.hp = ev.hp;
    else { if (TYPES[t.type].kind === 'gather') t.pile = 0; t.lockedBy = w.id; }
    renderBoard(); renderHud(); renderCrew();
    const cell = cellOf(t);
    bump(cell, 'flash');
    const n = anim.combo;
    const size = Math.min(40, 24 + n * 2);
    if (ev.dmg) {
      riser('hit', -2, 0.9);
      bump(cell, 'hit');
      pop(cell, `−${ev.dmg}${threatIco(t.type, 2)}`, 'dmg', size);
      bump($('#threatHp'));
    }
    const gains = Object.keys(ev.gain);
    if (gains.length) {
      if (!ev.dmg) riser('clink', 0, 0.9);
      const costTxt = ev.pour ? `<span class="sub water">+${ev.pour}${ico('water')} soaked</span>` : Object.keys(ev.cost).filter(() => !ev.dmg).map(r => `<span class="sub">−${ev.cost[r]}${ico(r)}</span>`).join('');
      pop(cell, gains.map(r => `+${ev.gain[r]}${ico(r, 2)}`).join(' ') + costTxt, '', size);
      for (const r of gains) {
        fly(cell, chipOf(r), ico(r, 2), 420).then(() => {
          S.res[r] += ev.gain[r];
          if (anim) { renderRes(); renderTop(); renderHud(); }
          const c = chipOf(r);
          bump(c);
          sfx('clink', 7 + semis(Math.min(anim ? anim.combo : 0, 10)), 0.35);
        });
      }
    }
    await wait(STEP.act * pace(n));
    return;
  }
  if (ev.k === 'step') {
    const w = W(ev.wid), t = target(ev.tid) || S.threat;
    const cell = cellOf(t);
    w.away = ev.away;
    if (ev.away === 0) {
      if (t && !t.isThreat && t.lockedBy === w.id) t.lockedBy = null;
      w.at = null;
      renderBoard(); renderCrew();
      const n = riser('step', -3, 0.8);
      pop(cellOf(t), `${sp('T17', 1)}free`, 'info', 15);
      await fly(cellOf(t), homeCell(), vsp(w), 380);
      bump(homeCell(), 'flash');
      riser('home', 0, 0.9);
      pop(homeCell(), `${esc(w.name)} is home!`, 'info', 16);
      await wait(STEP.home * pace(n));
    } else {
      renderBoard(); renderCrew();
      const n = riser('step', -3, 0.8);
      const c = cellOf(t);
      bump(c && c.querySelector('.bubble'));
      pop(c, `−1 ⏳`, 'info', 18);
      await wait(STEP.step * pace(n));
    }
    return;
  }
  if (ev.k === 'pile') {
    const t = target(ev.tid);
    t.pile = ev.pile;
    const field = TYPES[t.type].waters;
    if (field) t.soak = ev.soak;
    renderBoard();
    const n = riser('pluck', 5, 0.7);
    pop(cellOf(t), `+${ev.n}${ico(TYPES[t.type].res, field ? 2 : 1)}${field ? `<span class="sub water">−1${ico('water')}</span>` : ''}`, 'info', field ? 22 : 17);
    if (field) bump(cellOf(t).querySelector('.soak'));
    bump(cellOf(t).querySelector('.pill'));
    await wait(STEP.pile * pace(n));
    return;
  }
  if (ev.k === 'tgrow') {
    S.threat.hp = ev.hp;
    renderBoard(); renderHud();
    sfx('grow', 0, 1);
    pop(cellOf(S.threat), `+${ev.n}${threatIco(S.threat.type, 2)}`, 'bad', 28);
    bump(cellOf(S.threat), 'hit');
    bump($('#threat'), 'shake');
    await wait(STEP.tgrow);
    return;
  }
  if (ev.k === 'clear') {
    const T = THREATS[ev.type], t = target(ev.tid);
    t.cleared = true;
    renderBoard(); renderHud();
    sfx('bell', ev.tid === 'B' ? 4 : 0, 0.8);
    riser('clink', 0, 1);
    bump(cellOf(t), 'flash');
    pop(cellOf(t), `${ev.tid === 'B' ? 'Bonus ' : ''}${T.done}!`, 'big', 34);
    bump($('#threat'));
    await wait(STEP.clear);
    return;
  }
  if (ev.k === 'spawn') {
    S.bonus = { ...ev.bonus };
    renderBoard(); renderHud();
    const cell = cellOf(S.bonus);
    sfx('bell', 7, 0.5);
    bump(cell, 'flash');
    pop(cell, '★ Bonus!', 'big', 28);
    pop($('#threat'), 'Optional', 'info', 18);
    bump($('#threat'));
    await wait(STEP.spawn);
    return;
  }
  if (ev.k === 'meal') {
    const short = ev.short;
    sfx('meal', 0, 0.8);
    const chip = chipOf('bread');
    if (ev.eat) {
      S.res.bread -= ev.eat;
      renderRes(); renderHud();
      pop(chipOf('bread'), `−${ev.eat}${ico('bread', 2)}`, 'bad', 24);
      bump(chipOf('bread'));
    }
    await wait(STEP.meal * 0.6);
    if (short) {
      S.hearts = ev.hearts;
      renderTop();
      sfx('hurt', 0, 1);
      pop($('#heartsBox'), `−${short}${HEART_ON}`, 'bad', 26);
      bump($('#heartsBox'), 'shake');
      await wait(STEP.meal);
    } else {
      pop($('#meal'), 'Everyone ate!', 'info', 18);
      await wait(STEP.meal * 0.5);
    }
    return;
  }
  if (ev.k === 'recall') {
    const out = S.workers.filter(w => w.away > 0 || planOf(w.id));
    const flights = out.map(w => { const t = w.at ? (target(w.at) || S.threat) : null; return t ? fly(cellOf(t), homeCell(), vsp(w), 450) : null; });
    for (const w of S.workers) { w.away = 0; w.at = null; }
    for (const s of S.spaces) s.lockedBy = null;
    S.plans = [];
    renderBoard(); renderCrew();
    await Promise.all(flights);
    if (out.length) { riser('home', 0, 0.9); bump(homeCell(), 'flash'); }
    await wait(STEP.recall * 0.5);
    return;
  }
  if (ev.k === 'bounty') {
    const box = $('#coinsBox');
    const k = Math.min(ev.n, 8);
    for (let i = 0; i < k; i++) {
      fly(cellOf(target(ev.tid) || S.threat), box, ico('coins', 2), 420 + i * 60).then(() => {
        sfx('clink', 4 + semis(i + 3), 0.6);
        if (i === k - 1) { S.res.coins += ev.n; if (anim) renderTop(); }
        bump(box);
      });
    }
    sfx('coins', 0, 0.9);
    pop(box, `+${ev.n}${ico('coins', 2)}`, 'big', 30);
    await wait(STEP.bounty + k * 60);
    return;
  }
  if (ev.k === 'overrun') {
    sfx('hurt', -4, 1);
    bump($('#board'), 'shake');
    pop(cellOf(S.threat), 'Too late…', 'bad', 28);
    await wait(STEP.overrun);
  }
}

// ---------- input ----------
function onClick(e) {
  audioInit();
  if (anim) { anim.fast = true; return; }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act, id = el.dataset.id;
  if (act === 'mute') { sound.muted = !sound.muted; store.set('lwh-muted', sound.muted ? '1' : '0'); if (!sound.muted) sfx('select'); return renderTop(); }
  if (act === 'help') { helpOpen = true; sfx('select'); return render(); }
  if (act === 'closehelp') { helpOpen = false; sfx('select'); return render(); }
  if (act === 'newrun') { newRun(); helpOpen = false; sfx('place'); return render(); }
  if (act === 'end') { if (S.phase === 'play') playTurn(); return; }
  if (act === 'buy') {
    const r = buy(+el.dataset.i);
    if (!r.ok && r.why) toast(r.why, true);
    else if (r.ok) { sfx('coins', 0, 0.8); sfx('clink', 5, 0.5); }
    return render();
  }
  if (act === 'reroll') { if (reroll()) sfx('coins', -3, 0.7); return render(); }
  if (act === 'next') { nextSeason(); sfx('bell', 5, 0.5); return render(); }
  if (act === 'cancel') { cancelTarget(); return render(); }
  if (S.phase === 'target') {
    if (act === 'worker' || act === 'tile') {
      const r = applyTarget(id);
      if (!r.ok && r.why) toast(r.why, true);
      else if (r.ok) { sfx('clink', 7, 0.8); sfx('ding', 2, 0.4); }
      return render();
    }
    return;
  }
  if (S.phase !== 'play') return;
  if (act === 'worker') {
    const w = W(id);
    if (w.away > 0) { toast(`${w.name} is walking home: back in ${w.away} turn${w.away > 1 ? 's' : ''}.`); return; }
    if (planOf(id)) { unassign(id); sfx('select', -4, 0.7); return render(); }
    S.selected = id;
    sfx('select');
    return render();
  }
  if (act === 'tile') {
    const plansHere = S.plans.filter(p => p.tid === id);
    const tt = target(id);
    if (plansHere.length && tt && !tt.isThreat && TYPES[tt.type].waters && !plansHere[0].dry) {
      const r = toggleDry(plansHere[0].wid);
      if (r.ok) { toast('Harvest only: no watering. Tap again to cancel.'); sfx('select', 3, 0.7); }
      return render();
    }
    const sel = S.selected && W(S.selected);
    if (!sel || !isFree(sel)) {
      if (plansHere.length) { unassign(plansHere[plansHere.length - 1].wid); sfx('select', -4, 0.7); return render(); }
      toast(freeWorkers().length ? 'Pick a villager first.' : 'Everyone is busy. Press End turn.');
      return;
    }
    if (plansHere.length && !target(id).isThreat) { unassign(plansHere[0].wid); sfx('select', -4, 0.7); return render(); }
    const r = assign(sel.id, id);
    if (!r.ok && r.why) toast(r.why, true);
    else if (r.ok) sfx('place', S.plans.length * 2, 0.9);
    render();
    if (r.ok) bump(cellOf(target(id)), 'flash');
    return;
  }
}

// paint a wheat-field pattern tile from the sprite sheet for the page background
function paintField() {
  const m = getComputedStyle(document.documentElement).getPropertyValue('--sheet-F').match(/url\(["']?(.*?)["']?\)$/);
  if (!m) return;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const spots = [[0, 0, 66], [32, 6, 67], [64, 0, 66], [96, 8, 66], [16, 34, 66], [48, 40, 67], [80, 34, 66], [112, 42, 66], [0, 68, 67], [32, 72, 66], [64, 66, 66], [96, 74, 67], [16, 100, 66], [48, 104, 66], [80, 98, 67], [112, 106, 66]];
    g.globalAlpha = 0.3;
    for (const [x, y, i] of spots) for (const dx of [0, -128]) g.drawImage(img, (i % 12) * 16, ((i / 12) | 0) * 16, 16, 16, x + dx + (y > 100 && x > 100 ? 0 : 0), y, 32, 32);
    $('#wheatbg').style.backgroundImage = `url(${c.toDataURL()})`;
    $('#wheatbg').style.backgroundSize = '128px 128px';
  };
  img.src = m[1];
}

function start(data) {
  if (data && data.S && data.S.v === STATE_V && data.S.workers && data.S.threat) S = data.S;
  else newRun();
  document.addEventListener('click', onClick);
  document.addEventListener('pointerdown', audioInit, { once: true });
  $('#logo').innerHTML = sp('F68', 2);
  paintField();
  render();
}

try { window.claude?.hot?.snapshot?.(() => ({ S })); } catch (e) {}
if (window.claude?.hot?.ready) window.claude.hot.ready(start);
else start(window.claude?.hot?.data ?? {});
