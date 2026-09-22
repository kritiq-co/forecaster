/**
 * End-to-end browser playtest.
 *
 *   npm install && npx serve . -l 8777   (or: python3 -m http.server 8777)
 *   node tools/playtest.mjs [baseUrl] [--shots DIR]
 *
 * Drives a real Chromium through a whole run: start, walk, fight, finish the
 * day, read the league table, then play a hot-seat PvP match. Fails loudly on
 * any console error or page exception, because a game that throws halfway
 * through a fight is worse than one that doesn't start.
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv.find((a) => a.startsWith('http')) || 'http://localhost:8777';
const shotsFlag = process.argv.indexOf('--shots');
const SHOTS = shotsFlag > -1 ? process.argv[shotsFlag + 1] : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };

let failures = 0;
const check = (ok, label) => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failures++;
};

/** BFS the player to the nearest live opponent and walk there. */
async function walkToNearestFoe(page, maxSteps = 200) {
  const path = await page.evaluate(() => {
    const G = window.GRANDSTAND;
    const m = G.run.map, p = G.run.player;
    const key = (x, y) => y * m.w + x;
    const prev = new Map([[key(p.x, p.y), null]]);
    const q = [[p.x, p.y]];
    let goal = null;
    while (q.length) {
      const [x, y] = q.shift();
      if (m.encounterAt(x, y) && !(x === p.x && y === p.y)) { goal = [x, y]; break; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!m.walkable(nx, ny) || prev.has(key(nx, ny))) continue;
        prev.set(key(nx, ny), [x, y]); q.push([nx, ny]);
      }
    }
    if (!goal) return null;
    const steps = []; let cur = goal;
    while (cur) { steps.push(cur); cur = prev.get(key(cur[0], cur[1])); }
    steps.reverse();
    return steps.slice(1).map(([x, y], i) => [x - steps[i][0], y - steps[i][1]]);
  });
  if (!path) return false;
  for (const [dx, dy] of path.slice(0, maxSteps)) {
    await page.evaluate(([a, b]) =>
      document.querySelector(`[data-act="move"][data-dx="${a}"][data-dy="${b}"]`)?.click(), [dx, dy]);
    await page.waitForTimeout(25);
    if (await page.evaluate(() => !!document.querySelector('[data-act="fight"]'))) return true;
  }
  return page.evaluate(() => !!document.querySelector('[data-act="fight"]'));
}

/** Play the current fight to a finish. `skill` is the chance of a perfect pick. */
async function playFight(page, skill = 1) {
  let guard = 0, sawBlock = false, sawStrike = false;
  while (guard++ < 90) {
    const st = await page.evaluate(() => {
      if (document.querySelector('[data-act="advance"]')) return { kind: 'resolve' };
      if (document.querySelector('[data-act="back-to-map"], [data-act="results"]')) return { kind: 'end' };
      const opts = [...document.querySelectorAll('[data-act="answer"]:not(.gone)')];
      if (!opts.length) return { kind: 'other' };
      const isBlock = !!document.querySelector('.q-prompt.block');
      const vals = opts.map((o) => +o.querySelector('.val').textContent);
      const ideal = isBlock ? Math.min(...vals) : Math.max(...vals);
      return { kind: 'question', isBlock, best: opts[vals.indexOf(ideal)].dataset.i,
               any: opts.map((o) => o.dataset.i) };
    });
    if (st.kind === 'end') return { sawBlock, sawStrike, finished: true };
    if (st.kind === 'other') return { sawBlock, sawStrike, finished: false };
    if (st.kind === 'resolve') { await page.click('[data-act="advance"]'); await page.waitForTimeout(220); continue; }
    st.isBlock ? (sawBlock = true) : (sawStrike = true);
    const i = Math.random() < skill ? st.best : st.any[Math.floor(Math.random() * st.any.length)];
    await page.click(`[data-act="answer"][data-i="${i}"]`);
    await page.waitForTimeout(400);
  }
  return { sawBlock, sawStrike, finished: false };
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: process.env.IGNORE_CERTS ? ['--ignore-certificate-errors'] : [],
});
const page = await browser.newPage({ viewport: { width: 420, height: 820 }, deviceScaleFactor: 2 });

const problems = [];
page.on('console', (m) => {
  const t = m.text();
  // The favicon 404 is noise; everything else is ours.
  if (m.type() === 'error' && !/favicon|ERR_CERT|ERR_TOO_MANY_RETRIES/.test(t)) problems.push(`CONSOLE: ${t}`);
});
page.on('pageerror', (e) => problems.push(`PAGEERROR: ${e.message}`));

console.log(`\nGRANDSTAND playtest — ${BASE}\n`);

