/**
 * GRANDSTAND — the overworld.
 *
 * A seeded municipal sports complex: pitches, a running track, a lido, car
 * parks and the tunnel out to the main arena. Rooms-and-corridors, then
 * decorated per-venue so each area reads as a different sport.
 *
 * You walk it on a grid. Every step costs energy. When the energy is gone,
 * the day is over — that is the whole run structure.
 */

import { makeRng } from '../engine/rng.js';
import { byTier, bosses } from '../data/roster.js';

export const TILE = 16;

export const T = {
  VOID: 0,
  TURF: 1,      // football pitch
  TRACK: 2,     // running track
  CONCRETE: 3,  // car park / walkways
  WALL: 4,      // terracing, fences
  WATER: 5,     // the lido
  SAND: 6,      // long jump pit / bunker
  BAIZE: 7,     // snooker club floor
  BOARD: 8,     // sports hall
  TUNNEL: 9,    // players' tunnel — the way on
};

export const SOLID = new Set([T.VOID, T.WALL, T.WATER]);

const VENUES = [
  { id: 'pitch',  name: 'THE REC',            floor: T.TURF,     sports: ['football'] },
  { id: 'track',  name: 'THE ATHLETICS TRACK',floor: T.TRACK,    sports: ['athletics', 'olympics'] },
  { id: 'hall',   name: 'THE SPORTS HALL',    floor: T.BOARD,    sports: ['boxing', 'telly'] },
  { id: 'club',   name: 'THE SNOOKER CLUB',   floor: T.BAIZE,    sports: ['snooker', 'darts'] },
  { id: 'links',  name: 'THE MUNICIPAL LINKS',floor: T.SAND,     sports: ['golf', 'cricket'] },
  { id: 'courts', name: 'THE TENNIS COURTS',  floor: T.CONCRETE, sports: ['tennis', 'rugby'] },
  { id: 'paddock',name: 'THE PADDOCK',        floor: T.CONCRETE, sports: ['motorsport'] },
];

export const PICKUPS = {
  orange:  { id: 'orange',  name: 'HALF-TIME ORANGE', icon: 'orange',  hp: 25, energy: 0,  desc: '+25 CONDITION' },
  bottle:  { id: 'bottle',  name: 'LUCOZADE',         icon: 'bottle',  hp: 0,  energy: 18, desc: '+18 ENERGY' },
  sponge:  { id: 'sponge',  name: 'MAGIC SPONGE',     icon: 'sponge',  hp: 45, energy: 0,  desc: '+45 CONDITION' },
  pie:     { id: 'pie',     name: 'HALF-TIME PIE',    icon: 'pie',     hp: 12, energy: 28, desc: '+12 COND, +28 ENERGY' },
  programme:{id: 'programme',name:'MATCH PROGRAMME',  icon: 'programme',hp: 0, energy: 0,  rep: 40, desc: '+40 REP' },
};

export class GameMap {
  constructor(seed, opts = {}) {
    this.seed = seed;
    this.rng = makeRng(seed);
    this.w = opts.w || 46;
    this.h = opts.h || 34;
    this.tiles = new Uint8Array(this.w * this.h);
    this.rooms = [];
    this.encounters = [];   // {x,y,fighter,defeated}
    this.pickups = [];      // {x,y,kind,taken}
    this.decor = [];        // {x,y,kind} purely visual
    this.generate(opts);
  }

