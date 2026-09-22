/**
 * GRANDSTAND — boot, screens, input, loop.
 *
 * The canvas shows the world. Everything you read or press is real DOM below
 * it, which is what makes this playable on a phone in a pub without squinting.
 */

import { setupCanvas, drawMap, drawBattleScene, drawTitleScene, drawTitleWordmark,
         drawMinimap, VIEW_W, VIEW_H } from './engine/render.js';
import { drawPortrait } from './engine/sprites.js';
import { initAudio, sfx, setMuted, isMuted } from './engine/audio.js';
import { Battle, PHASE, ANSWER_MS } from './game/battle.js';
import { PvpMatch, PVP_PHASE } from './game/pvp.js';
import { Run, loadSave, recordRun, recordBeaten, savePrefs, makeSeedFrom, seedName,
         START_ENERGY, BATTLE_TURN_COST } from './game/state.js';
import { TILE } from './game/map.js';
import { SPORTS, availableSports, countBySport, QUESTIONS } from './data/questions.js';
import { ROSTER, PLAYER_KITS, findFighter } from './data/roster.js';

const $ = (id) => document.getElementById(id);
const panel = $('panel');
const stage = $('stage');
const { ctx, resize } = setupCanvas($('game'));

const G = {
  screen: 'title',
  run: null,
  battle: null,
  match: null,
  enc: null,
  t: 0,
  cam: { x: 0, y: 0 },
  scene: { player: null, foe: null, floaters: [], shake: 0, playerFlash: 0, foeFlash: 0,
           playerWind: 0, foeWind: 0, playerDown: false, foeDown: false, venue: 'THE REC' },
  setup: { mode: 'career', sports: [], kit: 0, name: 'YOU', name2: 'THEM', seed: '' },
  timer: { running: false, start: 0 },
  venueFlash: null,
  lastVenue: null,
  visited: new Set(),
  busy: false,
};

const save = loadSave();
G.setup.sports = save.lastSports || [];
G.setup.kit = save.lastKit || 0;
G.setup.name = save.lastName || 'YOU';
setMuted(!!save.muted);

// ── tiny helpers ───────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (a, b) => `${Math.max(0, Math.min(100, (a / b) * 100))}%`;

function toast(msg, ms = 1600) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

function shakeStage(power = 1) {
  G.scene.shake = power;
  stage.classList.remove('shake');
  void stage.offsetWidth;
  stage.classList.add('shake');
  setTimeout(() => { G.scene.shake = 0; }, 220);
}

function floater(text, x, y, colour, big = false) {
  G.scene.floaters.push({ text, x, y, vy: -0.7, life: 44, colour, big });
}

function setHud(on) { $('hud').classList.toggle('on', on); }

function updateHud() {
  const r = G.run;
  if (!r) return;
  $('energy-num').textContent = Math.round(r.energy);
  $('cond-num').textContent = Math.round(r.player.hp);
  $('energy-fill').style.width = pct(r.energy, r.maxEnergy);
  const cf = $('cond-fill');
  cf.style.width = pct(r.player.hp, r.player.maxHp);
  cf.classList.toggle('low', r.player.hp / r.player.maxHp < 0.3);
  $('rep-chip').textContent = `REP ${r.rep}`;
}

function show(html) {
  panel.innerHTML = html;
  panel.scrollTop = 0;
}

// ── sizing: the canvas takes a fixed 16:9 slice of the viewport ───────────
function layout() {
  const app = document.getElementById('app');
  const hudH = $('hud').classList.contains('on') ? $('hud').offsetHeight : 0;
  // Give the stage a provisional budget, let resize() pick the integer scale
  // that fits, then shrink the stage to exactly that — so there are never
  // letterbox bars above and below the picture.
  const budget = Math.min((app.clientHeight - hudH) * 0.54, app.clientWidth * 0.62);
  stage.style.height = `${Math.max(120, Math.round(budget))}px`;
  resize();
  const drawnH = $('game').getBoundingClientRect().height;
  if (drawnH > 0) stage.style.height = `${Math.round(drawnH)}px`;
}
window.addEventListener('resize', layout);

// ═══════════════════════════════════════════════════════════════════════════
// SCREENS
// ═══════════════════════════════════════════════════════════════════════════

function screenTitle() {
  G.screen = 'title';
  setHud(false);
  const best = save.bestRep ? `BEST DAY: ${save.bestRep} REP` : 'NO RESULT RECORDED';
  show(`
    <div class="screen on">
      <h1>GRANDSTAND</h1>
      <p class="dim small">A turn-based sports-quiz RPG. Every answer is a whole
      number, and the number is how hard you hit.</p>
      <div class="btn-row">
        <button class="primary" data-act="go-setup" data-mode="career">START A DAY OUT</button>
      </div>
      <div class="btn-row">
        <button data-act="go-setup" data-mode="pvp">HOT-SEAT PvP</button>
        <button data-act="league">LEAGUE TABLE</button>
      </div>
      <div class="btn-row">
        <button data-act="codex">THE ROSTER</button>
        <button data-act="howto">HOW TO PLAY</button>
      </div>
      <p class="dim small">${esc(best)} · ${QUESTIONS.length} questions · ${ROSTER.length} opponents</p>
    </div>`);
  layout();
}

