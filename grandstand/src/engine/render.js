/**
 * GRANDSTAND — canvas rendering.
 *
 * Internal resolution is a fixed 320x180. Everything is drawn at whole-pixel
 * coordinates, then the canvas is scaled up by an integer factor with
 * image-rendering:pixelated. That integer scale is the single most important
 * line in this file: non-integer scaling is what makes "pixel art" games look
 * like mush.
 */

import { TILE, T } from '../game/map.js';
import { drawFighter, SPRITE_W, SPRITE_H } from './sprites.js';

export const VIEW_W = 320;
export const VIEW_H = 180;

const px = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x | 0, y | 0, w | 0, h | 0); };

export function setupCanvas(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  ctx.imageSmoothingEnabled = false;

  const resize = () => {
    const wrap = canvas.parentElement;
    const scale = Math.min(wrap.clientWidth / VIEW_W, wrap.clientHeight / VIEW_H);
    // Honest tradeoff: snapping to whole-number scales keeps every source pixel
    // exactly square, but on a 420px-wide phone that means scale 1 and a
    // postage-stamp picture with fat black margins. So we fit the space and let
    // image-rendering:pixelated do the snapping. Some source pixels end up one
    // device pixel wider than their neighbours; nobody has ever noticed, and
    // everybody notices a tiny picture.
    canvas.style.width = `${Math.round(VIEW_W * scale)}px`;
    canvas.style.height = `${Math.round(VIEW_H * scale)}px`;
  };
  resize();
  window.addEventListener('resize', resize);
  return { ctx, resize };
}

// ── tile palettes ─────────────────────────────────────────────────────────
const TILE_COLS = {
  [T.VOID]:     ['#16202a', '#18232e'],
  [T.TURF]:     ['#1f7a3d', '#238944'],
  [T.TRACK]:    ['#9a3a24', '#a8422a'],
  [T.CONCRETE]: ['#55566b', '#5d5e75'],
  [T.WALL]:     ['#2a2738', '#333049'],
  [T.WATER]:    ['#1b4f8a', '#2160a3'],
  [T.SAND]:     ['#c9a668', '#d4b174'],
  [T.BAIZE]:    ['#155e39', '#186a41'],
  [T.BOARD]:    ['#b07a3e', '#bd8546'],
  [T.TUNNEL]:   ['#141220', '#1b1830'],
};