  idx(x, y) { return y * this.w + x; }
  at(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return T.VOID;
    return this.tiles[this.idx(x, y)];
  }
  set(x, y, t) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.tiles[this.idx(x, y)] = t;
  }
  walkable(x, y) { return !SOLID.has(this.at(x, y)); }

  roomAt(x, y) {
    return this.rooms.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  }

  generate(opts) {
    const rng = this.rng;
    const venues = rng.shuffle(VENUES).slice(0, 6);

    // ── carve rooms on a loose grid so venues sit apart from each other ──
    const cols = 3, rows = 2;
    const cw = Math.floor(this.w / cols), ch = Math.floor(this.h / rows);
    venues.forEach((v, i) => {
      const cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch;
      const w = rng.range(9, cw - 3);
      const h = rng.range(7, ch - 3);
      const x = cx + rng.range(1, Math.max(1, cw - w - 1));
      const y = cy + rng.range(1, Math.max(1, ch - h - 1));
      const room = { ...v, x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), index: i };
      this.rooms.push(room);
      for (let j = y; j < y + h; j++) {
        for (let k = x; k < x + w; k++) this.set(k, j, v.floor);
      }
      this.decorateRoom(room);
    });

    // ── corridors: connect each room to the next, L-shaped ──
    for (let i = 1; i < this.rooms.length; i++) {
      const a = this.rooms[i - 1], b = this.rooms[i];
      this.corridor(a.cx, a.cy, b.cx, b.cy);
    }
    // one extra loop so the map isn't a pure chain — lets you double back
    const a = this.rooms[0], z = this.rooms[this.rooms.length - 1];
    this.corridor(a.cx, a.cy, z.cx, z.cy);

    // ── walls around everything walkable ──
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.at(x, y) !== T.VOID) continue;
        let touches = false;
        for (let dy = -1; dy <= 1 && !touches; dy++)
          for (let dx = -1; dx <= 1; dx++)
            if (!(dx === 0 && dy === 0) && this.at(x + dx, y + dy) !== T.VOID &&
                this.at(x + dx, y + dy) !== T.WALL) { touches = true; break; }
        if (touches) this.set(x, y, T.WALL);
      }
    }

    // ── spawn point: first room ──
    this.start = { x: this.rooms[0].cx, y: this.rooms[0].cy };

    this.populate(opts.sports || null);
  }

  corridor(x1, y1, x2, y2) {
    const horizFirst = this.rng.chance(0.5);
    const carve = (x, y) => {
      this.set(x, y, this.at(x, y) === T.VOID ? T.CONCRETE : this.at(x, y));
      if (this.at(x, y + 1) === T.VOID) this.set(x, y + 1, T.CONCRETE);
    };
    if (horizFirst) {
      for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) carve(x, y1);
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) carve(x2, y);
    } else {
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) carve(x1, y);
      for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) carve(x, y2);
    }
  }

  decorateRoom(r) {
    const rng = this.rng;
    if (r.id === 'pitch') {
      // centre circle + halfway line, drawn as decor not tiles
      this.decor.push({ x: r.cx, y: r.cy, kind: 'circle' });
      for (let y = r.y; y < r.y + r.h; y++) this.decor.push({ x: r.cx, y, kind: 'line' });
      this.decor.push({ x: r.x, y: r.cy, kind: 'goal' });
      this.decor.push({ x: r.x + r.w - 1, y: r.cy, kind: 'goal' });
    } else if (r.id === 'track') {
      for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
        this.decor.push({ x, y: r.y + 1, kind: 'lane' });
        this.decor.push({ x, y: r.y + r.h - 2, kind: 'lane' });
      }
      const px_ = r.x + 2;
      for (let y = r.y + 2; y < r.y + r.h - 2; y++) this.set(px_, y, T.SAND);
    } else if (r.id === 'club') {
      this.decor.push({ x: r.cx, y: r.cy, kind: 'table' });
      this.decor.push({ x: r.x + 1, y: r.y + 1, kind: 'board' });
    } else if (r.id === 'links') {
      for (let i = 0; i < 3; i++) {
        const x = rng.range(r.x + 1, r.x + r.w - 2), y = rng.range(r.y + 1, r.y + r.h - 2);
        this.decor.push({ x, y, kind: 'hole' });
      }
    } else if (r.id === 'courts') {
      for (let x = r.x + 1; x < r.x + r.w - 1; x++) this.decor.push({ x, y: r.cy, kind: 'net' });
    } else if (r.id === 'hall') {
      this.decor.push({ x: r.cx, y: r.cy, kind: 'ring' });
    } else if (r.id === 'paddock') {
      for (let x = r.x + 1; x < r.x + r.w - 1; x += 2) this.decor.push({ x, y: r.y + 1, kind: 'kerb' });
    }
    // a bit of water in one room, for the lido and for pathing interest
    if (rng.chance(0.3) && r.w > 10 && r.h > 8) {
      const wx = rng.range(r.x + 2, r.x + r.w - 5), wy = rng.range(r.y + 2, r.y + r.h - 4);
      for (let y = wy; y < wy + 2; y++) for (let x = wx; x < wx + 3; x++) this.set(x, y, T.WATER);
    }
  }

  /** Place fighters and pickups, scaling difficulty with distance from home. */
  populate(sportFilter) {
    const rng = this.rng;
    const inFilter = (f) =>
      !sportFilter || sportFilter.length === 0 || f.sport === 'any' || sportFilter.includes(f.sport);

    const pool1 = byTier(1).filter(inFilter).length ? byTier(1).filter(inFilter) : byTier(1);
    const pool2 = byTier(2).filter(inFilter).length ? byTier(2).filter(inFilter) : byTier(2);
    const pool3 = byTier(3).filter(inFilter).length ? byTier(3).filter(inFilter) : byTier(3);
    const bossPool = bosses();

    const freeTileIn = (r, tries = 40) => {
      for (let i = 0; i < tries; i++) {
        const x = rng.range(r.x + 1, r.x + r.w - 2);
        const y = rng.range(r.y + 1, r.y + r.h - 2);
        if (!this.walkable(x, y)) continue;
        if (this.encounters.some((e) => e.x === x && e.y === y)) continue;
        if (this.pickups.some((p) => p.x === x && p.y === y)) continue;
        if (this.start && this.start.x === x && this.start.y === y) continue;
        return { x, y };
      }
      return null;
    };

    this.rooms.forEach((r, i) => {
      const pool = i <= 1 ? pool1 : i <= 3 ? pool2 : pool3;
      const n = i === 0 ? 1 : rng.range(2, 3);
      for (let k = 0; k < n; k++) {
        const spot = freeTileIn(r);
        if (!spot) continue;
        this.encounters.push({
          ...spot, fighter: rng.pick(pool), defeated: false,
          level: 1 + Math.floor(i / 2), venue: r.name,
        });
      }
      const drops = rng.range(1, 2);
      for (let k = 0; k < drops; k++) {
        const spot = freeTileIn(r);
        if (!spot) continue;
        const kinds = Object.keys(PICKUPS);
        this.pickups.push({ ...spot, kind: rng.pick(kinds), taken: false });
      }
    });

    // ── the boss, at the far end, behind the players' tunnel ───────────
    const last = this.rooms[this.rooms.length - 1];
    const bx = last.x + last.w - 2, by = last.cy;
    this.set(bx, by, T.TUNNEL);
    this.boss = {
      x: bx, y: by, fighter: rng.pick(bossPool), defeated: false,
      level: 4, venue: 'THE MAIN ARENA', isBoss: true,
    };
    this.encounters.push(this.boss);
  }

  encounterAt(x, y) {
    return this.encounters.find((e) => e.x === x && e.y === y && !e.defeated);
  }
  pickupAt(x, y) {
    return this.pickups.find((p) => p.x === x && p.y === y && !p.taken);
  }
  remaining() {
    return this.encounters.filter((e) => !e.defeated).length;
  }
}
