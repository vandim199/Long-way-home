// ===== Long Way Home — UI =====
const $ = s => document.querySelector(s);
let pendingFx = [];
let toastTimer = null;
const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

function dot(w, extra = '') {
  return `<span class="dot ${extra}" style="--wc:${w.color}">${esc(w.name[0])}</span>`;
}

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
  $('#hearts').textContent = S.hearts;
  $('#coins').textContent = S.res.coins;
  $('#heartsBox').classList.toggle('low', S.hearts <= 2);
}

function renderHud() {
  const t = S.threat, T = THREATS[t.type];
  const dmg = plannedDmg();
  const after = Math.max(0, t.hp - dmg);
  const left = CFG.turns - S.turn;
  const pct = Math.min(100, Math.round((t.hp / Math.max(t.max, t.hp)) * 100));
  const afterPct = Math.min(100, Math.round((after / Math.max(t.max, t.hp)) * 100));
  $('#threat').className = 'card threat ' + t.type;
  $('#threat').innerHTML = `
    <div class="card-head"><span class="big-ico">${T.icon}</span><span class="card-title">${T.name}</span>
      <span class="hp">${dmg ? `<s>${t.hp}</s> ${after}` : t.hp}</span></div>
    <div class="bar"><i style="width:${pct}%"></i><b style="width:${afterPct}%"></b></div>
    <div class="card-line">Needs ${ICON[T.res]}${T.per > 1 ? ` (each deals ${T.per})` : ''} · grows +${t.growth} on turns you don't fight it</div>
    <div class="card-line strong">${left === 0 ? 'Last turn to stop it!' : `Stop it by the end of turn ${CFG.turns} · ${left + 1} turns left`}</div>`;

  const need = totalAppetite();
  const have = S.res.bread, inc = incoming('bread'), out = S.plans.reduce((a, p) => a + (p.cost.bread || 0), 0);
  const proj = have + inc - out;
  const when = S.turn < CFG.mealTurn ? `after turn ${CFG.mealTurn}` : S.turn === CFG.mealTurn ? 'after this turn' : 'at season end';
  const short = proj < need;
  $('#meal').className = 'card meal' + (short ? ' short' : '');
  $('#meal').innerHTML = `
    <div class="card-head"><span class="big-ico">🍽️</span><span class="card-title">Meal</span><span class="hp">${need}🍞</span></div>
    <div class="card-line strong">${when}</div>
    <div class="card-line">${short ? `Short by ${need - proj}. Each missing 🍞 costs 1 ❤.` : `Covered: ${proj}🍞 after this turn.`}</div>`;
}

function renderRes() {
  $('#res').innerHTML = RES.map(r => {
    const inc = incoming(r), out = S.res[r] - avail(r);
    return `<div class="chip"><span class="ri">${ICON[r]}</span><span class="rv">${S.res[r]}</span>${out ? `<span class="rout">−${out}</span>` : ''}${inc ? `<span class="rin">+${inc}</span>` : ''}</div>`;
  }).join('');
}

function tileHTML(x, y) {
  if (x === 2 && y === 2) {
    const home = S.workers.filter(w => w.away === 0);
    return `<div class="tile home" aria-label="Home"><span class="tname">Home</span><span class="home-ico">🏠</span><span class="home-dots">${home.map(w => dot(w, planOf(w.id) ? 'ghost' : '')).join('')}</span></div>`;
  }
  const sp = S.spaces.find(s => s.x === x && s.y === y);
  const isT = S.threat && S.threat.x === x && S.threat.y === y;
  if (!sp && !isT) return `<div class="tile empty" aria-hidden="true"></div>`;
  const t = isT ? S.threat : sp;
  const sel = S.selected && W(S.selected);
  const plans = S.plans.filter(p => p.tid === t.id);
  const targetable = S.phase === 'target' && validTarget(S.pending.id, t);
  let cls = 'tile', body = '';
  const travel = travelOf(t, sel || null);
  if (isT) {
    const T = THREATS[t.type];
    cls += ' foe ' + t.type;
    const comingBack = S.workers.filter(w => w.at === 'T' && w.away > 0);
    body = `<span class="tname">${T.name}</span><span class="tbig">${T.icon}<b>${t.hp}</b></span>
      <span class="tfoot"><span class="travel">👣${travel}</span>${comingBack.map(w => dot(w, 'mini')).join('')}</span>`;
  } else {
    const ty = TYPES[sp.type];
    cls += ' ' + ty.kind;
    let mid;
    if (ty.kind === 'gather') mid = `<b>${gatherAmt(sp, sel || null)}</b><i>${ICON[ty.res]}</i>`;
    else mid = `<i>${ICON[ty.from]}</i><em>→</em><i>${ICON[ty.to]}</i>${ratio(sp) > 1 ? `<small>×${ratio(sp)}</small>` : ''}`;
    const extras = (sp.fert ? '🌱' : '') + (sp.road ? '🛤️' : '') + (sp.tools ? '⚒️' : '');
    body = `<span class="tname">${ty.name}</span><span class="tbig">${mid}</span>
      <span class="tfoot"><span class="travel">👣${travel}</span><span class="ext">${extras}</span></span>`;
    if (sp.lockedBy) {
      const w = W(sp.lockedBy);
      cls += ' locked';
      body += `<span class="lock">${dot(w)}<span>back in ${w.away}</span></span>`;
    }
  }
  if (plans.length) {
    cls += ' planned';
    const w = W(plans[0].wid);
    body += `<span class="plan" style="--wc:${w.color}">${plans.map(p => dot(W(p.wid))).join('')}<span class="pv">${esc(plans.map(p => fmtGain(p)).join(' '))}</span></span>`;
  }
  if (targetable) cls += ' targetable';
  return `<button class="${cls}" data-act="tile" data-id="${t.id}" style="${plans.length ? `--wc:${W(plans[0].wid).color}` : ''}">${body}</button>`;
}

