/**
 * GRANDSTAND — procedural pixel sprites.
 *
 * Every fighter is drawn from the same humanoid template, varied by palette,
 * build and one held item. No image assets: it all comes out of fillRect at
 * 1:1 pixel scale on the 320x180 internal canvas, which is then scaled up with
 * image-rendering:pixelated. That is what makes it look like 1991 rather than
 * a phone game pretending to.
 */

import { BUILD } from '../data/roster.js';

export const SPRITE_W = 34;
export const SPRITE_H = 46;

const px = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x | 0, y | 0, w | 0, h | 0); };

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (n & 255) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const OUTLINE = '#131018';

/**
 * @param {CanvasRenderingContext2D} c
 * @param {object} f      fighter (needs .palette, .build, .gear)
 * @param {number} ox,oy  top-left of the sprite box
 * @param {object} opts   { facing:1|-1, t:frameCount, flash:bool, down:bool,
 *                          wind:0..1 (attack wind-up), scale:1 }
 */
export function drawFighter(c, f, ox, oy, opts = {}) {
  const { facing = 1, t = 0, flash = false, down = false, wind = 0, scale = 1 } = opts;
  const p = f.palette || {};
  const skin = flash ? '#ffffff' : (p.skin || '#f3cba4');
  const kit = flash ? '#ffffff' : (p.kit || '#1d4ed8');
  const trim = flash ? '#ffffff' : (p.trim || '#facc15');
  const hair = flash ? '#ffffff' : (p.hair || '#4b2e13');
  const skinDark = flash ? '#ffffff' : shade(skin, -34);
  const kitDark = flash ? '#ffffff' : shade(kit, -34);

  c.save();
  c.translate(ox + (SPRITE_W * scale) / 2, oy);
  if (scale !== 1) c.scale(scale, scale);   // integer scales only, or it turns to mush
  if (facing < 0) c.scale(-1, 1);

  if (down) {
    // Stretchered off: rotate the whole body flat on the deck.
    c.translate(-4, 34);
    c.rotate(-Math.PI / 2);
  }

  // Gentle idle bob, plus a lean into an attack wind-up.
  const bob = down ? 0 : Math.round(Math.sin(t / 16) * 1);
  const lean = Math.round(wind * 4);
  const W = f.build === BUILD.HEAVY ? 7 : f.build === BUILD.LEAN ? 4 : 5; // half-width of torso

  // ── legs ──────────────────────────────────────────────────────────
  const stride = down ? 0 : Math.round(Math.sin(t / 16) * 1);
  px(c, -W + 1, 32, 3, 9, skin);                 // back leg
  px(c, W - 4, 32 + stride, 3, 9 - stride, skin); // front leg
  px(c, -W + 1, 41, 4, 3, OUTLINE);               // boots
  px(c, W - 5, 41, 5, 3, OUTLINE);
  px(c, W - 5, 41, 5, 1, trim);

  // ── shorts ────────────────────────────────────────────────────────
  px(c, -W, 27 + bob, W * 2, 6, kitDark);
  px(c, -W, 27 + bob, W * 2, 1, trim);

  // ── torso ─────────────────────────────────────────────────────────
  px(c, -W, 15 + bob, W * 2, 13, kit);
  px(c, -W, 15 + bob, 2, 13, kitDark);            // shadow side
  px(c, -1, 15 + bob, 2, 13, trim);               // centre stripe
  px(c, -W, 15 + bob, W * 2, 1, trim);            // collar line

  // ── arms ──────────────────────────────────────────────────────────
  const armY = 16 + bob;
  px(c, -W - 3, armY, 3, 11, skin);               // back arm
  if (wind > 0.4) {
    // cocked, ready to throw hands
    px(c, W, armY - 3 + lean, 3, 6, skin);
    px(c, W + 2, armY - 5 + lean, 4, 4, skin);
  } else {
    px(c, W, armY, 3, 11, skin);
    px(c, W, armY + 9, 3, 3, skinDark);
  }

  // ── head ──────────────────────────────────────────────────────────
  const hy = 4 + bob;
  px(c, -5, hy, 10, 11, skin);
  px(c, -5, hy, 2, 11, skinDark);
  px(c, 1, hy + 5, 2, 2, OUTLINE);                // eye
  px(c, -3, hy + 5, 2, 2, OUTLINE);
  px(c, 0, hy + 8, 4, 1, skinDark);               // mouth
  px(c, -5, hy - 2, 10, 4, hair);                 // hair
  px(c, 3, hy - 2, 2, 6, hair);                   // sideburn, obviously
  px(c, -5, hy - 3, 10, 1, shade(hair, -30));

  drawGear(c, f.gear, W, bob, wind, { skin, trim, kit, flash });
  c.restore();
}

