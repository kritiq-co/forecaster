/**
 * GRANDSTAND — run state and persistence.
 *
 * A run is "a day out". You get an energy budget, you walk the complex, you
 * take on who you fancy, and when the energy is gone the day ends and you get
 * a score. Rep persists between runs in the league table; nothing else does.
 */

import { GameMap, PICKUPS } from './map.js';
import { PLAYER_KITS } from '../data/roster.js';
import { hashSeed } from '../engine/rng.js';

export const START_ENERGY = 110;
export const START_HP = 120;
export const STEP_COST = 1;
export const BATTLE_TURN_COST = 1;
export const WIN_ENERGY_REFUND = 8;
export const START_NUTMEGS = 3;

const SAVE_KEY = 'grandstand.save.v1';

export class Run {
  constructor({ seed, sports = [], kitIndex = 0, name = 'YOU' } = {}) {
    this.seed = seed || (Math.random() * 0xffffffff) >>> 0;
    this.sports = sports;
    this.name = name;
    this.kit = PLAYER_KITS[kitIndex % PLAYER_KITS.length];
    this.map = new GameMap(this.seed, { sports });

    this.player = {
      name,
      palette: this.kit.palette,
      build: 'normal',
      gear: 'ball',
      hp: START_HP,
      maxHp: START_HP,
      power: 22,
      nutmegs: START_NUTMEGS,
      x: this.map.start.x,
      y: this.map.start.y,
      px: this.map.start.x * 16,
      py: this.map.start.y * 16,
      facing: 1,
    };

    this.energy = START_ENERGY;
    this.maxEnergy = START_ENERGY;
    this.rep = 0;
    this.wins = 0;
    this.losses = 0;
    this.answered = 0;
    this.perfects = 0;
    this.bestCombo = 0;
    this.usedQuestions = new Set();
    this.defeatedIds = [];
    this.over = false;
    this.outcome = null;   // 'energy' | 'ko' | 'champion'
    this.startedAt = Date.now();
  }

  get accuracy() { return this.answered ? this.perfects / this.answered : 0; }

  spendEnergy(n) {
    this.energy = Math.max(0, this.energy - n);
    if (this.energy <= 0 && !this.over) this.end('energy');
    return this.energy;
  }

  end(outcome) {
    // Beating the boss always trumps an earlier ending: running the energy
    // down on the final exchange and *then* winning is still a championship.
    if (this.over && outcome !== 'champion') return;
    this.over = true;
    this.outcome = outcome;
    this.finishedAt = Date.now();
  }

  /** Try to walk one tile. Returns what happened. */
  step(dx, dy) {
    if (this.over) return { kind: 'over' };
    const nx = this.player.x + dx, ny = this.player.y + dy;
    if (dx !== 0) this.player.facing = dx > 0 ? 1 : -1;
    if (!this.map.walkable(nx, ny)) return { kind: 'blocked' };

    this.player.x = nx; this.player.y = ny;
    this.spendEnergy(STEP_COST);

    const pick = this.map.pickupAt(nx, ny);
    if (pick) {
      pick.taken = true;
      const def = PICKUPS[pick.kind];
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + (def.hp || 0));
      this.energy = Math.min(this.maxEnergy, this.energy + (def.energy || 0));
      this.rep += def.rep || 0;
      return { kind: 'pickup', pickup: def };
    }

    const enc = this.map.encounterAt(nx, ny);
    if (enc) return { kind: 'encounter', encounter: enc };

    if (this.over) return { kind: 'exhausted' };
    return { kind: 'moved' };
  }

  finishBattle(enc, battle, won) {
    this.answered += battle.answered;
    this.perfects += battle.perfects;
    this.bestCombo = Math.max(this.bestCombo, battle.bestCombo);
    this.rep += battle.repEarned;
    if (won) {
      enc.defeated = true;
      this.defeatedIds.push(enc.fighter.id);
      this.wins++;
      this.rep += battle.victoryRep();
      this.energy = Math.min(this.maxEnergy, this.energy + WIN_ENERGY_REFUND);
      if (enc.isBoss) this.end('champion');
    } else {
      this.losses++;
      this.player.hp = Math.max(1, Math.round(this.player.maxHp * 0.3));
      this.energy = Math.max(0, this.energy - 20);
      if (this.energy <= 0) this.end('ko');
    }
  }

  scoreCard() {
    const bonus =
      this.rep +
      Math.round(this.accuracy * 500) +
      this.bestCombo * 60 +
      (this.outcome === 'champion' ? 1000 : 0);
    return {
      name: this.name,
      seed: this.seed,
      rep: bonus,
      wins: this.wins,
      losses: this.losses,
      accuracy: this.accuracy,
      bestCombo: this.bestCombo,
      answered: this.answered,
      outcome: this.outcome,
      sports: this.sports.slice(),
      date: Date.now(),
    };
  }
}

// ── persistence ───────────────────────────────────────────────────────────

function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function writeSave(data) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* private mode */ }
}

const blankSave = () => ({
  league: [],
  beaten: [],
  totalRuns: 0,
  bestRep: 0,
  muted: false,
  lastSports: [],
  lastKit: 0,
  lastName: 'YOU',
});

export function loadSave() {
  return { ...blankSave(), ...(readSave() || {}) };
}

export function recordRun(card) {
  const save = loadSave();
  save.league.push(card);
  save.league.sort((a, b) => b.rep - a.rep);
  save.league = save.league.slice(0, 12);
  save.totalRuns++;
  save.bestRep = Math.max(save.bestRep, card.rep);
  writeSave(save);
  return save;
}

export function recordBeaten(ids) {
  const save = loadSave();
  save.beaten = Array.from(new Set([...save.beaten, ...ids]));
  writeSave(save);
  return save;
}

export function savePrefs(prefs) {
  writeSave({ ...loadSave(), ...prefs });
}

export function makeSeedFrom(text) {
  return text && text.trim() ? hashSeed(text.trim().toUpperCase()) : (Math.random() * 0xffffffff) >>> 0;
}

/** Turn a numeric seed back into something a dad can read out in the pub. */
const WORDS = ['SHEARER', 'BRUNO', 'GAZZA', 'DALEY', 'TORVILL', 'HENDRY', 'BOTHAM',
  'FALDO', 'MANSELL', 'GUNNELL', 'CHRISTIE', 'TAYLOR', 'BORG', 'LINEKER', 'REDGRAVE', 'DAVIS'];
export function seedName(seed) {
  const a = WORDS[seed % WORDS.length];
  const b = (seed >> 8) % 90 + 10;
  return `${a}-${b}`;
}