function renderBoard() {
  let h = '';
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) h += `<div class="cell" data-x="${x}" data-y="${y}">${tileHTML(x, y)}</div>`;
  $('#board').innerHTML = h;
  if (pendingFx.length && !reduceMotion()) {
    for (const f of pendingFx) {
      const t = target(f.tid) || (f.tid === 'T' && S.threat);
      if (!t) continue;
      const cell = $(`#board .cell[data-x="${t.x}"][data-y="${t.y}"]`);
      if (!cell) continue;
      const s = document.createElement('span');
      s.className = 'float';
      s.textContent = f.text;
      cell.appendChild(s);
    }
  }
  pendingFx = [];
  const banner = $('#banner');
  if (S.phase === 'target') {
    const d = offerDef(S.pending.id);
    banner.hidden = false;
    banner.innerHTML = `<span>${d.icon} <b>${esc(d.name)}</b> (${upgradePrice(S.pending.id)}🪙): tap ${d.target === 'worker' ? 'a villager' : 'a highlighted space'}</span><button data-act="cancel">Cancel</button>`;
  } else banner.hidden = true;
}

function renderCrew() {
  $('#crew').innerHTML = S.workers.map(w => {
    const p = planOf(w.id);
    let st, cls = 'worker';
    if (w.away > 0) { st = `Back in ${w.away}`; cls += ' away'; }
    else if (p) { const t = target(p.tid); st = `→ ${t.isThreat ? THREATS[t.type].name : TYPES[t.type].name}`; cls += ' planned'; }
    else st = 'Home';
    if (S.selected === w.id && S.phase === 'play') cls += ' sel';
    if (S.phase === 'target' && validTarget(S.pending.id, w)) cls += ' targetable';
    const mods = w.mods.map(m => `<span title="${MODS[m].name}">${MODS[m].icon}</span>`).join('');
    return `<button class="${cls}" data-act="worker" data-id="${w.id}" style="--wc:${w.color}">
      ${dot(w)}<span class="wtext"><span class="wname">${esc(w.name)}</span><span class="wstat">${st}</span></span>
      <span class="wside"><span class="mods">${mods}</span><span class="eat">eats ${appetite(w)}🍞</span></span></button>`;
  }).join('');
}

function renderFoot() {
  const free = freeWorkers().length, planned = S.plans.length;
  const btn = $('#endTurn');
  btn.disabled = S.phase !== 'play';
  btn.innerHTML = planned ? `End turn <small>${planned} sent${free ? `, ${free} still home` : ''}</small>` : free ? `End turn <small>nobody sent</small>` : `Wait <small>everyone is away</small>`;
  $('#log').innerHTML = (S.log || []).map(l => `<li>${esc(l)}</li>`).join('');
}

function offerCard(o, i) {
  const d = offerDef(o.id);
  const price = upgradePrice(o.id);
  const afford = S.res.coins >= price;
  return `<div class="offer ${o.sold ? 'sold' : ''}">
    <span class="oi">${d.icon}</span>
    <span class="ot"><b>${esc(d.name)}</b><span>${esc(d.text)}</span>${d.mod ? '<em>Stacks. Each modifier past the first adds +1 🍞 to that villager’s meals.</em>' : ''}</span>
    <button data-act="buy" data-i="${i}" ${o.sold || !afford ? 'disabled' : ''}>${o.sold ? 'Bought' : `${price}🪙`}</button></div>`;
}

