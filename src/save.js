// ===== Long Way Home — autosave and session log (browser storage, no rules) =====
// The run autosaves to localStorage after every action. Alongside it we keep a session log: one entry per
// turn (the pre-turn state, including the plans, plus what happened), every shop action, notes the player
// writes, and how each run ended. The player can download it as JSON to share a scenario, and load a save
// or log file back in to restore that exact spot.
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};
const SAVE_KEY = 'lwh-save', LOG_KEY = 'lwh-log';
const LOG_RUNS = 5; // the log keeps this many runs, oldest dropped first
const clone = o => JSON.parse(JSON.stringify(o));
const validState = s => !!(s && s.v === STATE_V && s.workers && s.spaces && s.threat);

let LOG = null;     // { runs: [{ id, started, entries: [] }] }, the last run is the current one
let lastSave = 0;   // ms timestamp of the last successful autosave

// ---------- autosave ----------
function saveGame(state = S) {
  if (!state) return false;
  const ok = store.set(SAVE_KEY, JSON.stringify({ game: 'long-way-home', v: STATE_V, at: Date.now(), S: state }));
  if (ok) lastSave = Date.now();
  return ok;
}

function loadGame() {
  try {
    const d = JSON.parse(store.get(SAVE_KEY));
    if (d && validState(d.S)) { lastSave = d.at || 0; return d.S; }
  } catch (e) {}
  return null;
}

// ---------- session log ----------
function loadLog() {
  try { const d = JSON.parse(store.get(LOG_KEY)); if (d && Array.isArray(d.runs)) return d; } catch (e) {}
  return { runs: [] };
}

// keep the log in storage; if it won't fit, drop old runs, then old snapshots, rather than lose the save
function persistLog() {
  for (let guard = 0; guard < 200; guard++) {
    if (store.set(LOG_KEY, JSON.stringify(LOG))) return true;
    if (LOG.runs.length > 1) { LOG.runs.shift(); continue; }
    const withState = (LOG.runs[0]?.entries || []).filter(e => e.state);
    if (withState.length <= 3) return false;
    delete withState[0].state;
  }
  return false;
}

function addRun() {
  LOG.runs.push({ id: Date.now().toString(36), started: new Date().toISOString(), entries: [] });
  while (LOG.runs.length > LOG_RUNS) LOG.runs.shift();
}

function curRun() {
  if (!LOG.runs.length) addRun();
  return LOG.runs[LOG.runs.length - 1];
}

// how: 'new' for a fresh run, 'loaded' for a file, 'cleared' after clearing the log
function logNewRun(how = 'new') {
  addRun();
  logEntry(how === 'new' ? 'start' : how, { state: clone(S) });
}

function logEntry(k, data = {}) {
  if (!LOG) return;
  const e = { k, at: new Date().toISOString(), season: S.season, turn: S.turn, phase: S.phase, ...data };
  curRun().entries.push(e);
  persistLog();
  return e;
}

// readable names for what villagers did, so the log reads without the snapshot
const spaceName = t => !t ? '?' : t.isThreat ? (t.bonus ? 'Bonus ' : '') + THREATS[t.type].name : TYPES[t.type].name;
const fmtRes = o => Object.keys(o || {}).filter(r => o[r]).map(r => `${o[r] > 0 ? '+' : ''}${o[r]} ${r}`).join(', ');
function planLines(state) {
  return state.plans.map(p => {
    const w = state.workers.find(x => x.id === p.wid);
    const t = p.tid === 'T' ? state.threat : p.tid === 'B' ? state.bonus : state.spaces.find(s => s.id === p.tid);
    const bits = [fmtRes(p.gain), p.cost && Object.keys(p.cost).length ? 'spends ' + fmtRes(p.cost).replace(/\+/g, '') : '', p.dmg ? `${p.dmg} dmg` : '', `back in ${p.travel}`];
    return `${w ? w.name : p.wid}${w && w.mods.length ? ` [${w.mods.join('+')}]` : ''} → ${spaceName(t)} (${p.tid}, dist ${t ? t.dist : '?'}): ${bits.filter(Boolean).join('; ')}`;
  });
}

