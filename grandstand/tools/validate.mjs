/**
 * Content validator for the question bank and roster.
 *
 *   node tools/validate.mjs
 *
 * This is the guard rail for the thing most likely to break the game: the
 * data. A question with two equal options, a missing unit, or a prompt that
 * doesn't say which way round it's asking is a bug you only find when a
 * player hits it mid-fight.
 */

import { QUESTIONS, SPORTS, countBySport } from '../src/data/questions.js';
import { ROSTER, bosses, byTier } from '../src/data/roster.js';

let errors = 0;
let warnings = 0;
const fail = (msg) => { console.error(`  ✗ ${msg}`); errors++; };
const warn = (msg) => { console.warn(`  ! ${msg}`); warnings++; };

const DIRECTION = /MOST|FEWEST|MORE|FEWER|BIGGEST|SMALLEST|HIGHEST|LOWEST|OLDEST|YOUNGEST|EARLIEST|SHORTEST|LONGEST/;

console.log(`\nQUESTIONS (${QUESTIONS.length})`);
QUESTIONS.forEach((q, i) => {
  const id = `#${i} "${q.most.slice(0, 44)}"`;

  if (!SPORTS[q.sport]) fail(`${id}: unknown sport "${q.sport}"`);
  if (!q.unit) fail(`${id}: missing unit`);
  if (q.options.length !== 3) fail(`${id}: ${q.options.length} options, expected 3`);

  for (const o of q.options) {
    if (!Number.isInteger(o.value)) fail(`${id}: "${o.label}" value ${o.value} is not a whole number`);
    if (o.value < 0) fail(`${id}: "${o.label}" is negative`);
    if (!o.label || !o.label.trim()) fail(`${id}: an option has no label`);
  }

  const vals = q.options.map((o) => o.value);
  // Ties at the top make the "best answer" ambiguous and the damage maths wrong.
  const max = Math.max(...vals), min = Math.min(...vals);
  if (vals.filter((v) => v === max).length > 1) fail(`${id}: tie for the highest value (${max})`);
  if (vals.filter((v) => v === min).length > 1) fail(`${id}: tie for the lowest value (${min})`);

  if (!DIRECTION.test(q.most)) fail(`${id}: strike prompt doesn't say which way round`);
  if (!DIRECTION.test(q.least)) fail(`${id}: block prompt doesn't say which way round`);
  if (q.most === q.least) fail(`${id}: block prompt is identical to the strike prompt`);
  if (q.least.split(' ').length < 4) warn(`${id}: block prompt is very terse — "${q.least}"`);
  if (!q.note) warn(`${id}: no note, so the player learns nothing from it`);
});

// Duplicate detection: same three labels asked twice is a content smell.
const seen = new Map();
QUESTIONS.forEach((q, i) => {
  const key = q.options.map((o) => o.label).sort().join('|') + '::' + q.unit;
  if (seen.has(key)) warn(`#${i} duplicates #${seen.get(key)} (same people, same unit)`);
  else seen.set(key, i);
});

console.log(`\nSPORT COVERAGE`);
const counts = countBySport();
for (const sport of Object.keys(SPORTS)) {
  const n = counts[sport] || 0;
  const bar = '█'.repeat(Math.min(n, 30));
  console.log(`  ${SPORTS[sport].name.padEnd(12)} ${String(n).padStart(3)} ${bar}`);
  // Below this, a single-sport run repeats questions inside one afternoon.
  if (n < 5) fail(`${sport}: only ${n} questions — a single-sport run would repeat badly`);
}

console.log(`\nROSTER (${ROSTER.length})`);
const ids = new Set();
for (const f of ROSTER) {
  const id = `"${f.name}"`;
  if (ids.has(f.id)) fail(`${id}: duplicate id "${f.id}"`);
  ids.add(f.id);
  for (const k of ['name', 'epithet', 'taunt', 'defeat', 'palette', 'gear']) {
    if (f[k] == null) fail(`${id}: missing ${k}`);
  }
  for (const [k, v] of Object.entries(f.palette || {})) {
    if (!/^#[0-9a-f]{6}$/i.test(v)) fail(`${id}: palette.${k} "${v}" is not a 6-digit hex colour`);
  }
  if (f.guile < 0 || f.guile > 1) fail(`${id}: guile ${f.guile} out of range`);
  if (f.hp <= 0 || f.power <= 0) fail(`${id}: non-positive hp/power`);
  if (f.sport !== 'any' && !SPORTS[f.sport]) fail(`${id}: unknown sport "${f.sport}"`);
}
for (const tier of [1, 2, 3]) {
  const n = byTier(tier).length;
  console.log(`  tier ${tier}: ${n}`);
  if (n < 3) fail(`tier ${tier} has only ${n} fighters — runs will feel repetitive`);
}
console.log(`  bosses: ${bosses().length}`);
if (bosses().length < 1) fail('no bosses');

console.log(`\n${errors ? '✗' : '✓'} ${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}\n`);
process.exit(errors ? 1 : 0);
