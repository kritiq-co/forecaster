/**
 * Combat balance simulation.
 *
 *   node tools/balance.mjs
 *
 * Plays thousands of fights at four player skill levels and prints the win
 * rate, fight length and health remaining for each tier. Change any number in
 * battle.js or roster.js and run this before you believe yourself.
 *
 * What the curve should look like:
 *   - tier 1 is a warm-up: almost everyone wins, but it should still cost you
 *   - tier 3 should hurt a casual player
 *   - a boss should be roughly a coin flip for someone who knows their sport
 * Remember the sim starts every fight at full health. In a real run you arrive
 * at the boss already battered, so the real difficulty is higher than this.
 */

import { Battle, PHASE } from '../src/game/battle.js';
import { byTier, bosses } from '../src/data/roster.js';

// Simulate a player of a given skill: chance of nailing the perfect pick,
// and a typical answer time.
function simulate(foe, level, skill, answerMs, trials = 600) {
  let wins = 0, rounds = 0, hpLeft = 0;
  for (let t = 0; t < trials; t++) {
    const player = { name: 'P', hp: 120, maxHp: 120, power: 22, nutmegs: 3 };
    const b = new Battle(player, foe, { level, seed: t * 7919 + 13 });
    b.begin();
    let guard = 0;
    while (b.phase !== PHASE.WON && b.phase !== PHASE.LOST && guard++ < 300) {
      if (b.phase === PHASE.RESOLVE) { b.advance(); continue; }
      const opts = b.question.options;
      const ideal = b.phase === PHASE.BLOCK ? Math.min(...opts.map(o=>o.value))
                                            : Math.max(...opts.map(o=>o.value));
      let pick;
      if (Math.random() < skill) pick = opts.findIndex(o => o.value === ideal);
      else pick = Math.floor(Math.random() * opts.length);
      b.answer(pick, answerMs);
    }
    if (b.phase === PHASE.WON) { wins++; hpLeft += player.hp; rounds += b.round; }
  }
  return {
    winRate: wins / trials,
    avgRounds: wins ? rounds / wins : 0,
    avgHpLeft: wins ? hpLeft / wins : 0,
  };
}

const skills = [
  ['clueless  (33% = random)', 0.33, 9000],
  ['pub quiz  (55%)',          0.55, 7000],
  ['decent dad(70%)',          0.70, 5000],
  ['encyclopaedic (90%)',      0.90, 3000],
];

console.log('%-26s %-18s %6s %8s %8s', 'SKILL', 'OPPONENT', 'WIN%', 'ROUNDS', 'HP LEFT');
for (const [label, skill, ms] of skills) {
  for (const [foe, lvl] of [[byTier(1)[0],1],[byTier(2)[0],2],[byTier(3)[0],3],[bosses()[1],4]]) {
    const r = simulate(foe, lvl, skill, ms, 400);
    console.log(
      label.padEnd(26),
      foe.name.padEnd(18),
      (r.winRate*100).toFixed(0).padStart(5)+'%',
      r.avgRounds.toFixed(1).padStart(8),
      r.avgHpLeft.toFixed(0).padStart(8));
  }
  console.log('');
}