// one turn: what was planned (from the pre-turn snapshot), what happened, and the snapshot itself
function logTurn(before, report) {
  logEntry('turn', {
    season: before.season, turn: before.turn,
    hearts: before.hearts, res: { ...before.res },
    threat: { type: before.threat.type, hp: before.threat.hp, cleared: before.threat.cleared },
    plans: planLines(before),
    away: before.workers.filter(w => w.away > 0).map(w => `${w.name} away ${w.away} (carrying ${fmtRes(w.carry) || 'nothing'})`),
    result: report.log.slice(),
    state: clone(before),
  });
  if (S.phase === 'lost' || S.phase === 'won') logEntry('end', { win: S.phase === 'won', why: S.over.why, hearts: S.hearts, state: clone(S) });
}

// ---------- download / load ----------
function textSummary() {
  const out = [];
  LOG.runs.forEach((run, i) => {
    out.push(`=== Run ${i + 1} (started ${run.started}) ===`);
    for (const e of run.entries) {
      const at = `S${e.season} T${e.turn}`;
      if (e.k === 'start') out.push(`${at} New run. Threat: ${e.state.threat.type} ${e.state.threat.hp}. Board: ${e.state.spaces.map(s => `${s.type}@${s.dist}`).join(', ')}.`);
      else if (e.k === 'turn') {
        out.push(`${at} ❤${e.hearts} · ${fmtRes(e.res).replace(/\+/g, '')} · ${e.threat.type} ${e.threat.cleared ? 'stopped' : e.threat.hp}`);
        for (const l of e.plans) out.push('    ' + l);
        for (const l of e.away) out.push('    (' + l + ')');
        for (const l of e.result) out.push('    ▸ ' + l);
      }
      else if (e.k === 'buy') out.push(`${at} Bought ${e.item} for ${e.price}${e.on ? ' on ' + e.on : ''}.`);
      else if (e.k === 'reroll') out.push(`${at} Rerolled the market (${e.price}).`);
      else if (e.k === 'season') out.push(`${at} Season ${e.season} begins: ${e.state.threat.type} ${e.state.threat.hp}.`);
      else if (e.k === 'note') out.push(`${at} NOTE: ${e.text}`);
      else if (e.k === 'end') out.push(`${at} ${e.win ? 'WON' : 'LOST'}: ${e.why}`);
      else if (e.k === 'resumed') out.push(`${at} (page reloaded, run resumed)`);
      else out.push(`${at} ${e.k}${e.state ? ` (${e.state.threat.type} ${e.state.threat.hp}, ❤${e.state.hearts})` : ''}`);
    }
  });
  return out;
}

function downloadLog() {
  const data = {
    game: 'long-way-home', kind: 'log', v: STATE_V, exported: new Date().toISOString(),
    screen: `${window.innerWidth}x${window.innerHeight}`, userAgent: navigator.userAgent,
    summary: textSummary(),
    current: S,
    runs: LOG.runs,
  };
  const d = new Date(), pad = n => String(n).padStart(2, '0');
  const name = `long-way-home-log-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return name;
}

// accepts a save ({ S }), a downloaded log ({ current }), or a bare state; returns the state or an error string
function stateFromFile(text) {
  let d;
  try { d = JSON.parse(text); } catch (e) { return 'That file isn’t JSON.'; }
  const s = d && (d.current || d.S || d);
  if (!s || !s.workers || !s.threat) return 'No game state in that file.';
  if (s.v !== STATE_V) return `That file is from an older version of the game (state v${s.v}, this is v${STATE_V}).`;
  return s;
}

function logSize() {
  const turns = LOG.runs.reduce((n, r) => n + r.entries.filter(e => e.k === 'turn').length, 0);
  const notes = LOG.runs.reduce((n, r) => n + r.entries.filter(e => e.k === 'note').length, 0);
  const kb = Math.round((store.get(LOG_KEY) || '').length / 1024);
  return { runs: LOG.runs.length, turns, notes, kb };
}

function clearLog() {
  LOG = { runs: [] };
  logNewRun('cleared');
}

LOG = loadLog();