function screenHowTo() {
  G.screen = 'howto';
  show(`
    <div class="screen on">
      <h2>HOW TO PLAY</h2>
      <div class="card">
        <h3>THE IDEA</h3>
        <p class="small">You walk round a municipal sports complex. People who were
        on the telly in 1987 want a word. You settle it with a quiz.</p>
      </div>
      <div class="card gold">
        <h3>YOUR GO — <span style="color:var(--gold)">STRIKE</span></h3>
        <p class="small">You're asked who has the <b>MOST</b> of something.
        Pick the biggest number and you hit hardest. Pick a smaller one and you
        still connect — just softer. The number <i>is</i> the damage.</p>
      </div>
      <div class="card" style="border-color:var(--blue)">
        <h3>THEIR GO — <span style="color:var(--blue)">BLOCK</span></h3>
        <p class="small">Now you're asked who has the <b>FEWEST</b>. Pick the
        smallest number to take the sting out of what's coming. Getting the two
        the wrong way round is how everybody loses.</p>
      </div>
      <div class="card">
        <h3>THE CLOCK, COMBOS, CARDS</h3>
        <p class="small">12 seconds. Answering fast adds up to +50%. Perfect
        answers in a row build a combo up to ×2. Pick the <i>worst</i> option
        and you're booked — two yellows and you sit an exchange out.</p>
      </div>
      <div class="card">
        <h3>NUTMEG</h3>
        <p class="small">Three per day. Burns one duff option off the board and
        leaves you a 50:50. Save them for the big names.</p>
      </div>
      <div class="card">
        <h3>ENERGY</h3>
        <p class="small">Every step costs energy. So does every exchange. When
        it's gone, the day's over and you get your score. Oranges, Lucozade and
        pies are lying about — pick them up.</p>
      </div>
      <div class="card">
        <h3>KEYS</h3>
        <p class="small"><span class="kbd">ARROWS</span> or <span class="kbd">WASD</span> move ·
        <span class="kbd">1</span><span class="kbd">2</span><span class="kbd">3</span> answer ·
        <span class="kbd">N</span> nutmeg · <span class="kbd">ENTER</span> continue ·
        <span class="kbd">M</span> mute</p>
      </div>
      <div class="btn-row"><button data-act="title">BACK</button></div>
    </div>`);
}

function screenSetup(mode) {
  G.screen = 'setup';
  G.setup.mode = mode;
  setHud(false);
  const sportsList = availableSports();
  const counts = countBySport();
  const chips = sportsList.map((s) => {
    const on = G.setup.sports.includes(s);
    return `<button class="small-btn ${on ? 'on' : ''}" data-act="toggle-sport" data-sport="${s}">
      ${esc(SPORTS[s].name)} <span class="dim">${counts[s]}</span></button>`;
  }).join('');

  const kits = PLAYER_KITS.map((k, i) =>
    `<button class="small-btn ${G.setup.kit === i ? 'on' : ''}" data-act="kit" data-i="${i}">${esc(k.name)}</button>`
  ).join('');

  const pool = G.setup.sports.length
    ? QUESTIONS.filter((q) => G.setup.sports.includes(q.sport)).length
    : QUESTIONS.length;

  show(`
    <div class="screen on">
      <h2>${mode === 'pvp' ? 'HOT-SEAT PvP' : 'A DAY OUT'}</h2>

      <div class="card">
        <h3>SPORTS — PICK SOME, OR LEAVE IT EMPTY FOR THE LOT</h3>
        <div class="chip-row">${chips}</div>
        <p class="small dim">${G.setup.sports.length ? `${G.setup.sports.length} selected` : 'ALL SPORTS'}
          · ${pool} questions in play</p>
        ${pool < 12 ? '<div class="warn-strip">Thin pool — questions will repeat. Add another sport.</div>' : ''}
      </div>

      ${mode === 'pvp' ? `
        <div class="card">
          <h3>PLAYERS</h3>
          <label class="small dim">PLAYER ONE</label>
          <input id="p1name" value="${esc(G.setup.name)}" maxlength="10"
            style="font-family:var(--head);font-size:11px;padding:9px;background:#0d0b14;color:var(--ink);border:3px solid var(--line)">
          <label class="small dim">PLAYER TWO</label>
          <input id="p2name" value="${esc(G.setup.name2)}" maxlength="10"
            style="font-family:var(--head);font-size:11px;padding:9px;background:#0d0b14;color:var(--ink);border:3px solid var(--line)">
          <p class="small dim">One device. You take it in turns and pass it over.
          There's a screen in between so nobody reads over a shoulder.</p>
        </div>
      ` : `
        <div class="card">
          <h3>YOUR KIT</h3>
          <div class="chip-row">${kits}</div>
        </div>
        <div class="card">
          <h3>SEED — LEAVE BLANK FOR A RANDOM COMPLEX</h3>
          <input id="seedin" value="${esc(G.setup.seed)}" maxlength="16" placeholder="e.g. SHEARER"
            style="font-family:var(--head);font-size:11px;padding:9px;background:#0d0b14;color:var(--ink);border:3px solid var(--line)">
          <p class="small dim">Same seed, same map and same opponents. Type one in to
          give someone else the exact day you had.</p>
        </div>
      `}

      <div class="btn-row">
        <button class="primary" data-act="${mode === 'pvp' ? 'start-pvp' : 'start-run'}">
          ${mode === 'pvp' ? 'THROW IN' : 'KICK OFF'}</button>
        <button data-act="title">BACK</button>
      </div>
    </div>`);
}