export function drawMap(ctx, map, cam, player, t, opts = {}) {
  px(ctx, 0, 0, VIEW_W, VIEW_H, '#0b0a12');

  const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
  const y0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
  const x1 = Math.min(map.w, x0 + Math.ceil(VIEW_W / TILE) + 2);
  const y1 = Math.min(map.h, y0 + Math.ceil(VIEW_H / TILE) + 2);

  // ── floor ──
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const tile = map.at(x, y);
      const sx = x * TILE - cam.x, sy = y * TILE - cam.y;
      const pal = TILE_COLS[tile] || TILE_COLS[T.VOID];
      // checker so mown-grass stripes read at a glance
      const alt = tile === T.TURF ? (x >> 1) % 2 : (x + y) % 2;
      px(ctx, sx, sy, TILE, TILE, pal[alt ? 1 : 0]);

      if (tile === T.VOID) {
        // Scrubland and gravel between the venues, so the complex sits in a
        // place rather than floating in a black hole.
        const seed = (x * 31 + y * 17) % 11;
        if (seed === 0) { px(ctx, sx + 4, sy + 5, 7, 5, '#1f3a2c'); px(ctx, sx + 6, sy + 3, 3, 3, '#2a4d3a'); }
        else if (seed === 3) px(ctx, sx + 9, sy + 9, 3, 2, '#22303d');
        else if (seed === 6) { px(ctx, sx + 2, sy + 10, 4, 1, '#2b3946'); px(ctx, sx + 10, sy + 4, 3, 1, '#2b3946'); }
      } else if (tile === T.WALL) {
        px(ctx, sx, sy, TILE, 3, '#403c5c');
        px(ctx, sx, sy + TILE - 2, TILE, 2, '#17141f');
        // terrace crush barriers
        for (let i = 0; i < 2; i++) px(ctx, sx + 2 + i * 7, sy + 5, 4, 2, '#565179');
      } else if (tile === T.WATER) {
        const wob = Math.sin((x * 3 + y * 2 + t / 18)) > 0 ? 1 : 0;
        px(ctx, sx + 2, sy + 4 + wob, 6, 1, '#5aa6e8');
        px(ctx, sx + 9, sy + 10 - wob, 5, 1, '#5aa6e8');
      } else if (tile === T.TRACK) {
        px(ctx, sx, sy, 1, TILE, '#c9c2b4');
      } else if (tile === T.TUNNEL) {
        px(ctx, sx + 2, sy, TILE - 4, TILE, '#07060d');
        const glow = 6 + Math.sin(t / 12) * 2;
        px(ctx, sx + 5, sy + TILE - glow, 6, glow, '#f7d774');
      }
    }
  }

  // ── pitch markings etc. ──
  for (const d of map.decor) {
    if (d.x < x0 || d.x > x1 || d.y < y0 || d.y > y1) continue;
    const sx = d.x * TILE - cam.x, sy = d.y * TILE - cam.y;
    switch (d.kind) {
      case 'line': px(ctx, sx + 7, sy, 2, TILE, '#dff3e4'); break;
      case 'circle':
        ctx.strokeStyle = '#dff3e4'; ctx.lineWidth = 2;
        ctx.strokeRect(sx - 12, sy - 8, 40, 32); break;
      case 'goal': px(ctx, sx + 4, sy - 6, 3, 28, '#f1f5f9'); break;
      case 'lane': px(ctx, sx, sy + 7, TILE, 1, '#efe7d8'); break;
      case 'net': px(ctx, sx, sy + 6, TILE, 2, '#e2e8f0'); break;
      case 'table':
        px(ctx, sx - 14, sy - 6, 44, 26, '#0f4d2e');
        px(ctx, sx - 14, sy - 6, 44, 2, '#7c3f18');
        px(ctx, sx + 4, sy + 4, 3, 3, '#f8fafc'); break;
      case 'board':
        px(ctx, sx, sy, 12, 12, '#111827');
        px(ctx, sx + 5, sy + 5, 2, 2, '#dc2626'); break;
      case 'hole':
        px(ctx, sx + 6, sy + 7, 4, 3, '#1c1917');
        px(ctx, sx + 7, sy - 4, 1, 11, '#f8fafc');
        px(ctx, sx + 8, sy - 4, 4, 3, '#dc2626'); break;
      case 'ring':
        ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = 2;
        ctx.strokeRect(sx - 16, sy - 12, 44, 36);
        px(ctx, sx - 16, sy + 4, 44, 1, '#dc2626'); break;
      case 'kerb':
        px(ctx, sx, sy, 8, 4, '#dc2626');
        px(ctx, sx + 8, sy, 8, 4, '#f8fafc'); break;
    }
  }

  // ── pickups ──
  for (const p of map.pickups) {
    if (p.taken) continue;
    const sx = p.x * TILE - cam.x, sy = p.y * TILE - cam.y + Math.round(Math.sin(t / 14 + p.x) * 1);
    drawPickup(ctx, p.kind, sx + 3, sy + 3);
  }

  // ── opponents loitering on the map ──
  for (const e of map.encounters) {
    if (e.defeated) continue;
    const sx = e.x * TILE - cam.x, sy = e.y * TILE - cam.y;
    if (sx < -TILE || sy < -TILE || sx > VIEW_W || sy > VIEW_H) continue;
    drawMini(ctx, e.fighter, sx + 1, sy - 4, t + e.x * 9, e.isBoss);
  }

  // ── you ──
  const psx = player.px - cam.x, psy = player.py - cam.y;
  drawMini(ctx, player, psx + 1, psy - 4, t, false, player.facing);

  if (opts.flashVenue) drawVenueBanner(ctx, opts.flashVenue.name, opts.flashVenue.alpha);
}