function drawGear(c, gear, W, bob, wind, cols) {
  const { trim, flash } = cols;
  const col = (x) => (flash ? '#ffffff' : x);
  const hx = W + 3;          // hand x
  const hy = 18 + bob;       // hand y
  switch (gear) {
    case 'gloves':
      px(c, hx - 1, hy + 6 - wind * 8, 6, 6, col('#dc2626'));
      px(c, hx - 1, hy + 6 - wind * 8, 6, 2, col('#f87171'));
      px(c, -W - 5, hy + 8, 5, 5, col('#dc2626'));
      break;
    case 'cue':
      px(c, hx - 8, hy - 8, 1, 26, col('#c8a06a'));
      px(c, hx - 8, hy - 8, 1, 4, col('#1f2937'));
      break;
    case 'bat':
      px(c, hx + 1, hy - 10, 4, 14, col('#e8c48a'));
      px(c, hx + 2, hy + 4, 2, 8, col('#a1642a'));
      break;
    case 'racket':
      px(c, hx + 1, hy - 12, 7, 9, col('#f8fafc'));
      px(c, hx + 2, hy - 11, 5, 7, col('#334155'));
      px(c, hx + 3, hy - 3, 2, 7, col('#e8c48a'));
      break;
    case 'javelin':
      px(c, hx - 12, hy - 2, 26, 1, col('#d4d4d8'));
      px(c, hx + 12, hy - 3, 3, 3, col('#f87171'));
      break;
    case 'ball':
      px(c, hx - 2, 38, 7, 7, col('#f8fafc'));
      px(c, hx, 40, 3, 3, col('#111827'));
      break;
    case 'skis':
      px(c, -W - 8, 43, 24, 2, col('#dbeafe'));
      px(c, W + 12, 41, 4, 2, col('#1d4ed8'));
      break;
    case 'dart':
      px(c, hx, hy - 1, 6, 1, col('#cbd5e1'));
      px(c, hx + 5, hy - 2, 2, 3, col('#22c55e'));
      break;
    case 'club':
      px(c, hx + 2, hy - 12, 1, 18, col('#94a3b8'));
      px(c, hx + 1, hy + 5, 4, 3, col('#64748b'));
      break;
    case 'helmet':
      px(c, -6, 2 + bob, 12, 7, col('#dc2626'));
      px(c, -6, 6 + bob, 12, 2, col('#1f2937'));
      px(c, -6, 1 + bob, 12, 1, col('#f8fafc'));
      break;
    case 'baton':
      px(c, hx, hy + 6, 6, 2, col(trim));
      break;
    case 'mic':
      px(c, hx + 1, hy - 4, 3, 7, col('#334155'));
      px(c, hx, hy - 6, 5, 3, col('#9ca3af'));
      break;
    case 'clipboard':
      px(c, hx, hy + 2, 7, 9, col('#f8fafc'));
      px(c, hx + 1, hy + 4, 5, 1, col('#94a3b8'));
      px(c, hx + 1, hy + 6, 5, 1, col('#94a3b8'));
      px(c, hx + 2, hy + 1, 3, 2, col('#a16207'));
      break;
    default:
      break;
  }
}

/** A tiny 12x12 portrait version for the codex / league table. */
export function drawPortrait(c, f, ox, oy, size = 24) {
  const p = f.palette || {};
  c.save();
  c.translate(ox, oy);
  const s = size / 12;
  c.scale(s, s);
  px(c, 0, 0, 12, 12, '#1a1726');
  px(c, 1, 8, 10, 4, p.kit || '#1d4ed8');
  px(c, 4, 8, 4, 4, p.trim || '#facc15');
  px(c, 2, 2, 8, 7, p.skin || '#f3cba4');
  px(c, 2, 1, 8, 3, p.hair || '#4b2e13');
  px(c, 4, 5, 1, 1, '#131018');
  px(c, 7, 5, 1, 1, '#131018');
  c.restore();
}