// ── overworld ──────────────────────────────────────────────────────────────
function screenMap() {
  G.screen = 'map';
  setHud(true);
  const r = G.run;
  const room = r.map.roomAt(r.player.x, r.player.y);
  const left = r.map.remaining();
  show(`
    <div class="screen on">
      <div id="pad-wrap">
        <div id="dpad">
          <div class="spacer"></div>
          <button data-act="move" data-dx="0" data-dy="-1">▲</button>
          <div class="spacer"></div>
          <button data-act="move" data-dx="-1" data-dy="0">◀</button>
          <button disabled style="opacity:.3">·</button>
          <button data-act="move" data-dx="1" data-dy="0">▶</button>
          <div class="spacer"></div>
          <button data-act="move" data-dx="0" data-dy="1">▼</button>
          <div class="spacer"></div>
        </div>
        <canvas id="minimap" width="${r.map.w * 3}" height="${r.map.h * 3}"></canvas>
      </div>
      <div id="map-info">
        <h2 style="font-size:10px">${esc(room ? room.name : 'THE CAR PARK')}</h2>
        <p class="small dim">${left} still standing · ${r.player.nutmegs}
          nutmeg${r.player.nutmegs === 1 ? '' : 's'} left</p>
        <p class="small dim">Walk into someone to have a go. Every step costs energy.
          <span style="color:var(--red)">Red</span> is an opponent,
          <span style="color:var(--gold)">gold</span> is the main arena,
          <span style="color:var(--green)">green</span> is something worth picking up.</p>
        <div class="btn-row">
          <button class="small-btn" data-act="codex">ROSTER</button>
          <button class="small-btn" data-act="end-day">END THE DAY</button>
        </div>
      </div>
    </div>`);
  paintMinimap();
  layout();
  updateHud();
}

function paintMinimap() {
  const c = $('minimap');
  if (!c || !G.run) return;
  const cc = c.getContext('2d');
  cc.imageSmoothingEnabled = false;
  drawMinimap(cc, G.run.map, G.run.player, G.visited, 3);
}

// ── battle ─────────────────────────────────────────────────────────────────
function fighterBars() {
  const b = G.battle;
  const p = G.run.player;
  const foeHurt = b.foe.hp / b.foe.maxHp < 0.35;
  return `
    <div class="fighter-bar">
      <div class="row">
        <span class="nm" style="color:var(--red)">${esc(b.foe.name)}</span>
        <span class="hpnum">${b.foe.hp}/${b.foe.maxHp}</span>
      </div>
      <div class="hp-track"><div class="hp-fill foe" id="foe-hp" style="width:${pct(b.foe.hp, b.foe.maxHp)}"></div></div>
      <span class="epithet">${esc(b.foe.epithet)}</span>
    </div>
    <div class="fighter-bar">
      <div class="row">
        <span class="nm" style="color:var(--green)">${esc(p.name)}</span>
        <span class="hpnum">${p.hp}/${p.maxHp}${b.combo > 1 ? ` · COMBO ×${b.comboMult()}` : ''}</span>
      </div>
      <div class="hp-track"><div class="hp-fill ${p.hp / p.maxHp < 0.35 ? 'hurt' : ''}" id="my-hp"
        style="width:${pct(p.hp, p.maxHp)}"></div></div>
    </div>`;
}

function screenBattleIntro() {
  G.screen = 'battle';
  const b = G.battle;
  show(`
    <div class="screen on">
      ${fighterBars()}
      <div class="card red">
        <h3>${esc(b.foe.venueName || G.scene.venue)}</h3>
        <p>"${esc(b.foe.taunt)}"</p>
      </div>
      <div class="btn-row">
        <button class="primary" data-act="fight">HAVE A GO</button>
        <button data-act="leg-it">LEG IT (-10 ENERGY)</button>
      </div>
    </div>`);
  layout();
}

function screenQuestion() {
  G.screen = 'battle';
  const b = G.battle;
  const isBlock = b.phase === PHASE.BLOCK;
  const q = b.question;
  const prompt = isBlock ? q.least : q.most;

  const opts = q.options.map((o, i) => `
    <button class="opt ${b.eliminated.includes(i) ? 'gone' : ''}" data-act="answer" data-i="${i}">
      <span class="num">${i + 1}</span>
      <span class="label">${esc(o.label)}</span>
      <span class="val">${o.value}</span>
    </button>`).join('');

  show(`
    <div class="screen on">
      ${fighterBars()}
      <div class="q-mode">
        <span class="${isBlock ? 'block' : 'strike'}">${isBlock ? '▼ BLOCK — THEY\'RE COMING' : '▲ STRIKE — YOUR GO'}</span>
        <span class="dim">${esc(SPORTS[q.sport]?.name || q.sport)}</span>
      </div>
      <div id="timer-track"><div id="timer-fill"></div></div>
      <div class="q-prompt ${isBlock ? 'block' : ''}">${esc(prompt)}</div>
      <div class="q-hint ${isBlock ? 'block' : ''}">
        ${isBlock ? 'PICK THE SMALLEST NUMBER TO BLOCK' : 'PICK THE BIGGEST NUMBER TO HIT HARDEST'}</div>
      ${opts}
      <div class="btn-row">
        <button class="small-btn" data-act="nutmeg"
          ${G.run.player.nutmegs <= 0 || b.eliminated.length ? 'disabled' : ''}>
          NUTMEG (${G.run.player.nutmegs})</button>
      </div>
    </div>`);
  layout();
  startTimer();
}