await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => localStorage.removeItem('grandstand.save.v1'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await shot(page, '01-title');
check(await page.isVisible('[data-act="go-setup"]'), 'title screen renders');

console.log('\nCAREER RUN');
await page.click('[data-act="go-setup"][data-mode="career"]');
await page.waitForTimeout(250);
await shot(page, '02-setup');
check(await page.isVisible('[data-act="toggle-sport"]'), 'sport filters offered');

await page.fill('#seedin', 'SHEARER');
await page.click('[data-act="start-run"]');
await page.waitForTimeout(800);
await shot(page, '03-map');
check(await page.isVisible('#dpad'), 'overworld renders');

const e0 = await page.evaluate(() => window.GRANDSTAND.run.energy);
await page.click('[data-act="move"][data-dx="1"][data-dy="0"]');
await page.waitForTimeout(120);
const e1 = await page.evaluate(() => window.GRANDSTAND.run.energy);
check(e1 < e0, `walking costs energy (${e0} → ${e1})`);

check(await walkToNearestFoe(page), 'reached an opponent');
await shot(page, '04-encounter');
await page.click('[data-act="fight"]');
await page.waitForTimeout(400);
await shot(page, '05-strike');
check(await page.isVisible('.q-prompt'), 'a question is asked');
check(await page.isVisible('.q-hint'), 'the direction hint is shown');

const foeBefore = await page.evaluate(() => window.GRANDSTAND.battle.foe.hp);
const r1 = await playFight(page, 1);
check(r1.sawStrike, 'STRIKE phase reached');
check(r1.sawBlock, 'BLOCK phase reached');
check(r1.finished, 'fight resolved to a result');
await shot(page, '06-fight-end');
const won = await page.evaluate(() => window.GRANDSTAND.run.wins > 0);
check(won, `a perfect player beats tier 1 (foe started on ${foeBefore})`);

await page.evaluate(() => document.querySelector('[data-act="back-to-map"]')?.click());
await page.waitForTimeout(250);

// Fight on until the day runs out, playing sloppily so losses happen too.
let fights = 1;
for (let i = 0; i < 12; i++) {
  const over = await page.evaluate(() => window.GRANDSTAND.run.over);
  if (over) break;
  if (!(await walkToNearestFoe(page))) break;
  await page.click('[data-act="fight"]');
  await page.waitForTimeout(300);
  await playFight(page, 0.65);
  fights++;
  await page.evaluate(() => document.querySelector('[data-act="back-to-map"], [data-act="results"]')?.click());
  await page.waitForTimeout(250);
}
check(fights > 2, `played ${fights} fights in one day`);

await page.evaluate(() => { window.GRANDSTAND.run.end('energy'); });
await page.evaluate(() => document.querySelector('[data-act="end-day"]')?.click());
await page.evaluate(() => { if (!document.querySelector('[data-act="league"]')) window.GRANDSTAND.run.energy = 0; });
if (!(await page.isVisible('[data-act="league"]'))) {
  await page.evaluate(() => document.querySelector('[data-act="move"][data-dx="1"][data-dy="0"]')?.click());
  await page.waitForTimeout(300);
}
await page.waitForTimeout(400);
await shot(page, '07-results');
check(await page.isVisible('[data-act="league"]'), 'results screen shown at end of day');

await page.click('[data-act="league"]');
await page.waitForTimeout(300);
await shot(page, '08-league');
const leagueRows = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
check(leagueRows >= 1, `league table persisted the run (${leagueRows} row(s))`);

console.log('\nROSTER');
await page.click('[data-act="title"]');
await page.waitForTimeout(200);
await page.click('[data-act="codex"]');
await page.waitForTimeout(400);
await shot(page, '09-roster');
check(await page.evaluate(() => document.querySelectorAll('canvas.portrait').length) === 20, 'all 20 portraits drawn');

console.log('\nHOT-SEAT PvP');
await page.click('[data-act="title"]');
await page.waitForTimeout(200);
await page.click('[data-act="go-setup"][data-mode="pvp"]');
await page.waitForTimeout(250);
await page.fill('#p1name', 'DAD');
await page.fill('#p2name', 'LAD');
await page.click('[data-act="start-pvp"]');
await page.waitForTimeout(350);
await shot(page, '10-pvp-handover');
check(await page.isVisible('[data-act="pvp-begin"]'), 'handover screen hides the question');

let pvpGuard = 0;
while (pvpGuard++ < 80) {
  if (await page.isVisible('[data-act="pvp-begin"]')) {
    await page.click('[data-act="pvp-begin"]'); await page.waitForTimeout(250);
    if (pvpGuard < 4) await shot(page, '11-pvp-question');
    continue;
  }
  if (await page.isVisible('[data-act="pvp-advance"]')) {
    await page.click('[data-act="pvp-advance"]'); await page.waitForTimeout(220); continue;
  }
  if (await page.isVisible('[data-act="pvp-answer"]')) {
    const i = await page.evaluate(() => {
      const opts = [...document.querySelectorAll('[data-act="pvp-answer"]')];
      const vals = opts.map((o) => +o.querySelector('.val').textContent);
      // player 1 plays well, player 2 guesses — someone has to lose
      const turn = window.GRANDSTAND.match.turn;
      return turn === 0 ? opts[vals.indexOf(Math.max(...vals))].dataset.i
                        : opts[Math.floor(Math.random() * opts.length)].dataset.i;
    });
    await page.click(`[data-act="pvp-answer"][data-i="${i}"]`);
    await page.waitForTimeout(380);
    continue;
  }
  break;
}
await page.waitForTimeout(300);
await shot(page, '12-pvp-result');
check(await page.evaluate(() => window.GRANDSTAND.match.winner !== null), 'PvP match produced a winner');

console.log('');
if (problems.length) { console.error('PAGE PROBLEMS:'); problems.forEach((p) => console.error('  ' + p)); failures += problems.length; }
console.log(`\n${failures ? '✗' : '✓'} ${failures} failure${failures === 1 ? '' : 's'}\n`);

await browser.close();
process.exit(failures ? 1 : 0);
