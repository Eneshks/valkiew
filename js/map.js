// İzometrik şehir haritası: kodla çizilen binalar, ağaçlar, lambalar ve trafik.
'use strict';

const CityMap = (() => {
  const TW = 64, TH = 32;           // döşeme boyutu (dünya pikseli)
  const MIN = -4, MAX = 21;          // haritanın sınırı (döşeme)
  const canvas = document.getElementById('map');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1;
  const cam = { x: 0, y: 256, zoom: 1 };
  let objects = [];                  // statik nesneler
  let cars = [];
  let lamps = [];
  let hover = null, pressed = null, pulse = null, pulseT = 0;
  let onSelect = () => {};

  // ---- yardımcılar ----
  function mulberry(seed) {
    return () => {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const iso = (x, y, z = 0) => [(x - y) * TW / 2, (x + y) * TH / 2 - z];

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
    else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }

  function poly(pts, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }

  // Kutu: x0..x1, y0..y1, z tabanı, h yükseklik. c = ana renk (hex)
  function box(x0, y0, x1, y1, z, h, c, opt = {}) {
    const top = opt.top || shade(c, 0.12);
    // sol-ön yüz (y = y1)
    poly([iso(x0, y1, z), iso(x1, y1, z), iso(x1, y1, z + h), iso(x0, y1, z + h)], opt.left || c);
    // sağ-ön yüz (x = x1)
    poly([iso(x1, y0, z), iso(x1, y1, z), iso(x1, y1, z + h), iso(x1, y0, z + h)], opt.right || shade(c, -0.3));
    poly([iso(x0, y0, z + h), iso(x1, y0, z + h), iso(x1, y1, z + h), iso(x0, y1, z + h)], top,
      opt.edge === false ? null : 'rgba(0,0,0,0.18)');
  }

  // Yüzlere pencere dizisi
  function windows(x0, y0, x1, y1, z, h, o) {
    const rand = mulberry(o.seed || 1);
    const rows = o.rows, colsL = o.colsL, colsR = o.colsR;
    const lit = o.lit || '#ffd66b', dark = o.dark || 'rgba(20,24,40,0.75)';
    const vh = h / rows;
    for (let r = 0; r < rows; r++) {
      const za = z + r * vh + vh * 0.28, zb = z + (r + 1) * vh - vh * 0.18;
      const wl = (x1 - x0) / colsL;
      for (let c = 0; c < colsL; c++) {
        const ua = x0 + c * wl + wl * 0.25, ub = x0 + (c + 1) * wl - wl * 0.25;
        poly([iso(ua, y1, za), iso(ub, y1, za), iso(ub, y1, zb), iso(ua, y1, zb)], rand() < (o.litRate ?? 0.45) ? lit : dark);
      }
      const wr = (y1 - y0) / colsR;
      for (let c = 0; c < colsR; c++) {
        const ua = y0 + c * wr + wr * 0.25, ub = y0 + (c + 1) * wr - wr * 0.25;
        poly([iso(x1, ua, za), iso(x1, ub, za), iso(x1, ub, zb), iso(x1, ua, zb)], rand() < (o.litRate ?? 0.45) ? shade(lit.startsWith('#') ? lit : '#ffd66b', -0.2) : dark);
      }
    }
  }

  // Beşik çatı (x ekseni boyunca mahya)
  function gableRoof(x0, y0, x1, y1, z, rh, c) {
    const ym = (y0 + y1) / 2;
    poly([iso(x0, y0, z), iso(x1, y0, z), iso(x1, ym, z + rh), iso(x0, ym, z + rh)], shade(c, -0.15));
    poly([iso(x1, y0, z), iso(x1, y1, z), iso(x1, ym, z + rh)], shade(c, -0.35));
    poly([iso(x0, y1, z), iso(x1, y1, z), iso(x1, ym, z + rh), iso(x0, ym, z + rh)], c, 'rgba(0,0,0,0.2)');
  }

  function flatQuad(x0, y0, x1, y1, z, fill, stroke) {
    poly([iso(x0, y0, z), iso(x1, y0, z), iso(x1, y1, z), iso(x0, y1, z)], fill, stroke);
  }

  function tree(x, y, s = 1, tint = 0) {
    const [px, py] = iso(x, y, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(px, py, 9 * s, 4.5 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5b3d26';
    ctx.fillRect(px - 1.5 * s, py - 9 * s, 3 * s, 9 * s);
    const g = ['#2f6b34', '#3a7d3a', '#4f9444'];
    const col = i => shade(g[i], tint);
    ctx.fillStyle = col(0); ctx.beginPath(); ctx.arc(px, py - 13 * s, 9 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col(1); ctx.beginPath(); ctx.arc(px - 2 * s, py - 16 * s, 7 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col(2); ctx.beginPath(); ctx.arc(px - 3.5 * s, py - 18.5 * s, 3.5 * s, 0, Math.PI * 2); ctx.fill();
  }

  function lamp(x, y) {
    const [bx, by] = iso(x, y, 3);
    ctx.strokeStyle = '#2a2d3a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by - 24); ctx.stroke();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.arc(bx, by - 25, 2.6, 0, Math.PI * 2); ctx.fill();
  }

  // ---- bina çizimleri (X,Y blok köşesi, blok 3x3) ----
  const DRAW = {
    hapishane(X, Y) {
      flatQuad(X + 0.2, Y + 0.2, X + 2.8, Y + 2.8, 3, '#5d6170');
      box(X + 0.6, Y + 0.6, X + 2.4, Y + 2.2, 3, 30, '#8a8e9c');
      windows(X + 0.6, Y + 0.6, X + 2.4, Y + 2.2, 3, 30, { rows: 3, colsL: 5, colsR: 4, seed: 11, lit: '#b9c2d8', litRate: 0.3 });
      // parmaklıklar
      ctx.strokeStyle = 'rgba(30,30,40,0.8)'; ctx.lineWidth = 1;
      for (let i = 0; i <= 12; i++) {
        const x = X + 0.2 + i * 2.6 / 12;
        const a = iso(x, Y + 2.8, 3), b = iso(x, Y + 2.8, 12);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        const c = iso(X + 2.8, Y + 0.2 + i * 2.6 / 12, 3), d = iso(X + 2.8, Y + 0.2 + i * 2.6 / 12, 12);
        ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.stroke();
      }
      // gözetleme kulesi
      box(X + 2.25, Y + 2.25, X + 2.7, Y + 2.7, 3, 34, '#6c7080');
      box(X + 2.15, Y + 2.15, X + 2.8, Y + 2.8, 37, 7, '#4a4e5c');
      const [lx, ly] = iso(X + 2.47, Y + 2.47, 48);
      ctx.fillStyle = 'rgba(255,240,170,0.9)'; ctx.beginPath(); ctx.arc(lx, ly, 2.5, 0, 7); ctx.fill();
      return 48;
    },
    kumarhane(X, Y, t) {
      box(X + 0.35, Y + 0.35, X + 2.65, Y + 2.65, 3, 26, '#5b2a7a');
      windows(X + 0.35, Y + 0.35, X + 2.65, Y + 2.65, 3, 26, { rows: 2, colsL: 5, colsR: 5, seed: 22, lit: '#ff7ad9', litRate: 0.6 });
      // altın kubbe
      const [cx, cy] = iso(X + 1.5, Y + 1.5, 29);
      ctx.fillStyle = '#d9a52b'; ctx.beginPath(); ctx.ellipse(cx, cy, 22, 11, 0, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, cy, 22, 11, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#f2c94c'; ctx.beginPath(); ctx.arc(cx, cy - 6, 14, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#fff1a8'; ctx.beginPath(); ctx.arc(cx - 4, cy - 12, 3, 0, 7); ctx.fill();
      // yanıp sönen neon ampuller
      for (let i = 0; i < 14; i++) {
        const on = ((i + Math.floor(t / 250)) % 3) === 0;
        const u = X + 0.35 + (i + 0.5) * 2.3 / 14;
        const [px, py] = iso(u, Y + 2.65, 29);
        ctx.fillStyle = on ? '#fff36b' : '#ff4fb8';
        ctx.beginPath(); ctx.arc(px, py, 1.8, 0, 7); ctx.fill();
        const [qx, qy] = iso(X + 2.65, Y + 0.35 + (i + 0.5) * 2.3 / 14, 29);
        ctx.fillStyle = !on ? '#fff36b' : '#ff4fb8';
        ctx.beginPath(); ctx.arc(qx, qy, 1.8, 0, 7); ctx.fill();
      }
      return 52;
    },
    havalimani(X, Y) {
      flatQuad(X + 0.1, Y + 0.1, X + 2.9, Y + 2.9, 3, '#4b4f60');
      // pist çizgileri
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 1.5;
      let a = iso(X + 0.3, Y + 2.5, 3), b = iso(X + 2.7, Y + 2.5, 3);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]);
      box(X + 0.3, Y + 0.3, X + 2.0, Y + 1.9, 3, 18, '#9fb7cf');
      windows(X + 0.3, Y + 0.3, X + 2.0, Y + 1.9, 3, 18, { rows: 1, colsL: 6, colsR: 6, seed: 33, lit: '#cfe8ff', litRate: 0.85 });
      box(X + 0.3, Y + 0.3, X + 2.0, Y + 1.9, 21, 3, '#d8dde6');
      // kule
      box(X + 2.15, Y + 0.45, X + 2.55, Y + 0.85, 3, 46, '#c9ced8');
      box(X + 2.0, Y + 0.3, X + 2.7, Y + 1.0, 49, 9, '#5a7fa8', { top: '#e6e9ef' });
      windows(X + 2.0, Y + 0.3, X + 2.7, Y + 1.0, 49, 9, { rows: 1, colsL: 3, colsR: 3, seed: 3, lit: '#bfe3ff', litRate: 1 });
      const [rx, ry] = iso(X + 2.35, Y + 0.65, 62);
      ctx.fillStyle = '#ff4040'; ctx.beginPath(); ctx.arc(rx, ry, 2.2, 0, 7); ctx.fill();
      // uçak
      const [px, py] = iso(X + 1.1, Y + 2.45, 4);
      ctx.fillStyle = '#eef1f6';
      ctx.beginPath(); ctx.ellipse(px, py, 16, 4, 0.46, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px - 4, py - 1); ctx.lineTo(px + 6, py - 11); ctx.lineTo(px + 9, py - 9); ctx.lineTo(px + 3, py + 2); ctx.fill();
      return 64;
    },
    silahci(X, Y) {
      box(X + 0.5, Y + 0.5, X + 2.5, Y + 2.4, 3, 22, '#4d5a3c');
      windows(X + 0.5, Y + 0.5, X + 2.5, Y + 2.4, 3, 22, { rows: 2, colsL: 4, colsR: 3, seed: 44, litRate: 0.35 });
      box(X + 0.5, Y + 0.5, X + 2.5, Y + 2.4, 25, 3, '#3a4430');
      // tabela
      box(X + 0.9, Y + 2.4, X + 2.1, Y + 2.48, 14, 7, '#b0291f');
      const [sx, sy] = iso(X + 1.5, Y + 2.48, 17.5);
      ctx.fillStyle = '#ffe9b0'; ctx.font = 'bold 6px sans-serif'; ctx.textAlign = 'center';
      ctx.save(); ctx.translate(sx, sy); ctx.transform(1, -0.5, 0, 1, 0, 0); ctx.fillText('SİLAH', 0, 2); ctx.restore();
      // sandıklar
      box(X + 2.55, Y + 2.0, X + 2.85, Y + 2.3, 3, 6, '#7a5a32');
      box(X + 2.55, Y + 2.35, X + 2.85, Y + 2.65, 3, 6, '#86663a');
      return 32;
    },
    meyhane(X, Y) {
      box(X + 0.5, Y + 0.6, X + 2.5, Y + 2.4, 3, 18, '#8a5a35');
      windows(X + 0.5, Y + 0.6, X + 2.5, Y + 2.4, 3, 18, { rows: 1, colsL: 4, colsR: 3, seed: 55, lit: '#ffb347', litRate: 0.9 });
      gableRoof(X + 0.4, Y + 0.5, X + 2.6, Y + 2.5, 21, 14, '#e2892e');
      // kapı lambası ve masalar
      const [dx, dy] = iso(X + 1.5, Y + 2.4, 12);
      ctx.fillStyle = 'rgba(255,190,90,0.9)'; ctx.beginPath(); ctx.arc(dx, dy, 2, 0, 7); ctx.fill();
      box(X + 0.7, Y + 2.55, X + 0.95, Y + 2.8, 3, 4, '#5c3a20');
      box(X + 2.0, Y + 2.55, X + 2.25, Y + 2.8, 3, 4, '#5c3a20');
      return 40;
    },
    hastane(X, Y) {
      box(X + 0.45, Y + 0.45, X + 2.55, Y + 2.55, 3, 32, '#e9ecf1');
      windows(X + 0.45, Y + 0.45, X + 2.55, Y + 2.55, 3, 32, { rows: 4, colsL: 5, colsR: 5, seed: 66, lit: '#bfe6ff', litRate: 0.55 });
      // çatıda kızıl haç
      const z = 35.2;
      flatQuad(X + 1.3, Y + 0.9, X + 1.7, Y + 2.1, z, '#d8343a');
      flatQuad(X + 0.9, Y + 1.3, X + 2.1, Y + 1.7, z, '#d8343a');
      // ambulans
      box(X + 2.6, Y + 1.0, X + 2.9, Y + 1.6, 3, 6, '#ffffff');
      flatQuad(X + 2.6, Y + 1.2, X + 2.9, Y + 1.35, 9.2, '#d8343a');
      return 40;
    },
    spor(X, Y) {
      box(X + 0.4, Y + 0.5, X + 2.6, Y + 2.4, 3, 20, '#2e5d9c');
      windows(X + 0.4, Y + 0.5, X + 2.6, Y + 2.4, 3, 20, { rows: 1, colsL: 3, colsR: 3, seed: 77, lit: '#d9f0ff', litRate: 1 });
      // tonoz çatı
      const [cx, cy] = iso(X + 1.5, Y + 1.45, 23);
      ctx.fillStyle = '#3b74bf'; ctx.beginPath(); ctx.ellipse(cx, cy, 34, 13, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#5d93d8'; ctx.beginPath(); ctx.ellipse(cx - 4, cy - 2, 22, 8, 0, Math.PI, 0); ctx.fill();
      // dambıl
      const [dx, dy] = iso(X + 2.75, Y + 2.7, 5);
      ctx.fillStyle = '#222'; ctx.fillRect(dx - 7, dy - 1, 14, 2);
      ctx.fillRect(dx - 8, dy - 4, 3, 8); ctx.fillRect(dx + 5, dy - 4, 3, 8);
      return 38;
    },
    banka(X, Y) {
      box(X + 0.4, Y + 0.4, X + 2.6, Y + 2.3, 3, 24, '#d9cfb8');
      windows(X + 0.4, Y + 0.4, X + 2.6, Y + 2.3, 3, 24, { rows: 2, colsL: 4, colsR: 4, seed: 88, lit: '#ffe9a8', litRate: 0.5 });
      box(X + 0.35, Y + 0.35, X + 2.65, Y + 2.4, 27, 4, '#bfb398');
      // sütunlar
      for (let i = 0; i < 5; i++) {
        const x = X + 0.55 + i * 0.47;
        box(x, Y + 2.42, x + 0.14, Y + 2.56, 3, 22, '#f2ece0');
      }
      box(X + 0.4, Y + 2.3, X + 2.6, Y + 2.65, 25, 3, '#c9bc9f');
      // altın tabela
      box(X + 1.0, Y + 2.65, X + 2.0, Y + 2.7, 15, 6, '#d9a52b');
      const [sx, sy] = iso(X + 1.5, Y + 2.7, 18);
      ctx.fillStyle = '#3a2b06'; ctx.font = 'bold 5px sans-serif'; ctx.textAlign = 'center';
      ctx.save(); ctx.translate(sx, sy); ctx.transform(1, -0.5, 0, 1, 0, 0); ctx.fillText('BANKA', 0, 2); ctx.restore();
      return 34;
    },
    garaj(X, Y) {
      flatQuad(X + 0.2, Y + 0.2, X + 2.8, Y + 2.8, 3, '#55596a');
      box(X + 0.4, Y + 0.4, X + 2.6, Y + 1.9, 3, 18, '#9b5b3b');
      // kepenkler
      for (let k = 0; k < 3; k++) {
        const x0 = X + 0.55 + k * 0.7, x1 = x0 + 0.5;
        poly([iso(x0, Y + 1.9, 3), iso(x1, Y + 1.9, 3), iso(x1, Y + 1.9, 13), iso(x0, Y + 1.9, 13)], '#c8ccd4');
        ctx.strokeStyle = 'rgba(60,60,70,0.5)';
        for (let s = 1; s < 5; s++) {
          const a = iso(x0, Y + 1.9, 3 + s * 2), b = iso(x1, Y + 1.9, 3 + s * 2);
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        }
      }
      box(X + 0.4, Y + 0.4, X + 2.6, Y + 1.9, 21, 3, '#7a432a');
      // park etmiş arabalar
      carShape(X + 0.6, Y + 2.25, 'x', '#c8302f');
      carShape(X + 1.6, Y + 2.25, 'x', '#4c6fa8');
      return 32;
    },
    karaborsa(X, Y) {
      flatQuad(X + 0.2, Y + 0.2, X + 2.8, Y + 2.8, 3, '#4e4a44');
      const cols = ['#a33b2a', '#2c6a8a', '#3e7a3a', '#b8862c'];
      box(X + 0.3, Y + 0.3, X + 1.4, Y + 0.85, 3, 11, cols[0]);
      box(X + 0.3, Y + 0.3, X + 1.4, Y + 0.85, 14, 11, cols[1]);
      box(X + 1.6, Y + 0.3, X + 2.7, Y + 0.85, 3, 11, cols[2]);
      box(X + 0.3, Y + 1.1, X + 1.4, Y + 1.65, 3, 11, cols[3]);
      // tente
      box(X + 1.5, Y + 1.3, X + 2.7, Y + 2.6, 3, 1, '#3a352e');
      poly([iso(X + 1.5, Y + 1.3, 16), iso(X + 2.7, Y + 1.3, 16), iso(X + 2.7, Y + 2.6, 12), iso(X + 1.5, Y + 2.6, 12)], '#7d2d6b');
      for (const [px, py] of [[1.55, 2.55], [2.65, 2.55], [2.65, 1.35]]) {
        const a = iso(X + px, Y + py, 3), b = iso(X + px, Y + py, py > 2 ? 12 : 16);
        ctx.strokeStyle = '#2a2520'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      box(X + 0.4, Y + 2.0, X + 0.7, Y + 2.3, 3, 5, '#86663a');
      box(X + 0.8, Y + 2.1, X + 1.1, Y + 2.4, 3, 5, '#7a5a32');
      return 30;
    },
    arkasokak(X, Y) {
      flatQuad(X + 0.15, Y + 0.15, X + 2.85, Y + 2.85, 3, '#3e3f4a');
      box(X + 0.25, Y + 0.25, X + 1.3, Y + 2.0, 3, 34, '#6b3a32');
      windows(X + 0.25, Y + 0.25, X + 1.3, Y + 2.0, 3, 34, { rows: 4, colsL: 2, colsR: 3, seed: 99, litRate: 0.2 });
      box(X + 1.6, Y + 0.25, X + 2.75, Y + 1.1, 3, 26, '#5a5560');
      windows(X + 1.6, Y + 0.25, X + 2.75, Y + 1.1, 3, 26, { rows: 3, colsL: 3, colsR: 2, seed: 98, litRate: 0.15 });
      // grafiti
      const [gx, gy] = iso(X + 0.75, Y + 2.0, 12);
      ctx.save(); ctx.translate(gx, gy); ctx.transform(1, -0.5, 0, 1, 0, 0);
      ctx.fillStyle = '#7dffb2'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('V!', 0, 0);
      ctx.restore();
      // çöp konteyneri ve varil ateşi
      box(X + 1.6, Y + 2.2, X + 2.1, Y + 2.5, 3, 7, '#2f6b3f');
      const [fx, fy] = iso(X + 2.4, Y + 1.7, 3);
      ctx.fillStyle = '#555'; ctx.fillRect(fx - 4, fy - 9, 8, 9);
      ctx.fillStyle = '#ff9a2a'; ctx.beginPath(); ctx.moveTo(fx - 4, fy - 9); ctx.quadraticCurveTo(fx, fy - 22, fx + 4, fy - 9); ctx.fill();
      ctx.fillStyle = '#ffe36b'; ctx.beginPath(); ctx.moveTo(fx - 2, fy - 9); ctx.quadraticCurveTo(fx, fy - 16, fx + 2, fy - 9); ctx.fill();
      return 44;
    },
    malikane(X, Y) {
      // havuz ve çitler
      flatQuad(X + 0.3, Y + 2.0, X + 1.2, Y + 2.7, 3.2, '#4fb6e0', '#e6f6ff');
      for (let i = 0; i < 6; i++) box(X + 1.4 + i * 0.22, Y + 2.65, X + 1.58 + i * 0.22, Y + 2.85, 3, 4, '#2f6b34');
      box(X + 0.5, Y + 0.4, X + 2.6, Y + 1.8, 3, 22, '#efe2c4');
      windows(X + 0.5, Y + 0.4, X + 2.6, Y + 1.8, 3, 22, { rows: 2, colsL: 5, colsR: 3, seed: 111, lit: '#ffd98a', litRate: 0.7 });
      gableRoof(X + 0.4, Y + 0.3, X + 2.7, Y + 1.9, 25, 13, '#a83a30');
      // giriş sütunları
      box(X + 1.3, Y + 1.8, X + 1.4, Y + 1.9, 3, 18, '#ffffff');
      box(X + 1.75, Y + 1.8, X + 1.85, Y + 1.9, 3, 18, '#ffffff');
      return 42;
    },
  };

  function carShape(x, y, axis, color) {
    const L = 0.55, Wd = 0.28;
    const [x0, y0, x1, y1] = axis === 'x' ? [x, y, x + L, y + Wd] : [x, y, x + Wd, y + L];
    box(x0, y0, x1, y1, 1, 5, color, { edge: false });
    const r = axis === 'x' ? [x0 + 0.15, y0 + 0.03, x1 - 0.12, y1 - 0.03] : [x0 + 0.03, y0 + 0.15, x1 - 0.03, y1 - 0.12];
    box(r[0], r[1], r[2], r[3], 6, 3.5, shade(color, 0.25), { top: shade(color, 0.35), left: '#9cc3e6', right: '#6e98c0', edge: false });
  }

  function smallHouse(x0, y0, x1, y1, rnd) {
    const walls = ['#c9b79c', '#b7c4cf', '#d8c3a5', '#a9b8a0', '#c7a99a'];
    const roofs = ['#8e3b2f', '#4c5b78', '#6d4a33', '#3f6a4a'];
    const w = walls[Math.floor(rnd() * walls.length)];
    const h = 10 + rnd() * 8;
    box(x0, y0, x1, y1, 3, h, w);
    windows(x0, y0, x1, y1, 3, h, { rows: 1, colsL: 2, colsR: 2, seed: Math.floor(rnd() * 1000), litRate: 0.5 });
    gableRoof(x0 - 0.05, y0 - 0.05, x1 + 0.05, y1 + 0.05, 3 + h, 8, roofs[Math.floor(rnd() * roofs.length)]);
  }

  function tower(x0, y0, x1, y1, h, seed) {
    const tones = ['#565b70', '#4b5064', '#5f6378', '#454a5c'];
    const r = mulberry(seed);
    const c = tones[Math.floor(r() * tones.length)];
    box(x0, y0, x1, y1, 3, h, c);
    windows(x0, y0, x1, y1, 3, h, { rows: Math.max(2, Math.round(h / 11)), colsL: 3, colsR: 3, seed, lit: '#ffd66b', litRate: 0.32 });
    box(x0 + 0.1, y0 + 0.1, x1 - 0.1, y1 - 0.1, 3 + h, 2, shade(c, -0.2));
    if (r() < 0.4) box(x0 + 0.3, y0 + 0.3, x0 + 0.6, y0 + 0.6, 5 + h, 5, '#3a3e4e');
  }

  // ---- sahne kurulumu ----
  function build() {
    objects = []; lamps = [];
    const rand = mulberry(7);
    const bmap = {};
    for (const b of BUILDINGS) bmap[b.bx + ',' + b.by] = b;
    const isPark = (bx, by) => PARKS.some(p => p[0] === bx && p[1] === by);
    const isHouses = (bx, by) => HOUSE_BLOCKS.some(p => p[0] === bx && p[1] === by);

    for (let by = -1; by <= 4; by++) {
      for (let bx = -1; bx <= 4; bx++) {
        const X = bx * 4 + 1, Y = by * 4 + 1;
        const inner = bx >= 0 && bx <= 3 && by >= 0 && by <= 3;
        const bld = bmap[bx + ',' + by];
        // blok zemini
        objects.push({ depth: X + Y - 0.5, layer: 0, draw: () => blockGround(X, Y, inner, bx * 31 + by) });
        // köşe lambaları
        lamps.push([X + 0.1, Y + 0.1], [X + 2.9, Y + 2.9]);
        objects.push({ depth: X + Y + 0.2, draw: () => lamp(X + 0.1, Y + 0.1) });
        objects.push({ depth: X + Y + 5.8, draw: () => lamp(X + 2.9, Y + 2.9) });

        if (bld) {
          const o = { depth: X + Y + 3, b: bld, X, Y, top: 40 };
          o.draw = (t) => { o.top = DRAW[bld.id](X, Y, t); };
          bld.X = X; bld.Y = Y;
          objects.push(o);
          // bina etrafına birkaç ağaç
          if (!['havalimani', 'garaj', 'karaborsa', 'arkasokak', 'hapishane'].includes(bld.id)) {
            objects.push({ depth: X + Y + 0.4, draw: () => tree(X + 0.25, Y + 0.25, 0.8) });
          }
        } else if (!inner) {
          // dış halka: koyu gri gökdelenler
          const n = rand() < 0.5 ? 1 : 2;
          if (n === 1) {
            const h = 40 + rand() * 70, s = Math.floor(rand() * 9999);
            objects.push({ depth: X + Y + 3, draw: () => tower(X + 0.35, Y + 0.35, X + 2.65, Y + 2.65, h, s) });
          } else {
            const h1 = 30 + rand() * 60, h2 = 25 + rand() * 50, s1 = Math.floor(rand() * 9999), s2 = Math.floor(rand() * 9999);
            objects.push({ depth: X + Y + 2, draw: () => tower(X + 0.3, Y + 0.3, X + 1.4, Y + 2.7, h1, s1) });
            objects.push({ depth: X + Y + 3.5, draw: () => tower(X + 1.6, Y + 0.3, X + 2.7, Y + 2.7, h2, s2) });
          }
        } else if (isPark(bx, by)) {
          objects.push({ depth: X + Y + 0.1, layer: 0, draw: () => pond(X, Y) });
          for (let i = 0; i < 9; i++) {
            const tx = X + 0.3 + rand() * 2.4, ty = Y + 0.3 + rand() * 2.4;
            if (tx > X + 1.0 && tx < X + 2.2 && ty > Y + 1.0 && ty < Y + 2.2) continue;
            const s = 0.7 + rand() * 0.5, tint = (rand() - 0.5) * 0.2;
            objects.push({ depth: tx + ty, draw: () => tree(tx, ty, s, tint) });
          }
        } else if (isHouses(bx, by)) {
          const seeds = [1, 2, 3, 4].map(() => Math.floor(rand() * 9999));
          const spots = [[0.3, 0.3], [1.6, 0.3], [0.3, 1.6], [1.6, 1.6]];
          spots.forEach(([dx, dy], i) => {
            objects.push({ depth: X + dx + Y + dy + 1, draw: () => smallHouse(X + dx, Y + dy, X + dx + 1.0, Y + dy + 1.0, mulberry(seeds[i])) });
          });
        }
      }
    }
    // trafik
    cars = [];
    const crand = mulberry(42);
    const palette = ['#c8302f', '#e5c23a', '#4c6fa8', '#eeeeee', '#2b2b30', '#3e8a4a', '#f07a1a'];
    for (let i = 0; i < 22; i++) {
      const axis = crand() < 0.5 ? 'x' : 'y';
      const line = (Math.floor(crand() * 6) - 1) * 4;
      const dir = crand() < 0.5 ? 1 : -1;
      cars.push({
        axis, dir,
        lane: line + (dir > 0 ? 0.62 : 0.1),
        p: MIN + crand() * (MAX - MIN),
        v: (0.5 + crand() * 0.7) * dir,
        color: palette[Math.floor(crand() * palette.length)],
      });
    }
  }

  function blockGround(X, Y, inner, seed) {
    box(X, Y, X + 3, Y + 3, 0, 3, '#8d8f9e', { top: '#a3a5b3' });
    if (inner) {
      flatQuad(X + 0.12, Y + 0.12, X + 2.88, Y + 2.88, 3, '#4c8a3c');
      const r = mulberry(seed + 5);
      for (let i = 0; i < 5; i++) {
        const x = X + 0.4 + r() * 2.0, y = Y + 0.4 + r() * 2.0;
        const [px, py] = iso(x, y, 3);
        ctx.fillStyle = r() < 0.5 ? 'rgba(120,90,50,0.45)' : 'rgba(30,70,30,0.35)';
        ctx.beginPath(); ctx.ellipse(px, py, 10 + r() * 10, 4 + r() * 4, 0, 0, 7); ctx.fill();
      }
    } else {
      flatQuad(X + 0.12, Y + 0.12, X + 2.88, Y + 2.88, 3, '#686b7c');
    }
  }

  function pond(X, Y) {
    const [cx, cy] = iso(X + 1.6, Y + 1.6, 3);
    ctx.fillStyle = '#3e83b8'; ctx.beginPath(); ctx.ellipse(cx, cy, 30, 14, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(cx - 8, cy - 3, 12, 4, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#c9b48a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy, 31, 15, 0, 0, 7); ctx.stroke();
  }

  function drawGround() {
    poly([iso(MIN, MIN), iso(MAX, MIN), iso(MAX, MAX), iso(MIN, MAX)], '#373a4c');
    // şerit çizgileri
    ctx.strokeStyle = 'rgba(230,220,150,0.45)'; ctx.lineWidth = 1.2; ctx.setLineDash([7, 9]);
    for (let k = MIN; k <= MAX; k += 4) {
      let a = iso(k + 0.5, MIN), b = iso(k + 0.5, MAX);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      a = iso(MIN, k + 0.5); b = iso(MAX, k + 0.5);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    ctx.setLineDash([]);
    // yaya geçitleri
    ctx.fillStyle = 'rgba(235,235,240,0.35)';
    for (let gx = 0; gx <= 16; gx += 4) for (let gy = 0; gy <= 16; gy += 4) {
      for (let s = 0; s < 4; s++) {
        const u = gx + 0.12 + s * 0.22;
        poly([iso(u, gy + 1.05), iso(u + 0.11, gy + 1.05), iso(u + 0.11, gy + 1.4), iso(u, gy + 1.4)], 'rgba(235,235,240,0.3)');
      }
    }
    // lamba ışık havuzları
    for (const [x, y] of lamps) {
      const [px, py] = iso(x, y, 0);
      const g = ctx.createRadialGradient(px, py, 2, px, py, 46);
      g.addColorStop(0, 'rgba(255,225,140,0.30)'); g.addColorStop(1, 'rgba(255,225,140,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(px, py, 46, 23, 0, 0, 7); ctx.fill();
    }
  }

  // ---- kamera ----
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
  const toWorld = (sx, sy) => [(sx - W / 2) / cam.zoom + cam.x, (sy - H / 2) / cam.zoom + cam.y];
  const toScreen = (wx, wy) => [(wx - cam.x) * cam.zoom + W / 2, (wy - cam.y) * cam.zoom + H / 2];

  // ---- çizim döngüsü ----
  let last = performance.now();
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    for (const c of cars) {
      c.p += c.v * dt;
      if (c.p > MAX) c.p = MIN; if (c.p < MIN) c.p = MAX;
    }
    render(t);
    requestAnimationFrame(frame);
  }

  function render(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bg.addColorStop(0, '#151827'); bg.addColorStop(1, '#232638');
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
    // önce zemin katmanı, sonra nesneler
    for (const o of list) if (o.layer === 0) o.draw(t);
    for (const o of list) {
      if (o.layer === 0) continue;
      const hl = o.b && (o.b === hover || o.b === pressed);
      if (hl && 'filter' in ctx) ctx.filter = 'brightness(1.25)';
      o.draw(t);
      if (hl && 'filter' in ctx) ctx.filter = 'none';
    }

    // şehir tonu ve vinyet (ekran uzayında)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (typeof S !== 'undefined' && S) { ctx.fillStyle = city().tint; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    const vg = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.35,
      canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.75);
    vg.addColorStop(0, 'rgba(10,10,25,0)'); vg.addColorStop(1, 'rgba(10,10,25,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawLabels(t);
  }

  function drawLabels(t) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const showNames = cam.zoom >= 0.55;
    for (const o of objects) {
      if (!o.b) continue;
      const b = o.b;
      const [wx, wy] = iso(b.X + 1.5, b.Y + 1.5, o.top + 18);
      let [sx, sy] = toScreen(wx, wy);
      const bob = Math.sin(t / 600 + b.bx * 1.7 + b.by) * 2.5;
      let sc = 1;
      if (pulse === b) { const k = (t - pulseT) / 350; if (k < 1) sc = 1 + Math.sin(k * Math.PI) * 0.3; }
      sy += bob;
      const r = 15 * sc;
      // iğne
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(sx, sy + r + 9, 6, 2.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = b === hover ? '#ffd34d' : '#f5f1e6';
      ctx.beginPath(); ctx.moveTo(sx - 6, sy + r - 3); ctx.lineTo(sx, sy + r + 8); ctx.lineTo(sx + 6, sy + r - 3); ctx.fill();
      ctx.beginPath(); ctx.arc(sx, sy, r + 2.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#20243a'; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill();
      ctx.font = `${Math.round(16 * sc)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.icon, sx, sy + 1);
      o.hit = { x: sx, y: sy, r: r + 6 };
      if (showNames) {
        ctx.font = '600 11px system-ui, sans-serif';
        const tw = ctx.measureText(b.name).width + 12;
        const ny = sy - r - 14;
        ctx.fillStyle = 'rgba(20,22,36,0.82)';
        roundRect(sx - tw / 2, ny - 8, tw, 16, 8); ctx.fill();
        ctx.fillStyle = '#f3efe4'; ctx.fillText(b.name, sx, ny + 0.5);
      }
    }
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // ---- seçim (ekran noktasından binaya) ----
  function pick(sx, sy) {
    // önce etiket iğneleri
    for (const o of objects) {
      if (o.b && o.hit && Math.hypot(sx - o.hit.x, sy - o.hit.y) <= o.hit.r) return o.b;
    }
    // sonra bina gövdesi: dünya koordinatını döşemeye çevir
    const [wx, wy] = toWorld(sx, sy);
    // farklı yüksekliklerde dene (üstten tabana)
    for (let z = 50; z >= 0; z -= 5) {
      const yy = wy + z;
      const tx = (wx / (TW / 2) + yy / (TH / 2)) / 2, ty = (yy / (TH / 2) - wx / (TW / 2)) / 2;
      for (const b of BUILDINGS) {
        if (tx >= b.X + 0.3 && tx <= b.X + 2.7 && ty >= b.Y + 0.3 && ty <= b.Y + 2.7) return b;
      }
    }
    return null;
  }

  // ---- girdi: sürükle, yakınlaştır, dokun ----
  const pointers = new Map();
  let dragStart = null, moved = false, pinch = null;
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      dragStart = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y }; moved = false;
      const r = canvas.getBoundingClientRect();
      pressed = pick(e.clientX - r.left, e.clientY - r.top);
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.zoom }; pressed = null; moved = true;
    }
  });
  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    if (!pointers.has(e.pointerId)) {
      if (e.pointerType === 'mouse') {
        hover = pick(e.clientX - r.left, e.clientY - r.top);
        canvas.style.cursor = hover ? 'pointer' : 'grab';
      }
      return;
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      cam.zoom = pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d;
      clampCam(); return;
    }
    if (dragStart) {
      const dx = e.clientX - dragStart.x, dy = e.clientY - dragStart.y;
      if (Math.abs(dx) + Math.abs(dy) > 7) { moved = true; pressed = null; }
      if (moved) {
        cam.x = dragStart.cx - dx / cam.zoom; cam.y = dragStart.cy - dy / cam.zoom; clampCam();
        canvas.style.cursor = 'grabbing';
      }
    }
  });
  function up(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      if (!moved && pressed) { pulse = pressed; pulseT = performance.now(); onSelect(pressed); }
      pressed = null; dragStart = null;
      canvas.style.cursor = hover ? 'pointer' : 'grab';
    } else {
      const p = [...pointers.values()][0];
      dragStart = { x: p.x, y: p.y, cx: cam.x, cy: cam.y };
    }
  }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', () => { hover = null; });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const [wx, wy] = toWorld(sx, sy);
    cam.zoom *= Math.exp(-e.deltaY * 0.0015);
    clampCam();
    // imlecin altındaki nokta sabit kalsın
    cam.x = wx - (sx - W / 2) / cam.zoom; cam.y = wy - (sy - H / 2) / cam.zoom; clampCam();
  }, { passive: false });
  window.addEventListener('resize', resize);

  function focus(id) {
    const b = BUILDINGS.find(x => x.id === id);
    if (!b) return;
    const [wx, wy] = iso(b.X + 1.5, b.Y + 1.5, 20);
    cam.x = wx; cam.y = wy; clampCam();
    pulse = b; pulseT = performance.now();
  }

  function start(cb) {
    onSelect = cb;
    build(); fit();
    requestAnimationFrame(frame);
  }
  function zoomBy(f) { cam.zoom *= f; clampCam(); }

  return { start, fit, focus, zoomBy };
})();