function screenResolve() {
  const b = G.battle;
  const r = b.lastResult;
  stopTimer();

  let head, cls;
  if (r.sentOff) { head = 'SENT OFF — YOU WATCH THAT ONE GO PAST'; cls = 'bad'; }
  else if (r.timedOut) { head = 'TOO SLOW — THE WHISTLE WENT'; cls = 'bad'; }
  else if (r.phase === PHASE.STRIKE) {
    head = r.perfect ? 'SCREAMER!' : r.worst ? 'SCUFFED IT' : 'GOOD CONTACT';
    cls = r.perfect ? 'good' : r.worst ? 'bad' : 'mid';
  } else {
    head = r.perfect ? 'BLOCKED IT WELL' : r.worst ? 'CAUGHT FLUSH' : 'TOOK SOME OF IT';
    cls = r.perfect ? 'good' : r.worst ? 'bad' : 'mid';
  }

  const q = b.question;
  const detail = r.sentOff ? `<p>You take <b style="color:var(--red)">${r.taken}</b>.</p>` :
    r.phase === PHASE.STRIKE
      ? `<p><b>${esc(r.option.label)}</b> — ${r.option.value} ${esc(r.unit)}
         → <b style="color:var(--gold)">${r.damage} DAMAGE</b>
         ${r.speed > 0.25 ? '<span class="dim">(quick off the mark)</span>' : ''}</p>`
      : `<p><b>${esc(r.option.label)}</b> — ${r.option.value} ${esc(r.unit)}
         → you take <b style="color:var(--red)">${r.taken}</b>
         ${r.blocked > 0 ? `<span class="dim">(${r.blocked} blocked)</span>` : ''}</p>`;

  const cardLine = r.card === 'red'
    ? '<div class="warn-strip" style="background:var(--red);color:#fff">RED CARD. You sit the next one out.</div>'
    : r.card === 'yellow'
      ? '<div class="warn-strip">BOOKED. One more and you\'re off.</div>' : '';

  show(`
    <div class="screen on">
      ${fighterBars()}
      <div class="feedback ${cls}">${esc(head)}</div>
      ${detail}
      ${!r.sentOff ? `<p class="small dim">Best answer was <b style="color:var(--green)">${r.correctValue} ${esc(r.unit)}</b>.</p>` : ''}
      ${cardLine}
      ${q && q.note && !r.sentOff ? `<div class="note">${esc(q.note)}</div>` : ''}
      <div class="btn-row"><button class="primary" data-act="advance">CARRY ON</button></div>
    </div>`);
  layout();
}

function screenBattleEnd(won) {
  stopTimer();
  const b = G.battle;
  const s = b.summary();
  const vrep = won ? b.victoryRep() : 0;
  G.run.finishBattle(G.enc, b, won);
  if (won) sfx.win(); else sfx.lose();

  G.scene.foeDown = won;
  G.scene.playerDown = !won;

  const runOver = G.run.over;

  show(`
    <div class="screen on">
      <h2 style="color:${won ? 'var(--green)' : 'var(--red)'}">
        ${won ? 'HAVE THAT' : 'STRETCHERED OFF'}</h2>
      <p>"${esc(won ? b.foe.defeat : b.foe.taunt)}"</p>
      <div class="stat-grid">
        <div class="stat"><span class="k">ANSWERED</span><span class="v">${s.answered}</span></div>
        <div class="stat"><span class="k">PERFECT</span><span class="v">${s.perfects}</span></div>
        <div class="stat"><span class="k">ACCURACY</span><span class="v">${Math.round(s.accuracy * 100)}%</span></div>
        <div class="stat"><span class="k">BEST COMBO</span><span class="v">×${s.bestCombo}</span></div>
        <div class="stat"><span class="k">REP</span><span class="v">${s.rep + vrep}</span></div>
        ${s.cards ? `<div class="stat"><span class="k">CARDS</span><span class="v" style="color:var(--red)">${s.cards}</span></div>` : ''}
      </div>
      ${!won ? '<p class="small dim">You lose 20 energy and pick yourself up on 30% condition.</p>' : ''}
      <div class="btn-row">
        <button class="primary" data-act="${runOver ? 'results' : 'back-to-map'}">
          ${runOver ? 'SEE THE SCORE' : 'BACK OUT THERE'}</button>
      </div>
    </div>`);
  layout();
  updateHud();
}

// ── results ────────────────────────────────────────────────────────────────
function screenResults() {
  G.screen = 'results';
  setHud(false);
  const r = G.run;
  if (!r.over) r.end('energy');
  const card = r.scoreCard();
  recordBeaten(r.defeatedIds);
  const s = recordRun(card);
  Object.assign(save, s);

  const place = s.league.findIndex((x) => x.date === card.date) + 1;
  const headline = r.outcome === 'champion' ? 'CHAMPION OF THE COMPLEX'
    : r.outcome === 'ko' ? 'THAT\'S YOUR LOT'
    : 'FULL TIME';

  show(`
    <div class="screen on">
      <h1 style="font-size:15px">${headline}</h1>
      <div class="stat-grid">
        <div class="stat"><span class="k">REP</span><span class="v">${card.rep}</span></div>
        <div class="stat"><span class="k">WON</span><span class="v">${card.wins}</span></div>
        <div class="stat"><span class="k">LOST</span><span class="v">${card.losses}</span></div>
        <div class="stat"><span class="k">ACCURACY</span><span class="v">${Math.round(card.accuracy * 100)}%</span></div>
        <div class="stat"><span class="k">BEST COMBO</span><span class="v">×${card.bestCombo}</span></div>
        <div class="stat"><span class="k">ANSWERED</span><span class="v">${card.answered}</span></div>
      </div>
      <div class="card ${place === 1 ? 'gold' : ''}">
        <p class="small">${place === 1 ? 'TOP OF THE LEAGUE.' : `You come in at number ${place || '—'} in the league table.`}</p>
        <p class="small dim">Complex: <b style="color:var(--gold)">${esc(seedName(card.seed))}</b>
          — give that to someone else and they get the exact same day out.</p>
      </div>
      <div class="btn-row">
        <button class="primary" data-act="go-setup" data-mode="career">GO AGAIN</button>
        <button data-act="league">LEAGUE TABLE</button>
      </div>
      <div class="btn-row"><button data-act="title">BACK TO THE TITLES</button></div>
    </div>`);
  layout();
}