function drawVenueBanner(ctx, name, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  px(ctx, 0, 70, VIEW_W, 22, '#0b0a12');
  px(ctx, 0, 70, VIEW_W, 1, '#f7d774');
  px(ctx, 0, 91, VIEW_W, 1, '#f7d774');
  ctx.fillStyle = '#f7d774';
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(name, VIEW_W / 2, 85);
  ctx.restore();
}

/** Chibi overworld marker — 14x20, reads clearly at one tile. */
export function drawMini(ctx, f, x, y, t, isBoss = false, facing = 1) {
  const p = f.palette || {};
  const bob = Math.round(Math.sin(t / 10) * 1);
  ctx.save();
  ctx.translate(x + 7, y);
  if (facing < 0) ctx.scale(-1, 1);
  px(ctx, -5, 18, 10, 3, 'rgba(0,0,0,0.35)');       // shadow
  px(ctx, -3, 11 + bob, 6, 7, p.kit || '#1d4ed8');  // body
  px(ctx, -1, 11 + bob, 2, 7, p.trim || '#facc15'); // stripe
  px(ctx, -3, 18 + bob, 2, 3, '#131018');           // legs
  px(ctx, 1, 18 + bob, 2, 3, '#131018');
  px(ctx, -4, 3 + bob, 8, 8, p.skin || '#f3cba4');  // head
  px(ctx, -4, 1 + bob, 8, 4, p.hair || '#4b2e13');  // hair
  px(ctx, 1, 7 + bob, 1, 1, '#131018');             // eyes
  px(ctx, -2, 7 + bob, 1, 1, '#131018');
  if (isBoss) {
    const f2 = Math.sin(t / 8) > 0;
    px(ctx, -5, -4 + bob, 10, 3, f2 ? '#f7d774' : '#dc2626'); // crown / flashbulbs
    px(ctx, -5, -6 + bob, 2, 2, f2 ? '#fff' : '#f7d774');
    px(ctx, 3, -6 + bob, 2, 2, f2 ? '#f7d774' : '#fff');
  }
  ctx.restore();
}

export function drawPickup(ctx, kind, x, y) {
  switch (kind) {
    case 'orange':
      px(ctx, x + 1, y + 1, 8, 8, '#f97316');
      px(ctx, x + 2, y + 2, 3, 2, '#fdba74');
      px(ctx, x + 4, y, 2, 2, '#16a34a'); break;
    case 'bottle':
      px(ctx, x + 3, y, 4, 10, '#f7d774');
      px(ctx, x + 3, y + 3, 4, 4, '#ea580c');
      px(ctx, x + 4, y - 2, 2, 2, '#b45309'); break;
    case 'sponge':
      px(ctx, x, y + 2, 10, 7, '#facc15');
      px(ctx, x + 2, y + 4, 2, 2, '#ca8a04');
      px(ctx, x + 6, y + 5, 2, 2, '#ca8a04'); break;
    case 'pie':
      px(ctx, x, y + 3, 10, 6, '#c2703d');
      px(ctx, x + 1, y + 1, 8, 3, '#e8b877'); break;
    case 'programme':
      px(ctx, x + 1, y, 8, 10, '#f8fafc');
      px(ctx, x + 2, y + 2, 6, 1, '#1d4ed8');
      px(ctx, x + 2, y + 4, 6, 1, '#94a3b8');
      px(ctx, x + 2, y + 6, 4, 1, '#94a3b8'); break;
  }
}

// ── battle scene ──────────────────────────────────────────────────────────

