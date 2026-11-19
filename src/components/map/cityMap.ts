// İzometrik şehir haritası: tüm grafikler kodla çizilir (harici görsel yok).
import { mulberry32 as mulberry } from '@/engine/core';

export interface MapBuilding {
  id: string;
  bx: number;
  by: number;
  icon: string;
  label: string;
}

type Pt = [number, number];
interface Obj {
  depth: number;
  layer?: 0;
  b?: MapBuilding & { X: number; Y: number };
  top?: number;
  hit?: { x: number; y: number; r: number };
  draw: (t: number) => void;
}
interface Car { axis: 'x' | 'y'; lane: number; p: number; v: number; color: string }

const TW = 64, TH = 32;
const MIN = -4, MAX = 21;
const PARKS: Pt[] = [[0, 3], [3, 3]];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const iso = (x: number, y: number, z = 0): Pt => [((x - y) * TW) / 2, ((x + y) * TH) / 2 - z];

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; } else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export function createCityMap(canvas: HTMLCanvasElement, buildings: MapBuilding[], onSelect: (id: string) => void) {
  const ctx = canvas.getContext('2d')!;
  let W = 0, H = 0, DPR = 1;
  const cam = { x: 0, y: 256, zoom: 1 };
  let objects: Obj[] = [];
  let cars: Car[] = [];
  let lamps: Pt[] = [];
  let hover: MapBuilding | null = null, pressed: MapBuilding | null = null, pulse: MapBuilding | null = null;
  let pulseT = 0, tint = 'rgba(0,0,0,0)', raf = 0, alive = true;
  const placed = buildings.map((b) => ({ ...b, X: b.bx * 4 + 1, Y: b.by * 4 + 1 }));

  // ---------------------------------------------------------------- çizim yardımcıları
  function poly(pts: Pt[], fill?: string | null, stroke?: string | null) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }
  function box(x0: number, y0: number, x1: number, y1: number, z: number, h: number, c: string,
    o: { top?: string; left?: string; right?: string; edge?: boolean } = {}) {
    poly([iso(x0, y1, z), iso(x1, y1, z), iso(x1, y1, z + h), iso(x0, y1, z + h)], o.left ?? c);
    poly([iso(x1, y0, z), iso(x1, y1, z), iso(x1, y1, z + h), iso(x1, y0, z + h)], o.right ?? shade(c, -0.3));
    poly([iso(x0, y0, z + h), iso(x1, y0, z + h), iso(x1, y1, z + h), iso(x0, y1, z + h)], o.top ?? shade(c, 0.12),
      o.edge === false ? null : 'rgba(0,0,0,0.18)');
  }
  function windows(x0: number, y0: number, x1: number, y1: number, z: number, h: number,
    o: { rows: number; colsL: number; colsR: number; seed: number; lit?: string; litRate?: number }) {
    const rand = mulberry(o.seed);
    const lit = o.lit ?? '#ffd66b', dark = 'rgba(20,24,40,0.75)', rate = o.litRate ?? 0.45;
    const vh = h / o.rows;
    for (let r = 0; r < o.rows; r++) {
      const za = z + r * vh + vh * 0.28, zb = z + (r + 1) * vh - vh * 0.18;
      const wl = (x1 - x0) / o.colsL;
      for (let c = 0; c < o.colsL; c++) {
        const ua = x0 + c * wl + wl * 0.25, ub = x0 + (c + 1) * wl - wl * 0.25;
        poly([iso(ua, y1, za), iso(ub, y1, za), iso(ub, y1, zb), iso(ua, y1, zb)], rand() < rate ? lit : dark);
      }
      const wr = (y1 - y0) / o.colsR;
      for (let c = 0; c < o.colsR; c++) {
        const ua = y0 + c * wr + wr * 0.25, ub = y0 + (c + 1) * wr - wr * 0.25;
        poly([iso(x1, ua, za), iso(x1, ub, za), iso(x1, ub, zb), iso(x1, ua, zb)], rand() < rate ? shade(lit, -0.2) : dark);
      }
    }
  }
  function gableRoof(x0: number, y0: number, x1: number, y1: number, z: number, rh: number, c: string) {
    const ym = (y0 + y1) / 2;
    poly([iso(x0, y0, z), iso(x1, y0, z), iso(x1, ym, z + rh), iso(x0, ym, z + rh)], shade(c, -0.15));
    poly([iso(x1, y0, z), iso(x1, y1, z), iso(x1, ym, z + rh)], shade(c, -0.35));
    poly([iso(x0, y1, z), iso(x1, y1, z), iso(x1, ym, z + rh), iso(x0, ym, z + rh)], c, 'rgba(0,0,0,0.2)');
  }
  const flat = (x0: number, y0: number, x1: number, y1: number, z: number, fill: string, stroke?: string) =>
    poly([iso(x0, y0, z), iso(x1, y0, z), iso(x1, y1, z), iso(x0, y1, z)], fill, stroke);
  function line(a: Pt, b: Pt, color: string, w = 1) {
    ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  function dot(p: Pt, r: number, color: string) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 7); ctx.fill();
  }
  function sign(at: Pt, text: string, color: string, size: number) {
    ctx.save(); ctx.translate(at[0], at[1]); ctx.transform(1, -0.5, 0, 1, 0, 0);
    ctx.fillStyle = color; ctx.font = `bold ${size}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(text, 0, 2);
    ctx.restore();
  }
  function tree(x: number, y: number, s = 1, tintAmt = 0) {
    const [px, py] = iso(x, y, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(px, py, 9 * s, 4.5 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#5b3d26'; ctx.fillRect(px - 1.5 * s, py - 9 * s, 3 * s, 9 * s);
    dot([px, py - 13 * s], 9 * s, shade('#2f6b34', tintAmt));
    dot([px - 2 * s, py - 16 * s], 7 * s, shade('#3a7d3a', tintAmt));
    dot([px - 3.5 * s, py - 18.5 * s], 3.5 * s, shade('#4f9444', tintAmt));
  }
  function lamp(x: number, y: number) {
    const [bx, by] = iso(x, y, 3);
    line([bx, by], [bx, by - 24], '#2a2d3a', 2);
    dot([bx, by - 25], 2.6, '#fff3c4');
  }
  function carShape(x: number, y: number, axis: 'x' | 'y', color: string) {
    const L = 0.55, Wd = 0.28;
    const [x0, y0, x1, y1] = axis === 'x' ? [x, y, x + L, y + Wd] : [x, y, x + Wd, y + L];
    box(x0, y0, x1, y1, 1, 5, color, { edge: false });
    const r = axis === 'x' ? [x0 + 0.15, y0 + 0.03, x1 - 0.12, y1 - 0.03] : [x0 + 0.03, y0 + 0.15, x1 - 0.03, y1 - 0.12];
    box(r[0], r[1], r[2], r[3], 6, 3.5, color, { top: shade(color, 0.35), left: '#9cc3e6', right: '#6e98c0', edge: false });
  }
  function smallHouse(x0: number, y0: number, x1: number, y1: number, rnd: () => number) {
    const walls = ['#c9b79c', '#b7c4cf', '#d8c3a5', '#a9b8a0', '#c7a99a'];
    const roofs = ['#8e3b2f', '#4c5b78', '#6d4a33', '#3f6a4a'];
    const h = 10 + rnd() * 8;
    box(x0, y0, x1, y1, 3, h, walls[Math.floor(rnd() * walls.length)]);
    windows(x0, y0, x1, y1, 3, h, { rows: 1, colsL: 2, colsR: 2, seed: Math.floor(rnd() * 1000), litRate: 0.5 });
    gableRoof(x0 - 0.05, y0 - 0.05, x1 + 0.05, y1 + 0.05, 3 + h, 8, roofs[Math.floor(rnd() * roofs.length)]);
  }
  function tower(x0: number, y0: number, x1: number, y1: number, h: number, seed: number) {
    const tones = ['#565b70', '#4b5064', '#5f6378', '#454a5c'];
    const r = mulberry(seed);
    const c = tones[Math.floor(r() * tones.length)];
    box(x0, y0, x1, y1, 3, h, c);
    windows(x0, y0, x1, y1, 3, h, { rows: Math.max(2, Math.round(h / 11)), colsL: 3, colsR: 3, seed, litRate: 0.32 });
    box(x0 + 0.1, y0 + 0.1, x1 - 0.1, y1 - 0.1, 3 + h, 2, shade(c, -0.2));
    if (r() < 0.4) box(x0 + 0.3, y0 + 0.3, x0 + 0.6, y0 + 0.6, 5 + h, 5, '#3a3e4e');
  }

  // ---------------------------------------------------------------- binalar (blok 3x3, X/Y köşe)
  const DRAW: Record<string, (X: number, Y: number, t: number) => number> = {
    jail(X, Y) {
      flat(X + 0.2, Y + 0.2, X + 2.8, Y + 2.8, 3, '#5d6170');
      box(X + 0.6, Y + 0.6, X + 2.4, Y + 2.2, 3, 30, '#8a8e9c');
      windows(X + 0.6, Y + 0.6, X + 2.4, Y + 2.2, 3, 30, { rows: 3, colsL: 5, colsR: 4, seed: 11, lit: '#b9c2d8', litRate: 0.3 });
      for (let i = 0; i <= 12; i++) {
        const u = 0.2 + (i * 2.6) / 12;
        line(iso(X + u, Y + 2.8, 3), iso(X + u, Y + 2.8, 12), 'rgba(30,30,40,0.8)');
        line(iso(X + 2.8, Y + u, 3), iso(X + 2.8, Y + u, 12), 'rgba(30,30,40,0.8)');
      }
      box(X + 2.25, Y + 2.25, X + 2.7, Y + 2.7, 3, 34, '#6c7080');
      box(X + 2.15, Y + 2.15, X + 2.8, Y + 2.8, 37, 7, '#4a4e5c');
      dot(iso(X + 2.47, Y + 2.47, 48), 2.5, 'rgba(255,240,170,0.9)');
      return 48;
    },
    casino(X, Y, t) {
      box(X + 0.35, Y + 0.35, X + 2.65, Y + 2.65, 3, 26, '#5b2a7a');
      windows(X + 0.35, Y + 0.35, X + 2.65, Y + 2.65, 3, 26, { rows: 2, colsL: 5, colsR: 5, seed: 22, lit: '#ff7ad9', litRate: 0.6 });
      const [cx, cy] = iso(X + 1.5, Y + 1.5, 29);
      ctx.fillStyle = '#d9a52b'; ctx.beginPath(); ctx.ellipse(cx, cy, 22, 11, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#f2c94c'; ctx.beginPath(); ctx.arc(cx, cy - 6, 14, Math.PI, 0); ctx.fill();
      dot([cx - 4, cy - 12], 3, '#fff1a8');
      for (let i = 0; i < 14; i++) {
        const on = (i + Math.floor(t / 250)) % 3 === 0;
        const u = 0.35 + ((i + 0.5) * 2.3) / 14;
        dot(iso(X + u, Y + 2.65, 29), 1.8, on ? '#fff36b' : '#ff4fb8');
        dot(iso(X + 2.65, Y + u, 29), 1.8, !on ? '#fff36b' : '#ff4fb8');
      }
      return 52;
    },
    heists(X, Y) {
      flat(X + 0.15, Y + 0.15, X + 2.85, Y + 2.85, 3, '#4a4d58');
      // testere dişli çatılı depo
      box(X + 0.3, Y + 0.3, X + 2.7, Y + 1.7, 3, 20, '#7d6a55');
      windows(X + 0.3, Y + 0.3, X + 2.7, Y + 1.7, 3, 20, { rows: 1, colsL: 6, colsR: 3, seed: 5, lit: '#ffc56b', litRate: 0.4 });
      for (let i = 0; i < 4; i++) {
        const x0 = X + 0.3 + i * 0.6, x1 = x0 + 0.6;
        poly([iso(x0, Y + 0.3, 23), iso(x0, Y + 1.7, 23), iso(x1, Y + 1.7, 31), iso(x1, Y + 0.3, 31)], '#5f5244', 'rgba(0,0,0,0.2)');
        poly([iso(x1, Y + 0.3, 23), iso(x1, Y + 1.7, 23), iso(x1, Y + 1.7, 31), iso(x1, Y + 0.3, 31)], '#9fc4d8');
      }
      box(X + 0.4, Y + 2.0, X + 1.5, Y + 2.55, 3, 11, '#2c6a8a');
      box(X + 1.7, Y + 2.0, X + 2.1, Y + 2.4, 3, 6, '#86663a');
      box(X + 2.2, Y + 2.1, X + 2.6, Y + 2.5, 3, 6, '#7a5a32');
      box(X + 1.9, Y + 2.15, X + 2.3, Y + 2.55, 9, 6, '#86663a');
      return 34;
    },
    travel(X, Y) {
      flat(X + 0.1, Y + 0.1, X + 2.9, Y + 2.9, 3, '#4b4f60');
      ctx.setLineDash([6, 6]);
      line(iso(X + 0.3, Y + 2.5, 3), iso(X + 2.7, Y + 2.5, 3), 'rgba(255,255,255,0.6)', 1.5);
      ctx.setLineDash([]);
      box(X + 0.3, Y + 0.3, X + 2.0, Y + 1.9, 3, 18, '#9fb7cf');
      windows(X + 0.3, Y + 0.3, X + 2.0, Y + 1.9, 3, 18, { rows: 1, colsL: 6, colsR: 6, seed: 33, lit: '#cfe8ff', litRate: 0.85 });
      box(X + 0.3, Y + 0.3, X + 2.0, Y + 1.9, 21, 3, '#d8dde6');
      box(X + 2.15, Y + 0.45, X + 2.55, Y + 0.85, 3, 46, '#c9ced8');
      box(X + 2.0, Y + 0.3, X + 2.7, Y + 1.0, 49, 9, '#5a7fa8', { top: '#e6e9ef' });
      windows(X + 2.0, Y + 0.3, X + 2.7, Y + 1.0, 49, 9, { rows: 1, colsL: 3, colsR: 3, seed: 3, lit: '#bfe3ff', litRate: 1 });
      dot(iso(X + 2.35, Y + 0.65, 62), 2.2, '#ff4040');
      const [px, py] = iso(X + 1.1, Y + 2.45, 4);
      ctx.fillStyle = '#eef1f6';
      ctx.beginPath(); ctx.ellipse(px, py, 16, 4, 0.46, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px - 4, py - 1); ctx.lineTo(px + 6, py - 11); ctx.lineTo(px + 9, py - 9); ctx.lineTo(px + 3, py + 2); ctx.fill();
      return 64;
    },
    shop(X, Y) {
      box(X + 0.5, Y + 0.5, X + 2.5, Y + 2.4, 3, 22, '#4d5a3c');
      windows(X + 0.5, Y + 0.5, X + 2.5, Y + 2.4, 3, 22, { rows: 2, colsL: 4, colsR: 3, seed: 44, litRate: 0.35 });
      box(X + 0.5, Y + 0.5, X + 2.5, Y + 2.4, 25, 3, '#3a4430');
      box(X + 0.9, Y + 2.4, X + 2.1, Y + 2.48, 14, 7, '#b0291f');
      sign(iso(X + 1.5, Y + 2.48, 17.5), 'SİLAH', '#ffe9b0', 6);
      box(X + 2.55, Y + 2.0, X + 2.85, Y + 2.3, 3, 6, '#7a5a32');
      box(X + 2.55, Y + 2.35, X + 2.85, Y + 2.65, 3, 6, '#86663a');
      return 32;
    },
    crimes(X, Y) {
      box(X + 0.5, Y + 0.6, X + 2.5, Y + 2.4, 3, 18, '#8a5a35');
      windows(X + 0.5, Y + 0.6, X + 2.5, Y + 2.4, 3, 18, { rows: 1, colsL: 4, colsR: 3, seed: 55, lit: '#ffb347', litRate: 0.9 });
      gableRoof(X + 0.4, Y + 0.5, X + 2.6, Y + 2.5, 21, 14, '#e2892e');
      dot(iso(X + 1.5, Y + 2.4, 12), 2, 'rgba(255,190,90,0.9)');
      box(X + 0.7, Y + 2.55, X + 0.95, Y + 2.8, 3, 4, '#5c3a20');
      box(X + 2.0, Y + 2.55, X + 2.25, Y + 2.8, 3, 4, '#5c3a20');
      return 40;
    },
    hospital(X, Y) {
      box(X + 0.45, Y + 0.45, X + 2.55, Y + 2.55, 3, 32, '#e9ecf1');
      windows(X + 0.45, Y + 0.45, X + 2.55, Y + 2.55, 3, 32, { rows: 4, colsL: 5, colsR: 5, seed: 66, lit: '#bfe6ff', litRate: 0.55 });
      flat(X + 1.3, Y + 0.9, X + 1.7, Y + 2.1, 35.2, '#d8343a');
      flat(X + 0.9, Y + 1.3, X + 2.1, Y + 1.7, 35.2, '#d8343a');
      box(X + 2.6, Y + 1.0, X + 2.9, Y + 1.6, 3, 6, '#ffffff');
      flat(X + 2.6, Y + 1.2, X + 2.9, Y + 1.35, 9.2, '#d8343a');
      return 40;
    },
    properties(X, Y) {
      const spots: Pt[] = [[0.3, 0.3], [1.6, 0.3], [0.3, 1.6], [1.6, 1.6]];
      spots.forEach(([dx, dy], i) => smallHouse(X + dx, Y + dy, X + dx + 1.0, Y + dy + 1.0, mulberry(900 + i * 17)));
      return 32;
    },
    gym(X, Y) {
      box(X + 0.4, Y + 0.5, X + 2.6, Y + 2.4, 3, 20, '#2e5d9c');
      windows(X + 0.4, Y + 0.5, X + 2.6, Y + 2.4, 3, 20, { rows: 1, colsL: 3, colsR: 3, seed: 77, lit: '#d9f0ff', litRate: 1 });
      const [cx, cy] = iso(X + 1.5, Y + 1.45, 23);
      ctx.fillStyle = '#3b74bf'; ctx.beginPath(); ctx.ellipse(cx, cy, 34, 13, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#5d93d8'; ctx.beginPath(); ctx.ellipse(cx - 4, cy - 2, 22, 8, 0, Math.PI, 0); ctx.fill();
      const [dx, dy] = iso(X + 2.75, Y + 2.7, 5);
      ctx.fillStyle = '#222'; ctx.fillRect(dx - 7, dy - 1, 14, 2); ctx.fillRect(dx - 8, dy - 4, 3, 8); ctx.fillRect(dx + 5, dy - 4, 3, 8);
      return 38;
    },
    bank(X, Y) {
      box(X + 0.4, Y + 0.4, X + 2.6, Y + 2.3, 3, 24, '#d9cfb8');
      windows(X + 0.4, Y + 0.4, X + 2.6, Y + 2.3, 3, 24, { rows: 2, colsL: 4, colsR: 4, seed: 88, lit: '#ffe9a8', litRate: 0.5 });
      box(X + 0.35, Y + 0.35, X + 2.65, Y + 2.4, 27, 4, '#bfb398');
      for (let i = 0; i < 5; i++) { const x = X + 0.55 + i * 0.47; box(x, Y + 2.42, x + 0.14, Y + 2.56, 3, 22, '#f2ece0'); }
      box(X + 0.4, Y + 2.3, X + 2.6, Y + 2.65, 25, 3, '#c9bc9f');
      box(X + 1.0, Y + 2.65, X + 2.0, Y + 2.7, 15, 6, '#d9a52b');
      sign(iso(X + 1.5, Y + 2.7, 18), 'BANKA', '#3a2b06', 5);
      return 34;
    },
    cars(X, Y) {
      flat(X + 0.2, Y + 0.2, X + 2.8, Y + 2.8, 3, '#55596a');
      box(X + 0.4, Y + 0.4, X + 2.6, Y + 1.9, 3, 18, '#9b5b3b');
      for (let k = 0; k < 3; k++) {
        const x0 = X + 0.55 + k * 0.7, x1 = x0 + 0.5;
        poly([iso(x0, Y + 1.9, 3), iso(x1, Y + 1.9, 3), iso(x1, Y + 1.9, 13), iso(x0, Y + 1.9, 13)], '#c8ccd4');
        for (let s = 1; s < 5; s++) line(iso(x0, Y + 1.9, 3 + s * 2), iso(x1, Y + 1.9, 3 + s * 2), 'rgba(60,60,70,0.5)');
      }
      box(X + 0.4, Y + 0.4, X + 2.6, Y + 1.9, 21, 3, '#7a432a');
      carShape(X + 0.6, Y + 2.25, 'x', '#c8302f');
      carShape(X + 1.6, Y + 2.25, 'x', '#4c6fa8');
      return 32;
    },
    smuggling(X, Y) {
      flat(X + 0.2, Y + 0.2, X + 2.8, Y + 2.8, 3, '#4e4a44');
      box(X + 0.3, Y + 0.3, X + 1.4, Y + 0.85, 3, 11, '#a33b2a');
      box(X + 0.3, Y + 0.3, X + 1.4, Y + 0.85, 14, 11, '#2c6a8a');
      box(X + 1.6, Y + 0.3, X + 2.7, Y + 0.85, 3, 11, '#3e7a3a');
      box(X + 0.3, Y + 1.1, X + 1.4, Y + 1.65, 3, 11, '#b8862c');
      box(X + 1.5, Y + 1.3, X + 2.7, Y + 2.6, 3, 1, '#3a352e');
      poly([iso(X + 1.5, Y + 1.3, 16), iso(X + 2.7, Y + 1.3, 16), iso(X + 2.7, Y + 2.6, 12), iso(X + 1.5, Y + 2.6, 12)], '#7d2d6b');
      for (const [px, py] of [[1.55, 2.55], [2.65, 2.55], [2.65, 1.35]]) line(iso(X + px, Y + py, 3), iso(X + px, Y + py, py > 2 ? 12 : 16), '#2a2520', 1.5);
      box(X + 0.4, Y + 2.0, X + 0.7, Y + 2.3, 3, 5, '#86663a');
      box(X + 0.8, Y + 2.1, X + 1.1, Y + 2.4, 3, 5, '#7a5a32');
      return 30;
    },
    fight(X, Y) {
      flat(X + 0.15, Y + 0.15, X + 2.85, Y + 2.85, 3, '#3e3f4a');
      box(X + 0.25, Y + 0.25, X + 1.3, Y + 2.0, 3, 34, '#6b3a32');
      windows(X + 0.25, Y + 0.25, X + 1.3, Y + 2.0, 3, 34, { rows: 4, colsL: 2, colsR: 3, seed: 99, litRate: 0.2 });
      box(X + 1.6, Y + 0.25, X + 2.75, Y + 1.1, 3, 26, '#5a5560');
      windows(X + 1.6, Y + 0.25, X + 2.75, Y + 1.1, 3, 26, { rows: 3, colsL: 3, colsR: 2, seed: 98, litRate: 0.15 });
      sign(iso(X + 0.75, Y + 2.0, 12), 'V!', '#7dffb2', 7);
      box(X + 1.6, Y + 2.2, X + 2.1, Y + 2.5, 3, 7, '#2f6b3f');
      const [fx, fy] = iso(X + 2.4, Y + 1.7, 3);
      ctx.fillStyle = '#555'; ctx.fillRect(fx - 4, fy - 9, 8, 9);
      ctx.fillStyle = '#ff9a2a'; ctx.beginPath(); ctx.moveTo(fx - 4, fy - 9); ctx.quadraticCurveTo(fx, fy - 22, fx + 4, fy - 9); ctx.fill();
      ctx.fillStyle = '#ffe36b'; ctx.beginPath(); ctx.moveTo(fx - 2, fy - 9); ctx.quadraticCurveTo(fx, fy - 16, fx + 2, fy - 9); ctx.fill();
      return 44;
    },
    profile(X, Y) {
      flat(X + 0.3, Y + 2.0, X + 1.2, Y + 2.7, 3.2, '#4fb6e0', '#e6f6ff');
      for (let i = 0; i < 6; i++) box(X + 1.4 + i * 0.22, Y + 2.65, X + 1.58 + i * 0.22, Y + 2.85, 3, 4, '#2f6b34');
      box(X + 0.5, Y + 0.4, X + 2.6, Y + 1.8, 3, 22, '#efe2c4');
      windows(X + 0.5, Y + 0.4, X + 2.6, Y + 1.8, 3, 22, { rows: 2, colsL: 5, colsR: 3, seed: 111, lit: '#ffd98a', litRate: 0.7 });
      gableRoof(X + 0.4, Y + 0.3, X + 2.7, Y + 1.9, 25, 13, '#a83a30');
      box(X + 1.3, Y + 1.8, X + 1.4, Y + 1.9, 3, 18, '#ffffff');
      box(X + 1.75, Y + 1.8, X + 1.85, Y + 1.9, 3, 18, '#ffffff');
      return 42;
    },
  };

  // ---------------------------------------------------------------- sahne
  function blockGround(X: number, Y: number, inner: boolean, seed: number) {
    box(X, Y, X + 3, Y + 3, 0, 3, '#8d8f9e', { top: '#a3a5b3' });
    if (inner) {
      flat(X + 0.12, Y + 0.12, X + 2.88, Y + 2.88, 3, '#4c8a3c');
      const r = mulberry(seed + 5);
      for (let i = 0; i < 5; i++) {
        const [px, py] = iso(X + 0.4 + r() * 2.0, Y + 0.4 + r() * 2.0, 3);
        ctx.fillStyle = r() < 0.5 ? 'rgba(120,90,50,0.45)' : 'rgba(30,70,30,0.35)';
        ctx.beginPath(); ctx.ellipse(px, py, 10 + r() * 10, 4 + r() * 4, 0, 0, 7); ctx.fill();
      }
    } else flat(X + 0.12, Y + 0.12, X + 2.88, Y + 2.88, 3, '#686b7c');
  }
  function pond(X: number, Y: number) {
    const [cx, cy] = iso(X + 1.6, Y + 1.6, 3);
    ctx.fillStyle = '#3e83b8'; ctx.beginPath(); ctx.ellipse(cx, cy, 30, 14, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(cx - 8, cy - 3, 12, 4, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#c9b48a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy, 31, 15, 0, 0, 7); ctx.stroke();
  }

  function build() {
    objects = []; lamps = [];
    const rand = mulberry(7);
    for (let by = -1; by <= 4; by++) {
      for (let bx = -1; bx <= 4; bx++) {
        const X = bx * 4 + 1, Y = by * 4 + 1;
        const inner = bx >= 0 && bx <= 3 && by >= 0 && by <= 3;
        const b = placed.find((p) => p.bx === bx && p.by === by);
        objects.push({ depth: X + Y - 0.5, layer: 0, draw: () => blockGround(X, Y, inner, bx * 31 + by) });
        lamps.push([X + 0.1, Y + 0.1], [X + 2.9, Y + 2.9]);
        objects.push({ depth: X + Y + 0.2, draw: () => lamp(X + 0.1, Y + 0.1) });
        objects.push({ depth: X + Y + 5.8, draw: () => lamp(X + 2.9, Y + 2.9) });
        if (b && DRAW[b.id]) {
          const o: Obj = { depth: X + Y + 3, b, top: 40, draw: (t) => { o.top = DRAW[b.id](X, Y, t); } };
          objects.push(o);
          if (['crimes', 'hospital', 'gym', 'bank', 'shop', 'profile', 'casino'].includes(b.id)) {
            objects.push({ depth: X + Y + 0.4, draw: () => tree(X + 0.25, Y + 0.25, 0.8) });
          }
        } else if (!inner) {
          if (rand() < 0.5) {
            const h = 40 + rand() * 70, s = Math.floor(rand() * 9999);
            objects.push({ depth: X + Y + 3, draw: () => tower(X + 0.35, Y + 0.35, X + 2.65, Y + 2.65, h, s) });
          } else {
            const h1 = 30 + rand() * 60, h2 = 25 + rand() * 50, s1 = Math.floor(rand() * 9999), s2 = Math.floor(rand() * 9999);
            objects.push({ depth: X + Y + 2, draw: () => tower(X + 0.3, Y + 0.3, X + 1.4, Y + 2.7, h1, s1) });
            objects.push({ depth: X + Y + 3.5, draw: () => tower(X + 1.6, Y + 0.3, X + 2.7, Y + 2.7, h2, s2) });
          }
        } else if (PARKS.some((p) => p[0] === bx && p[1] === by)) {
          objects.push({ depth: X + Y + 0.1, layer: 0, draw: () => pond(X, Y) });
          for (let i = 0; i < 9; i++) {
            const tx = X + 0.3 + rand() * 2.4, ty = Y + 0.3 + rand() * 2.4;
            const s = 0.7 + rand() * 0.5, ti = (rand() - 0.5) * 0.2;
            if (tx > X + 1.0 && tx < X + 2.2 && ty > Y + 1.0 && ty < Y + 2.2) continue;
            objects.push({ depth: tx + ty, draw: () => tree(tx, ty, s, ti) });
          }
        }
      }
    }
    cars = [];
    const cr = mulberry(42);
    const palette = ['#c8302f', '#e5c23a', '#4c6fa8', '#eeeeee', '#2b2b30', '#3e8a4a', '#f07a1a'];
    for (let i = 0; i < 22; i++) {
      const axis = cr() < 0.5 ? 'x' : 'y';
      const lineK = (Math.floor(cr() * 6) - 1) * 4;
      const dir = cr() < 0.5 ? 1 : -1;
      cars.push({ axis, lane: lineK + (dir > 0 ? 0.62 : 0.1), p: MIN + cr() * (MAX - MIN), v: (0.5 + cr() * 0.7) * dir, color: palette[Math.floor(cr() * palette.length)] });
    }
  }

  function drawGround() {
    poly([iso(MIN, MIN), iso(MAX, MIN), iso(MAX, MAX), iso(MIN, MAX)], '#373a4c');
    ctx.setLineDash([7, 9]);
    for (let k = MIN; k <= MAX; k += 4) {
      line(iso(k + 0.5, MIN), iso(k + 0.5, MAX), 'rgba(230,220,150,0.45)', 1.2);
      line(iso(MIN, k + 0.5), iso(MAX, k + 0.5), 'rgba(230,220,150,0.45)', 1.2);
    }
    ctx.setLineDash([]);
    for (let gx = 0; gx <= 16; gx += 4) for (let gy = 0; gy <= 16; gy += 4) for (let s = 0; s < 4; s++) {
      const u = gx + 0.12 + s * 0.22;
      poly([iso(u, gy + 1.05), iso(u + 0.11, gy + 1.05), iso(u + 0.11, gy + 1.4), iso(u, gy + 1.4)], 'rgba(235,235,240,0.3)');
    }
    for (const [x, y] of lamps) {
      const [px, py] = iso(x, y, 0);
      const g = ctx.createRadialGradient(px, py, 2, px, py, 46);
      g.addColorStop(0, 'rgba(255,225,140,0.30)'); g.addColorStop(1, 'rgba(255,225,140,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(px, py, 46, 23, 0, 0, 7); ctx.fill();
    }
  }

  // ---------------------------------------------------------------- kamera
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  }
  function fit() {
    resize();
    cam.zoom = H > W ? clamp(W / 700, 0.5, 1.2) : clamp(Math.min(W / 1150, H / 640), 0.5, 1.4);
    cam.x = 0; cam.y = iso(8.5, 8.5)[1] - 10;
  }
  function clampCam() {
    cam.zoom = clamp(cam.zoom, 0.4, 2.2);
    cam.x = clamp(cam.x, -620, 620);
    cam.y = clamp(cam.y, -40, 580);
  }
  const toWorld = (sx: number, sy: number): Pt => [(sx - W / 2) / cam.zoom + cam.x, (sy - H / 2) / cam.zoom + cam.y];
  const toScreen = (wx: number, wy: number): Pt => [(wx - cam.x) * cam.zoom + W / 2, (wy - cam.y) * cam.zoom + H / 2];

  // ---------------------------------------------------------------- döngü
  let last = performance.now();
  function frame(t: number) {
    if (!alive) return;
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    for (const c of cars) { c.p += c.v * dt; if (c.p > MAX) c.p = MIN; if (c.p < MIN) c.p = MAX; }
    if (canvas.clientWidth !== W || canvas.clientHeight !== H) resize();
    if (W > 0) render(t);
    raf = requestAnimationFrame(frame);
  }

  function render(t: number) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bg.addColorStop(0, '#12100e'); bg.addColorStop(1, '#1d1a17');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const z = cam.zoom * DPR;
    ctx.setTransform(z, 0, 0, z, DPR * (W / 2 - cam.x * cam.zoom), DPR * (H / 2 - cam.y * cam.zoom));
    drawGround();
    const list = objects.slice();
    for (const c of cars) {
      const x = c.axis === 'x' ? c.p : c.lane, y = c.axis === 'x' ? c.lane : c.p;
      list.push({ depth: x + y + 0.3, draw: () => carShape(x, y, c.axis, c.color) });
    }
    list.sort((a, b) => a.depth - b.depth);
    for (const o of list) if (o.layer === 0) o.draw(t);
    for (const o of list) {
      if (o.layer === 0) continue;
      const hl = o.b && (o.b.id === hover?.id || o.b.id === pressed?.id);
      if (hl) ctx.filter = 'brightness(1.25)';
      o.draw(t);
      if (hl) ctx.filter = 'none';
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = tint; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const vg = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.35,
      canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.75);
    vg.addColorStop(0, 'rgba(8,6,4,0)'); vg.addColorStop(1, 'rgba(8,6,4,0.6)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawLabels(t);
  }

  function roundRect(x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawLabels(t: number) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const showNames = cam.zoom >= 0.55;
    for (const o of objects) {
      if (!o.b) continue;
      const b = o.b;
      const [wx, wy] = iso(b.X + 1.5, b.Y + 1.5, (o.top ?? 40) + 18);
      const [sx, sy0] = toScreen(wx, wy);
      let sc = 1;
      if (pulse?.id === b.id) { const k = (t - pulseT) / 350; if (k < 1) sc = 1 + Math.sin(k * Math.PI) * 0.3; }
      const sy = sy0 + Math.sin(t / 600 + b.bx * 1.7 + b.by) * 2.5;
      const r = 15 * sc;
      const isHover = hover?.id === b.id;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(sx, sy + r + 9, 6, 2.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = isHover ? '#f0c75e' : '#d4af37';
      ctx.beginPath(); ctx.moveTo(sx - 6, sy + r - 3); ctx.lineTo(sx, sy + r + 8); ctx.lineTo(sx + 6, sy + r - 3); ctx.fill();
      ctx.beginPath(); ctx.arc(sx, sy, r + 2.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#16120e'; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill();
      ctx.font = `${Math.round(16 * sc)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.icon, sx, sy + 1);
      o.hit = { x: sx, y: sy, r: r + 6 };
      if (showNames) {
        ctx.font = '600 11px Georgia, "Times New Roman", serif';
        const tw = ctx.measureText(b.label).width + 14;
        const ny = sy - r - 14;
        ctx.fillStyle = 'rgba(18,14,10,0.88)';
        roundRect(sx - tw / 2, ny - 8, tw, 16, 3); ctx.fill();
        ctx.strokeStyle = 'rgba(212,175,55,0.55)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#efe6d2'; ctx.fillText(b.label, sx, ny + 0.5);
      }
    }
  }

  function pick(sx: number, sy: number): MapBuilding | null {
    for (const o of objects) if (o.b && o.hit && Math.hypot(sx - o.hit.x, sy - o.hit.y) <= o.hit.r) return o.b;
    const [wx, wy] = toWorld(sx, sy);
    for (let z = 50; z >= 0; z -= 5) {
      const yy = wy + z;
      const tx = (wx / (TW / 2) + yy / (TH / 2)) / 2, ty = (yy / (TH / 2) - wx / (TW / 2)) / 2;
      for (const b of placed) if (tx >= b.X + 0.3 && tx <= b.X + 2.7 && ty >= b.Y + 0.3 && ty <= b.Y + 2.7) return b;
    }
    return null;
  }

  // ---------------------------------------------------------------- girdi
  const pointers = new Map<number, { x: number; y: number }>();
  let dragStart: { x: number; y: number; cx: number; cy: number } | null = null;
  let moved = false;
  let pinch: { d: number; z: number } | null = null;
  const local = (e: PointerEvent | WheelEvent): Pt => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  function down(e: PointerEvent) {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      dragStart = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y }; moved = false;
      pressed = pick(...local(e));
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.zoom }; pressed = null; moved = true;
    }
  }
  function move(e: PointerEvent) {
    if (!pointers.has(e.pointerId)) {
      if (e.pointerType === 'mouse') { hover = pick(...local(e)); canvas.style.cursor = hover ? 'pointer' : 'grab'; }
      return;
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      cam.zoom = (pinch.z * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.d; clampCam(); return;
    }
    if (dragStart) {
      const dx = e.clientX - dragStart.x, dy = e.clientY - dragStart.y;
      if (Math.abs(dx) + Math.abs(dy) > 7) { moved = true; pressed = null; }
      if (moved) { cam.x = dragStart.cx - dx / cam.zoom; cam.y = dragStart.cy - dy / cam.zoom; clampCam(); canvas.style.cursor = 'grabbing'; }
    }
  }
  function up(e: PointerEvent) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      if (!moved && pressed) { pulse = pressed; pulseT = performance.now(); onSelect(pressed.id); }
      pressed = null; dragStart = null;
      canvas.style.cursor = hover ? 'pointer' : 'grab';
    } else {
      const p = [...pointers.values()][0];
      dragStart = { x: p.x, y: p.y, cx: cam.x, cy: cam.y };
    }
  }
  function wheel(e: WheelEvent) {
    e.preventDefault();
    const [sx, sy] = local(e);
    const [wx, wy] = toWorld(sx, sy);
    cam.zoom *= Math.exp(-e.deltaY * 0.0015); clampCam();
    cam.x = wx - (sx - W / 2) / cam.zoom; cam.y = wy - (sy - H / 2) / cam.zoom; clampCam();
  }
  const leave = () => { hover = null; };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', leave);
  canvas.addEventListener('wheel', wheel, { passive: false });

  build(); fit();
  raf = requestAnimationFrame(frame);

  return {
    fit,
    zoomBy(f: number) { cam.zoom *= f; clampCam(); },
    setTint(c: string) { tint = c; },
    setLabels(next: MapBuilding[]) { for (const p of placed) { const n = next.find((x) => x.id === p.id); if (n) p.label = n.label; } },
    destroy() {
      alive = false; cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('wheel', wheel);
    },
  };
}