function screenLeague() {
  G.screen = 'league';
  setHud(false);
  const s = loadSave();
  const rows = s.league.length ? s.league.map((c, i) => `
    <tr>
      <td class="n">${i + 1}</td>
      <td>${esc(c.name)}<br><span class="dim small">${esc(seedName(c.seed))}</span></td>
      <td class="n">${c.rep}</td>
      <td>${c.wins}-${c.losses}<br><span class="dim small">${Math.round(c.accuracy * 100)}%</span></td>
    </tr>`).join('')
    : '<tr><td colspan="4" class="dim">Nothing on the board yet.</td></tr>';

  show(`
    <div class="screen on">
      <h2>LEAGUE TABLE</h2>
      <table>
        <thead><tr><th>#</th><th>NAME / COMPLEX</th><th>REP</th><th>W-L</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="small dim">${s.totalRuns} day${s.totalRuns === 1 ? '' : 's'} out ·
        ${s.beaten.length}/${ROSTER.length} of the roster beaten.
        Saved on this device only.</p>
      <div class="btn-row">
        <button data-act="title">BACK</button>
        ${s.league.length ? '<button data-act="wipe">WIPE THE RECORD</button>' : ''}
      </div>
    </div>`);
}

function screenCodex() {
  G.screen = 'codex';
  const s = loadSave();
  const cards = ROSTER.map((f) => {
    const beaten = s.beaten.includes(f.id);
    return `
      <div class="card" style="${beaten ? 'border-color:var(--green)' : ''}">
        <div style="display:flex;gap:9px;align-items:center">
          <canvas class="portrait" data-fid="${f.id}" width="28" height="28"
            style="image-rendering:pixelated;width:28px;height:28px;flex:0 0 auto"></canvas>
          <div style="min-width:0">
            <div style="font-family:var(--head);font-size:9px;color:${beaten ? 'var(--green)' : 'var(--ink)'}">
              ${esc(f.name)}</div>
            <div class="epithet">${esc(f.epithet)}</div>
          </div>
        </div>
        <div class="small dim">${esc(SPORTS[f.sport]?.name || 'ALL SPORTS')} ·
          TIER ${f.tier} · ${f.hp} COND · ${f.power} POWER ·
          ${Math.round(f.guile * 100)}% ACCURATE${beaten ? ' · <span style="color:var(--green)">BEATEN</span>' : ''}</div>
      </div>`;
  }).join('');

  show(`
    <div class="screen on">
      <h2>THE ROSTER</h2>
      <p class="small dim">Affectionate fakes, all of them. Nobody real was harmed.</p>
      <div class="btn-grid">${cards}</div>
      <div class="btn-row"><button data-act="${G.run && !G.run.over ? 'back-to-map' : 'title'}">BACK</button></div>
    </div>`);

  for (const c of panel.querySelectorAll('canvas.portrait')) {
    const f = findFighter(c.dataset.fid);
    const cc = c.getContext('2d');
    cc.imageSmoothingEnabled = false;
    if (f) drawPortrait(cc, f, 0, 0, 28);
  }
}

// ── PvP screens ────────────────────────────────────────────────────────────
function pvpBars() {
  const m = G.match;
  return m.players.map((p, i) => `
    <div class="fighter-bar">
      <div class="row">
        <span class="nm" style="color:${i === 0 ? 'var(--green)' : 'var(--red)'}">
          ${esc(p.name)}${m.turn === i && m.phase !== PVP_PHASE.DONE ? ' ◀' : ''}</span>
        <span class="hpnum">${p.hp}/${p.maxHp}${p.combo > 1 ? ` · ×${p.combo}` : ''}</span>
      </div>
      <div class="hp-track"><div class="hp-fill ${i === 1 ? 'foe' : ''}" style="width:${pct(p.hp, p.maxHp)}"></div></div>
    </div>`).join('');
}

function screenPvpHandover() {
  G.screen = 'pvp';
  const m = G.match;
  show(`
    <div class="screen on">
      ${pvpBars()}
      <div class="card gold">
        <h2>PASS IT TO ${esc(m.active.name)}</h2>
        <p class="small dim">Round ${m.round}. Don't look until it's yours.</p>
      </div>
      <div class="btn-row">
        <button class="primary" data-act="pvp-begin">I'M ${esc(m.active.name)} — GO</button>
      </div>
    </div>`);
  layout();
}

function screenPvpQuestion() {
  G.screen = 'pvp';
  const m = G.match;
  const q = m.question;
  const opts = q.options.map((o, i) => `
    <button class="opt" data-act="pvp-answer" data-i="${i}">
      <span class="num">${i + 1}</span>
      <span class="label">${esc(o.label)}</span>
      <span class="val">${o.value}</span>
    </button>`).join('');
  show(`
    <div class="screen on">
      ${pvpBars()}
      <div class="q-mode">
        <span class="strike">▲ ${esc(m.active.name)} — YOUR GO</span>
        <span class="dim">${esc(SPORTS[q.sport]?.name || q.sport)}</span>
      </div>
      <div id="timer-track"><div id="timer-fill"></div></div>
      <div class="q-prompt">${esc(q.most)}</div>
      <div class="q-hint">PICK THE BIGGEST NUMBER TO HIT HARDEST</div>
      ${opts}
    </div>`);
  layout();
  startTimer();
}