const VENUE_BG = {
  'THE REC':               { ground: '#1f7a3d', ground2: '#238944', sky: '#2a3f6b', crowd: true },
  'THE ATHLETICS TRACK':   { ground: '#9a3a24', ground2: '#a8422a', sky: '#2c4a78', crowd: true },
  'THE SPORTS HALL':       { ground: '#b07a3e', ground2: '#bd8546', sky: '#221c33', crowd: true },
  'THE SNOOKER CLUB':      { ground: '#155e39', ground2: '#186a41', sky: '#18142a', crowd: false },
  'THE MUNICIPAL LINKS':   { ground: '#3f8a3a', ground2: '#48a043', sky: '#3f6ba8', crowd: false },
  'THE TENNIS COURTS':     { ground: '#3b6ca8', ground2: '#4479b8', sky: '#2c4a78', crowd: true },
  'THE PADDOCK':           { ground: '#55566b', ground2: '#5d5e75', sky: '#1f2937', crowd: true },
  'THE MAIN ARENA':        { ground: '#1f7a3d', ground2: '#238944', sky: '#120f1e', crowd: true },
};

export function drawBattleScene(ctx, s, t) {
  const bg = VENUE_BG[s.venue] || VENUE_BG['THE REC'];
  const HORIZON = 96;

  px(ctx, 0, 0, VIEW_W, HORIZON, bg.sky);

  if (bg.crowd) drawCrowd(ctx, HORIZON, t, s.shake);
  else {
    px(ctx, 0, HORIZON - 34, VIEW_W, 34, '#2a2438');
    for (let x = 6; x < VIEW_W; x += 34) px(ctx, x, HORIZON - 28, 22, 16, '#3a3350');
  }

  // ── ground, in bands so it reads as receding ──
  for (let y = HORIZON; y < VIEW_H; y += 6) {
    const band = ((y - HORIZON) / 6) | 0;
    px(ctx, 0, y, VIEW_W, 6, band % 2 ? bg.ground : bg.ground2);
  }
  px(ctx, 0, HORIZON, VIEW_W, 2, '#0d0b14');

  // ── the two of you ──
  // Fighters at 2x. They overlap the horizon on purpose — that's what gives
  // the scene depth and makes a big name feel big.
  const shake = s.shake ? Math.round((Math.random() - 0.5) * s.shake * 4) : 0;
  const SC = 2;
  const feet = 176;
  const top = feet - SPRITE_H * SC;

  if (s.foe) {
    drawFighter(ctx, s.foe, 200 + (s.foeFlash ? shake : 0), top, {
      facing: -1, t, flash: s.foeFlash > 0, down: s.foeDown,
      wind: s.foeWind || 0, scale: SC,
    });
  }
  if (s.player) {
    drawFighter(ctx, s.player, 52 + (s.playerFlash ? shake : 0), top, {
      facing: 1, t, flash: s.playerFlash > 0, down: s.playerDown,
      wind: s.playerWind || 0, scale: SC,
    });
  }

  // ── floating damage numbers ──
  for (const f of s.floaters) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life / 40));
    ctx.font = `${f.big ? 16 : 10}px "Press Start 2P", monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';
    ctx.fillText(f.text, f.x + 1, f.y + 1);
    ctx.fillStyle = f.colour;
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  }
}

function drawCrowd(ctx, horizon, t, shake = 0) {
  const COLS = ['#c9403a', '#3b6ca8', '#d8a53a', '#3f9a5c', '#8b5cf6', '#e2e8f0', '#e06a2b'];
  px(ctx, 0, horizon - 52, VIEW_W, 52, '#1a1628');
  for (let row = 0; row < 6; row++) {
    const y = horizon - 50 + row * 8;
    for (let x = -4; x < VIEW_W + 4; x += 7) {
      const seed = (x * 13 + row * 7) % 97;
      // a Mexican wave, because of course
      const wave = Math.sin(t / 9 - x / 26 + row * 0.4) > 0.75 ? -2 : 0;
      const jitter = shake ? Math.round((Math.random() - 0.5) * 2) : 0;
      px(ctx, x + jitter, y + wave, 5, 6, COLS[seed % COLS.length]);
      px(ctx, x + 1 + jitter, y - 2 + wave, 3, 3, seed % 3 ? '#e8b48a' : '#7a4a21');
    }
  }
  // roof girders and floodlight spill
  px(ctx, 0, horizon - 54, VIEW_W, 4, '#0f0d18');
  for (let x = 10; x < VIEW_W; x += 60) px(ctx, x, horizon - 58, 8, 5, '#fef3c7');
}

/** Title-screen backdrop: a floodlit pitch at night. */
export function drawTitleScene(ctx, t) {
  px(ctx, 0, 0, VIEW_W, VIEW_H, '#0a0914');
  for (let i = 0; i < 40; i++) {
    const x = (i * 71) % VIEW_W, y = (i * 37) % 60;
    if (Math.sin(t / 30 + i) > 0.3) px(ctx, x, y, 1, 1, '#4b4468');
  }
  drawCrowd(ctx, 110, t, 0);
  for (let y = 110; y < VIEW_H; y += 6) {
    px(ctx, 0, y, VIEW_W, 6, ((y - 110) / 6) % 2 ? '#1f7a3d' : '#238944');
  }
  px(ctx, 0, 110, VIEW_W, 2, '#0d0b14');
  // floodlight cones
  ctx.save();
  ctx.globalAlpha = 0.10 + Math.sin(t / 40) * 0.02;
  ctx.fillStyle = '#fef3c7';
  ctx.beginPath(); ctx.moveTo(28, 46); ctx.lineTo(-30, VIEW_H); ctx.lineTo(130, VIEW_H); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(292, 46); ctx.lineTo(190, VIEW_H); ctx.lineTo(350, VIEW_H); ctx.closePath(); ctx.fill();
  ctx.restore();
  px(ctx, 24, 40, 10, 7, '#fef3c7');
  px(ctx, 288, 40, 10, 7, '#fef3c7');
  px(ctx, 28, 47, 2, 14, '#3a3350');
  px(ctx, 292, 47, 2, 14, '#3a3350');
}

/** Wordmark, drawn in the night sky above the stand so it stays readable. */
export function drawTitleWordmark(ctx, t) {
  const bounce = Math.round(Math.sin(t / 34) * 1);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '16px "Press Start 2P", monospace';
  ctx.fillStyle = '#c9403a';
  ctx.fillText('GRANDSTAND', VIEW_W / 2 + 2, 26 + bounce);
  ctx.fillStyle = '#f7d774';
  ctx.fillText('GRANDSTAND', VIEW_W / 2, 24 + bounce);
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.fillStyle = '#0b0a12';
  ctx.fillText('TRIVIA ATHLETIC', VIEW_W / 2 + 1, 41 + bounce);
  ctx.fillStyle = '#e8e3f5';
  ctx.fillText('TRIVIA ATHLETIC', VIEW_W / 2, 40 + bounce);
  ctx.restore();
}

/**
 * Minimap. The complex is 46x34 tiles and the viewport shows about 20x11, so
 * without this you are wandering a car park in the dark. Only rooms you have
 * actually set foot in are filled in.
 */
export function drawMinimap(c, map, player, visited, cell = 3) {
  c.fillStyle = '#0b0a12';
  c.fillRect(0, 0, map.w * cell, map.h * cell);

  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      const tile = map.at(x, y);
      if (tile === T.VOID) continue;
      const room = map.roomAt(x, y);
      const seen = !room || visited.has(room.id);
      if (tile === T.WALL) { px(c, x * cell, y * cell, cell, cell, '#241f36'); continue; }
      px(c, x * cell, y * cell, cell, cell, seen ? '#3b5a48' : '#1c2130');
    }
  }

  for (const p of map.pickups) {
    if (p.taken) continue;
    const room = map.roomAt(p.x, p.y);
    if (room && !visited.has(room.id)) continue;
    px(c, p.x * cell, p.y * cell, cell, cell, '#4ade80');
  }
  for (const e of map.encounters) {
    if (e.defeated) continue;
    const room = map.roomAt(e.x, e.y);
    if (room && !visited.has(room.id) && !e.isBoss) continue;
    px(c, e.x * cell - 1, e.y * cell - 1, cell + 2, cell + 2, e.isBoss ? '#f7d774' : '#f87171');
  }
  px(c, player.x * cell - 1, player.y * cell - 1, cell + 2, cell + 2, '#ffffff');
}