function renderOverlay() {
  const ov = $('#overlay');
  if (S.phase === 'shop') {
    const nextT = THREATS[S.nextThreat];
    ov.hidden = false;
    ov.innerHTML = `<div class="sheet">
      <p class="eyebrow">Season ${S.season} cleared</p>
      <h2>Market</h2>
      <ul class="sum">${S.shop.summary.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
      <div class="purse">You have <b>${S.res.coins}🪙</b> · ❤ ${S.hearts}</div>
      <div class="offers">${S.shop.offers.map(offerCard).join('')}</div>
      <div class="sheet-actions">
        <button class="ghost" data-act="reroll" ${S.res.coins < S.shop.reroll ? 'disabled' : ''}>New offers · ${S.shop.reroll}🪙</button>
        <button class="go" data-act="next">Start season ${S.season + 1}</button>
      </div>
      <p class="next">Next up: ${nextT.icon} ${nextT.name}, strength ${CFG.threatHp(S.season + 1)}, grows +${CFG.threatGrowth(S.season + 1)}.</p>
    </div>`;
  } else if (S.phase === 'lost' || S.phase === 'won') {
    ov.hidden = false;
    ov.innerHTML = `<div class="sheet end ${S.over.win ? 'win' : 'loss'}">
      <p class="eyebrow">${S.over.win ? 'Victory' : 'Run over'}</p>
      <h2>${esc(S.over.why)}</h2>
      <p>Reached season ${S.season}, turn ${S.turn}, with ${S.workers.length} villagers.</p>
      <ul class="sum">${(S.log || []).map(l => `<li>${esc(l)}</li>`).join('')}</ul>
      <div class="sheet-actions"><button class="go" data-act="newrun">New run</button></div></div>`;
  } else if (helpOpen) {
    ov.hidden = false;
    ov.innerHTML = `<div class="sheet help">
      <h2>How to play</h2>
      <ul class="rules">
        <li><b>Send villagers.</b> Tap a villager, then a space. Send as many as you like, then press <b>End turn</b>. Everything pays out at the end of the turn.</li>
        <li><b>The long way home.</b> 👣 is how many turns the villager stays away. Until they're back, you can't use that villager <i>or</i> that space.</li>
        <li><b>Piles grow.</b> A gathering space grows +1 every turn nobody is using it. Far spaces start bigger.</li>
        <li><b>Converting needs stock.</b> The Bakery and Fletcher only use what's already in your store, not what's arriving this turn.</li>
        <li><b>Meals.</b> After turn ${CFG.mealTurn} and at season end, each villager eats 🍞. Each missing bread costs 1 ❤. At 0 ❤ the run ends.</li>
        <li><b>The threat.</b> Fight it by sending villagers with 💧 (fire) or 🏹 (monsters, 2 damage each). Each carries ${CFG.carry}. Any number can go at once. It grows on turns you don't fight it. Stop it by turn ${CFG.turns} or the run ends.</li>
        <li><b>Market.</b> Stopping it early pays more 🪙. Spend coins between seasons on villagers, modifiers and space upgrades.</li>
      </ul>
      <div class="sheet-actions"><button class="go" data-act="closehelp">Got it</button></div></div>`;
  } else {
    ov.hidden = true;
    ov.innerHTML = '';
  }
}

let helpOpen = false;

function onClick(e) {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act, id = el.dataset.id;
  if (act === 'help') { helpOpen = true; return render(); }
  if (act === 'closehelp') { helpOpen = false; return render(); }
  if (act === 'newrun') { newRun(); helpOpen = false; return render(); }
  if (act === 'end') {
    const r = endTurn();
    if (r) pendingFx = r.fx;
    return render();
  }
  if (act === 'buy') { const r = buy(+el.dataset.i); if (!r.ok && r.why) toast(r.why); return render(); }
  if (act === 'reroll') { reroll(); return render(); }
  if (act === 'next') { nextSeason(); return render(); }
  if (act === 'cancel') { cancelTarget(); return render(); }
  if (S.phase === 'target') {
    if (act === 'worker' || act === 'tile') { const r = applyTarget(id); if (!r.ok && r.why) toast(r.why); return render(); }
    return;
  }
  if (S.phase !== 'play') return;
  if (act === 'worker') {
    const w = W(id);
    if (w.away > 0) { toast(`${w.name} is walking home: back in ${w.away} turn${w.away > 1 ? 's' : ''}.`); return; }
    if (planOf(id)) { unassign(id); return render(); }
    S.selected = id;
    return render();
  }
  if (act === 'tile') {
    const plansHere = S.plans.filter(p => p.tid === id);
    const sel = S.selected && W(S.selected);
    if (!sel || !isFree(sel)) {
      if (plansHere.length) { unassign(plansHere[plansHere.length - 1].wid); return render(); }
      toast(freeWorkers().length ? 'Pick a villager first.' : 'Everyone is busy. Press End turn.');
      return;
    }
    if (plansHere.length && id !== 'T') { unassign(plansHere[0].wid); return render(); }
    const r = assign(sel.id, id);
    if (!r.ok && r.why) toast(r.why);
    return render();
  }
}

function start(data) {
  if (data && data.S && data.S.workers && data.S.threat) S = data.S;
  else newRun();
  document.addEventListener('click', onClick);
  render();
}

try { window.claude?.hot?.snapshot?.(() => ({ S })); } catch (e) {}
if (window.claude?.hot?.ready) window.claude.hot.ready(start);
else start(window.claude?.hot?.data ?? {});