function screenPvpResolve() {
  stopTimer();
  const m = G.match;
  const r = m.lastResult;
  const who = m.players[r.by];
  show(`
    <div class="screen on">
      ${pvpBars()}
      <div class="feedback ${r.perfect ? 'good' : r.timedOut ? 'bad' : 'mid'}">
        ${r.timedOut ? 'TOO SLOW' : r.perfect ? 'SCREAMER!' : 'GOOD CONTACT'}</div>
      <p><b>${esc(who.name)}</b> picked <b>${esc(r.option.label)}</b> —
        ${r.option.value} ${esc(r.unit)} →
        <b style="color:var(--gold)">${r.damage} DAMAGE</b></p>
      <p class="small dim">Best answer was <b style="color:var(--green)">${r.correctValue} ${esc(r.unit)}</b>.</p>
      ${r.note ? `<div class="note">${esc(r.note)}</div>` : ''}
      <div class="btn-row"><button class="primary" data-act="pvp-advance">CARRY ON</button></div>
    </div>`);
  layout();
}

function screenPvpDone() {
  const m = G.match;
  const w = m.players[m.winner], l = m.players[1 - m.winner];
  sfx.win();
  show(`
    <div class="screen on">
      <h1 style="font-size:16px">${esc(w.name)} WINS</h1>
      <div class="stat-grid">
        <div class="stat"><span class="k">${esc(w.name)} ACC</span><span class="v">${Math.round((w.perfects / Math.max(1, w.answered)) * 100)}%</span></div>
        <div class="stat"><span class="k">${esc(l.name)} ACC</span><span class="v">${Math.round((l.perfects / Math.max(1, l.answered)) * 100)}%</span></div>
        <div class="stat"><span class="k">ROUNDS</span><span class="v">${m.round}</span></div>
      </div>
      <div class="btn-row">
        <button class="primary" data-act="go-setup" data-mode="pvp">BEST OF THREE?</button>
        <button data-act="title">TITLES</button>
      </div>
    </div>`);
  layout();
}

// ═══════════════════════════════════════════════════════════════════════════
// TIMER
// ═══════════════════════════════════════════════════════════════════════════
function startTimer() {
  G.timer.running = true;
  G.timer.start = performance.now();
  G.timer.lastTick = 0;
}
function stopTimer() { G.timer.running = false; }

function tickTimer() {
  if (!G.timer.running) return;
  const el = $('timer-fill');
  if (!el) return;
  const elapsed = performance.now() - G.timer.start;
  const frac = Math.max(0, 1 - elapsed / ANSWER_MS);
  el.style.width = `${frac * 100}%`;
  el.className = frac < 0.22 ? 'panic' : frac < 0.5 ? 'warn' : '';

  const secs = Math.ceil((ANSWER_MS - elapsed) / 1000);
  if (secs <= 3 && secs !== G.timer.lastTick && secs > 0) {
    G.timer.lastTick = secs;
    sfx.tick();
  }
  if (elapsed >= ANSWER_MS) {
    stopTimer();
    if (G.match && G.match.phase === PVP_PHASE.ANSWER) doPvpAnswer(worstIndexPvp(), ANSWER_MS);
    else if (G.battle) doAnswer(worstIndex(), ANSWER_MS);
  }
}

function worstIndex() {
  const b = G.battle;
  const vals = b.question.options.map((o) => o.value);
  const target = b.phase === PHASE.BLOCK ? Math.max(...vals) : Math.min(...vals);
  return vals.indexOf(target);
}
function worstIndexPvp() {
  const vals = G.match.question.options.map((o) => o.value);
  return vals.indexOf(Math.min(...vals));
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

function startRun() {
  const seedInput = $('seedin');
  G.setup.seed = seedInput ? seedInput.value : '';
  const seed = makeSeedFrom(G.setup.seed);
  G.run = new Run({ seed, sports: G.setup.sports, kitIndex: G.setup.kit, name: G.setup.name });
  G.battle = null; G.enc = null;
  savePrefs({ lastSports: G.setup.sports, lastKit: G.setup.kit, lastName: G.setup.name });
  G.lastVenue = null;
  G.visited = new Set();
  centreCamera(true);
  sfx.whistle();
  // Mark the starting venue before the first paint, or the minimap opens with
  // the room you are standing in still fogged.
  flashVenue(G.run.map.roomAt(G.run.player.x, G.run.player.y));
  screenMap();
}

function startPvp() {
  const n1 = ($('p1name')?.value || 'PLAYER 1').toUpperCase().slice(0, 10);
  const n2 = ($('p2name')?.value || 'PLAYER 2').toUpperCase().slice(0, 10);
  G.setup.name = n1; G.setup.name2 = n2;
  G.match = new PvpMatch(
    { name: n1, palette: PLAYER_KITS[0].palette, build: 'normal', gear: 'ball' },
    { name: n2, palette: PLAYER_KITS[1].palette, build: 'normal', gear: 'gloves' },
    { sports: G.setup.sports });
  G.scene.venue = 'THE MAIN ARENA';
  G.scene.player = G.match.players[0];
  G.scene.foe = G.match.players[1];
  G.scene.playerDown = G.scene.foeDown = false;
  setHud(false);
  sfx.whistle();
  screenPvpHandover();
}

function move(dx, dy) {
  if (G.screen !== 'map' || G.busy || !G.run || G.run.over) return;
  const res = G.run.step(dx, dy);
  updateHud();

  if (res.kind === 'blocked') { sfx.blocked(); return; }
  if (res.kind === 'pickup') {
    sfx.pickup();
    floater(res.pickup.desc, VIEW_W / 2, 60, '#4ade80');
    toast(`${res.pickup.name} — ${res.pickup.desc}`);
  } else if (res.kind !== 'encounter') {
    sfx.step();
  }

  const room = G.run.map.roomAt(G.run.player.x, G.run.player.y);
  if (room && room !== G.lastVenue) flashVenue(room);

  if (res.kind === 'encounter') { enterBattle(res.encounter); return; }
  if (G.run.over) { screenResults(); return; }
  screenMap();
}

function flashVenue(room) {
  if (!room) return;
  G.visited.add(room.id);
  G.lastVenue = room;
  G.venueFlash = { name: room.name, alpha: 1, life: 90 };
}

function enterBattle(enc) {
  G.enc = enc;
  G.busy = true;
  sfx.encounter();
  const room = G.run.map.roomAt(enc.x, enc.y);
  G.scene.venue = enc.isBoss ? 'THE MAIN ARENA' : (room ? room.name : 'THE REC');
  G.battle = new Battle(G.run.player, enc.fighter, {
    level: enc.level,
    sports: G.setup.sports,
    usedQuestions: G.run.usedQuestions,
    seed: (G.run.seed ^ (enc.x * 7919) ^ (enc.y * 104729)) >>> 0,
  });
  G.battle.foe.venueName = G.scene.venue;
  G.scene.player = G.run.player;
  G.scene.foe = G.battle.foe;
  G.scene.playerDown = G.scene.foeDown = false;
  G.scene.floaters.length = 0;
  setHud(true);
  G.busy = false;
  screenBattleIntro();
}

function doAnswer(i, forcedMs) {
  const b = G.battle;
  if (!b || b.phase === PHASE.RESOLVE || G.busy) return;
  if (b.eliminated.includes(i)) return;
  G.busy = true;
  stopTimer();

  const wasStrike = b.phase === PHASE.STRIKE;
  if (wasStrike) G.scene.playerWind = 1; else G.scene.foeWind = 1;

  G.run.spendEnergy(BATTLE_TURN_COST);
  const r = b.answer(i, forcedMs);

  setTimeout(() => {
    G.scene.playerWind = 0; G.scene.foeWind = 0;
    if (wasStrike) {
      G.scene.foeFlash = 8;
      floater(`-${r.damage}`, 230, 96, r.perfect ? '#f7d774' : '#f87171', r.perfect);
      if (r.perfect) sfx.crit(); else sfx.hit();
      shakeStage(r.perfect ? 1.6 : 1);
    } else {
      G.scene.playerFlash = 8;
      floater(`-${r.taken}`, 76, 100, '#f87171', r.taken > 30);
      if (r.perfect) sfx.block(); else sfx.takeHit();
      shakeStage(r.perfect ? 0.6 : 1.3);
    }
    if (r.card) sfx.card();
    updateHud();
    G.busy = false;
    if (G.run.over && b.phase !== PHASE.WON) { /* energy gone — still finish the fight */ }
    screenResolve();
  }, 260);
}

function advanceBattle() {
  const b = G.battle;
  const next = b.advance();
  if (next === PHASE.WON) { screenBattleEnd(true); return; }
  if (next === PHASE.LOST) { screenBattleEnd(false); return; }
  if (b.phase === PHASE.RESOLVE) { // sent off — they got a free hit
    G.scene.playerFlash = 8;
    floater(`-${b.lastResult.taken}`, 76, 100, '#f87171', true);
    sfx.takeHit(); shakeStage(1.4); updateHud();
    screenResolve(); return;
  }
  screenQuestion();
}

function doPvpAnswer(i, forcedMs) {
  const m = G.match;
  if (!m || m.phase !== PVP_PHASE.ANSWER || G.busy) return;
  G.busy = true;
  stopTimer();
  const attacker = m.turn;
  if (attacker === 0) G.scene.playerWind = 1; else G.scene.foeWind = 1;
  const r = m.answer(i, forcedMs);
  setTimeout(() => {
    G.scene.playerWind = 0; G.scene.foeWind = 0;
    if (attacker === 0) {
      G.scene.foeFlash = 8;
      floater(`-${r.damage}`, 230, 96, r.perfect ? '#f7d774' : '#f87171', r.perfect);
    } else {
      G.scene.playerFlash = 8;
      floater(`-${r.damage}`, 76, 100, r.perfect ? '#f7d774' : '#f87171', r.perfect);
    }
    if (r.perfect) sfx.crit(); else sfx.hit();
    shakeStage(r.perfect ? 1.6 : 1);
    G.busy = false;
    screenPvpResolve();
  }, 260);
}

// ═══════════════════════════════════════════════════════════════════════════
// INPUT
// ═══════════════════════════════════════════════════════════════════════════

panel.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn || btn.disabled) return;
  initAudio();
  const act = btn.dataset.act;

  switch (act) {
    case 'title': sfx.back(); screenTitle(); break;
    case 'howto': sfx.select(); screenHowTo(); break;
    case 'go-setup': sfx.select(); screenSetup(btn.dataset.mode); break;
    case 'league': sfx.select(); screenLeague(); break;
    case 'codex': sfx.select(); screenCodex(); break;
    case 'wipe':
      if (confirm('Wipe the league table and everything you have beaten? This cannot be undone.')) {
        localStorage.removeItem('grandstand.save.v1');
        Object.assign(save, loadSave());
        screenLeague();
      }
      break;
    case 'toggle-sport': {
      const s = btn.dataset.sport;
      const idx = G.setup.sports.indexOf(s);
      if (idx >= 0) G.setup.sports.splice(idx, 1); else G.setup.sports.push(s);
      sfx.select();
      screenSetup(G.setup.mode);
      break;
    }
    case 'kit': G.setup.kit = +btn.dataset.i; sfx.select(); screenSetup(G.setup.mode); break;
    case 'start-run': sfx.confirm(); startRun(); break;
    case 'start-pvp': sfx.confirm(); startPvp(); break;
    case 'move': move(+btn.dataset.dx, +btn.dataset.dy); break;
    case 'end-day':
      if (confirm('End the day here and take your score?')) { G.run.end('energy'); screenResults(); }
      break;
    case 'fight': sfx.confirm(); G.battle.begin(); screenQuestion(); break;
    case 'leg-it':
      sfx.back();
      G.run.spendEnergy(10);
      G.battle = null;
      updateHud();
      if (G.run.over) screenResults(); else screenMap();
      break;
    case 'answer': doAnswer(+btn.dataset.i); break;
    case 'nutmeg':
      if (G.battle.useNutmeg()) { sfx.select(); toast('NUTMEG — one option gone'); screenQuestion(); }
      break;
    case 'advance': sfx.select(); advanceBattle(); break;
    case 'back-to-map': G.battle = null; screenMap(); break;
    case 'results': screenResults(); break;
    case 'pvp-begin': sfx.confirm(); G.match.beginTurn(); screenPvpQuestion(); break;
    case 'pvp-answer': doPvpAnswer(+btn.dataset.i); break;
    case 'pvp-advance': {
      sfx.select();
      const next = G.match.advance();
      if (next === PVP_PHASE.DONE) screenPvpDone(); else screenPvpHandover();
      break;
    }
  }
});

$('btn-sound').addEventListener('click', () => {
  initAudio();
  setMuted(!isMuted());
  savePrefs({ muted: isMuted() });
  $('btn-sound').textContent = isMuted() ? '♪̸' : '♪';
});
$('btn-quit').addEventListener('click', () => {
  if (G.run && !G.run.over && confirm('End the day here and take your score?')) {
    G.run.end('energy'); screenResults();
  }
});

const KEYMAP = {
  ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
  ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
  ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
  ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
};

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  initAudio();
  const mv = KEYMAP[e.key];
  if (mv && G.screen === 'map') { e.preventDefault(); move(mv[0], mv[1]); return; }

  if (e.key === 'm' || e.key === 'M') { $('btn-sound').click(); return; }

  if (['1', '2', '3'].includes(e.key)) {
    const i = +e.key - 1;
    const btn = panel.querySelector(`[data-act="answer"][data-i="${i}"], [data-act="pvp-answer"][data-i="${i}"]`);
    if (btn && !btn.classList.contains('gone')) { e.preventDefault(); btn.click(); }
    return;
  }
  if (e.key === 'n' || e.key === 'N') {
    panel.querySelector('[data-act="nutmeg"]:not([disabled])')?.click();
    return;
  }
  if (e.key === 'Enter' || e.key === ' ') {
    const b = panel.querySelector('button.primary');
    if (b) { e.preventDefault(); b.click(); }
  }
});

// swipe to move on touch
let touchStart = null;
stage.addEventListener('touchstart', (e) => {
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
stage.addEventListener('touchend', (e) => {
  if (!touchStart || G.screen !== 'map') return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
  if (Math.abs(dx) > Math.abs(dy)) move(Math.sign(dx), 0); else move(0, Math.sign(dy));
  touchStart = null;
}, { passive: true });

// ═══════════════════════════════════════════════════════════════════════════
// LOOP
// ═══════════════════════════════════════════════════════════════════════════

function centreCamera(snap = false) {
  const p = G.run.player;
  const tx = p.x * TILE + TILE / 2 - VIEW_W / 2;
  const ty = p.y * TILE + TILE / 2 - VIEW_H / 2;
  const maxX = G.run.map.w * TILE - VIEW_W;
  const maxY = G.run.map.h * TILE - VIEW_H;
  const cx = Math.max(0, Math.min(maxX, tx));
  const cy = Math.max(0, Math.min(maxY, ty));
  if (snap) { G.cam.x = cx; G.cam.y = cy; }
  else { G.cam.x += (cx - G.cam.x) * 0.22; G.cam.y += (cy - G.cam.y) * 0.22; }
  G.cam.x = Math.round(G.cam.x);
  G.cam.y = Math.round(G.cam.y);
}

function frame() {
  G.t++;
  tickTimer();

  // decay hit flashes
  if (G.scene.foeFlash > 0) G.scene.foeFlash--;
  if (G.scene.playerFlash > 0) G.scene.playerFlash--;

  // floaters drift up and fade
  for (let i = G.scene.floaters.length - 1; i >= 0; i--) {
    const f = G.scene.floaters[i];
    f.y += f.vy; f.life--;
    if (f.life <= 0) G.scene.floaters.splice(i, 1);
  }

  if (G.venueFlash) {
    G.venueFlash.life--;
    G.venueFlash.alpha = Math.min(1, G.venueFlash.life / 30);
    if (G.venueFlash.life <= 0) G.venueFlash = null;
  }

  switch (G.screen) {
    case 'map': {
      const p = G.run.player;
      p.px += (p.x * TILE - p.px) * 0.3;
      p.py += (p.y * TILE - p.py) * 0.3;
      centreCamera();
      drawMap(ctx, G.run.map, G.cam, p, G.t, { flashVenue: G.venueFlash });
      for (const f of G.scene.floaters) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, f.life / 44);
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#000'; ctx.fillText(f.text, f.x + 1, f.y + 1);
        ctx.fillStyle = f.colour; ctx.fillText(f.text, f.x, f.y);
        ctx.restore();
      }
      break;
    }
    case 'battle':
    case 'pvp':
      drawBattleScene(ctx, G.scene, G.t);
      break;
    default:
      drawTitleScene(ctx, G.t);
      if (G.screen === 'title') drawTitleWordmark(ctx, G.t);
      break;
  }

  requestAnimationFrame(frame);
}

// Exposed for the browser playtest harness in tools/ and for poking about in
// devtools. Nothing in the game reads it.
window.GRANDSTAND = G;

// ── go ─────────────────────────────────────────────────────────────────────
$('btn-sound').textContent = isMuted() ? '♪̸' : '♪';
document.fonts?.ready.then(layout);
screenTitle();
layout();
requestAnimationFrame(frame);
