const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const IPHONE = { w: 1242, h: 2688, name: 'iphone' };
const IPAD = { w: 2064, h: 2752, name: 'ipad' };

function drawBg(ctx, w, h) {
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.02)';
  ctx.lineWidth = 1;
  const gs = 60;
  for (let x = 0; x < w; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
}

function drawSnake(ctx, cx, cy, length, color1, color2, angle, scale) {
  const segDist = 12 * scale;
  for (let i = length - 1; i >= 0; i--) {
    const t = 1 - i / length;
    const wobble = Math.sin(i * 0.3) * 15 * scale;
    const sx = cx + Math.cos(angle) * i * segDist + Math.cos(angle + Math.PI / 2) * wobble;
    const sy = cy + Math.sin(angle) * i * segDist + Math.sin(angle + Math.PI / 2) * wobble;
    const r = (8 + (1 - t) * 12) * scale;
    const ratio = i / length;
    const rr = parseInt(color1.slice(1, 3), 16), rg = parseInt(color1.slice(3, 5), 16), rb = parseInt(color1.slice(5, 7), 16);
    const er = parseInt(color2.slice(1, 3), 16), eg = parseInt(color2.slice(3, 5), 16), eb = parseInt(color2.slice(5, 7), 16);
    const cr = Math.round(rr + (er - rr) * ratio), cg = Math.round(rg + (eg - rg) * ratio), cb = Math.round(rb + (eb - rb) * ratio);
    ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
    if (i === 0) { ctx.shadowColor = color1; ctx.shadowBlur = 15 * scale; }
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
    if (i === 0) ctx.shadowBlur = 0;
  }
  // Eyes
  const eyeR = 5 * scale;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(cx + Math.cos(angle - 0.4) * 8 * scale, cy + Math.sin(angle - 0.4) * 8 * scale, eyeR, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + Math.cos(angle + 0.4) * 8 * scale, cy + Math.sin(angle + 0.4) * 8 * scale, eyeR, 0, Math.PI * 2); ctx.fill();
}

function drawFood(ctx, w, h, count) {
  const colors = ['#00e5ff', '#76ff03', '#ff4081', '#ffab00', '#7c4dff', '#00bfa5'];
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w, y = Math.random() * h;
    const r = 4 + Math.random() * 6;
    const c = colors[Math.floor(Math.random() * colors.length)];
    ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowBlur = 0;
}

function drawTitle(ctx, w, y, text, size) {
  ctx.font = `900 ${size}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = 20;
  ctx.fillText(text, w / 2, y);
  ctx.shadowBlur = 0;
}

function drawHUD(ctx, w, scale) {
  const m = 80 * scale;
  ctx.fillStyle = '#00e5ff'; ctx.font = `900 ${48 * scale}px sans-serif`; ctx.textAlign = 'left';
  ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 10;
  ctx.fillText('2,847', 30 * scale, m); ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = `700 ${24 * scale}px sans-serif`;
  ctx.fillText('Length: 156', 30 * scale, m + 35 * scale);
  ctx.fillText('Kills: 12', 30 * scale, m + 60 * scale);
}

function screenshot(device, idx, drawFn) {
  const c = createCanvas(device.w, device.h);
  const ctx = c.getContext('2d');
  const scale = device.w / 1242;
  drawFn(ctx, device.w, device.h, scale);
  const buf = c.toBuffer('image/png');
  const name = `${device.name}_${idx}.png`;
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log(`Generated ${name} (${device.w}x${device.h})`);
}

// Screenshot 1: Gameplay
function drawGameplay(ctx, w, h, s) {
  drawBg(ctx, w, h);
  drawFood(ctx, w, h, 80);
  drawSnake(ctx, w * 0.5, h * 0.5, 30, '#00e5ff', '#006064', -0.3, s);
  drawSnake(ctx, w * 0.2, h * 0.35, 15, '#76ff03', '#33691e', 0.8, s * 0.8);
  drawSnake(ctx, w * 0.75, h * 0.6, 20, '#ff4081', '#880e4f', 2.5, s * 0.9);
  drawHUD(ctx, w, s);
  drawTitle(ctx, w, h * 0.12, 'Collect & Grow!', 56 * s);
}

// Screenshot 2: Kill action
function drawAction(ctx, w, h, s) {
  drawBg(ctx, w, h);
  drawFood(ctx, w, h, 60);
  drawSnake(ctx, w * 0.45, h * 0.45, 40, '#00e5ff', '#006064', -0.5, s);
  drawSnake(ctx, w * 0.55, h * 0.48, 12, '#ff9100', '#e65100', 1.2, s * 0.7);
  // Particles
  for (let i = 0; i < 20; i++) {
    const px = w * 0.5 + (Math.random() - 0.5) * 200 * s;
    const py = h * 0.46 + (Math.random() - 0.5) * 200 * s;
    ctx.fillStyle = '#ff9100'; ctx.globalAlpha = 0.6 + Math.random() * 0.4;
    ctx.beginPath(); ctx.arc(px, py, (3 + Math.random() * 5) * s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  drawHUD(ctx, w, s);
  drawTitle(ctx, w, h * 0.12, 'Cut & Eliminate!', 56 * s);
}

// Screenshot 3: Power-ups
function drawPowerups(ctx, w, h, s) {
  drawBg(ctx, w, h);
  drawFood(ctx, w, h, 50);
  drawSnake(ctx, w * 0.5, h * 0.5, 35, '#00e5ff', '#006064', 0.2, s);
  // Shield aura
  ctx.strokeStyle = 'rgba(64,196,255,0.4)'; ctx.lineWidth = 4 * s;
  ctx.shadowColor = '#40c4ff'; ctx.shadowBlur = 15 * s;
  ctx.beginPath(); ctx.arc(w * 0.5, h * 0.5, 30 * s, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0;
  // Power-up icons
  const pus = [{ x: w * 0.2, c: '#ffab00', l: 'SPEED' }, { x: w * 0.4, c: '#40c4ff', l: 'SHIELD' }, { x: w * 0.6, c: '#76ff03', l: 'MAGNET' }, { x: w * 0.8, c: '#d500f9', l: 'GHOST' }];
  pus.forEach(pu => {
    ctx.fillStyle = pu.c; ctx.shadowColor = pu.c; ctx.shadowBlur = 15 * s;
    ctx.beginPath(); ctx.arc(pu.x, h * 0.3, 20 * s, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff'; ctx.font = `bold ${16 * s}px sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(pu.l, pu.x, h * 0.3 + 40 * s);
  });
  drawHUD(ctx, w, s);
  drawTitle(ctx, w, h * 0.12, '4 Power-ups!', 56 * s);
}

// Screenshot 4: Leaderboard
function drawLeaderboard(ctx, w, h, s) {
  drawBg(ctx, w, h);
  drawFood(ctx, w, h, 40);
  drawSnake(ctx, w * 0.5, h * 0.55, 50, '#00e5ff', '#006064', -1.0, s);
  drawHUD(ctx, w, s);
  // Leaderboard
  const lx = w * 0.6, ly = h * 0.25;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(lx, ly, w * 0.35, 200 * s);
  const names = ['You (312)', 'Viper (287)', 'Neon (245)', 'Storm (198)', 'Blaze (156)'];
  names.forEach((n, i) => {
    ctx.fillStyle = i === 0 ? '#00e5ff' : 'rgba(255,255,255,0.6)';
    ctx.font = `${i === 0 ? 'bold ' : ''}${20 * s}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText((i + 1) + '. ' + n, lx + 15 * s, ly + 35 * s + i * 35 * s);
  });
  drawTitle(ctx, w, h * 0.12, 'Climb the Ranks!', 56 * s);
}

// Screenshot 5: Skins
function drawSkins(ctx, w, h, s) {
  drawBg(ctx, w, h);
  drawTitle(ctx, w, h * 0.12, '50+ Skins!', 56 * s);
  const skinColors = [
    ['#00e5ff', '#006064'], ['#76ff03', '#33691e'], ['#ff9100', '#e65100'],
    ['#ff4081', '#880e4f'], ['#ffd600', '#f57f17'], ['#7c4dff', '#311b92'],
    ['#d500f9', '#4a148c'], ['#00bcd4', '#009688'], ['#ff3d00', '#ff9100'],
    ['#ea80fc', '#80d8ff'], ['#69f0ae', '#448aff'], ['#ff1744', '#b71c1c'],
  ];
  const cols = 4, cellW = w / (cols + 1);
  skinColors.forEach((sc, i) => {
    const row = Math.floor(i / cols), col = i % cols;
    const cx = (col + 1) * cellW, cy = h * 0.25 + row * 160 * s;
    for (let j = 0; j < 6; j++) {
      const t = j / 6;
      const r1 = parseInt(sc[0].slice(1, 3), 16), g1 = parseInt(sc[0].slice(3, 5), 16), b1 = parseInt(sc[0].slice(5, 7), 16);
      const r2 = parseInt(sc[1].slice(1, 3), 16), g2 = parseInt(sc[1].slice(3, 5), 16), b2 = parseInt(sc[1].slice(5, 7), 16);
      const cr = Math.round(r1 + (r2 - r1) * t), cg = Math.round(g1 + (g2 - g1) * t), cb = Math.round(b1 + (b2 - b1) * t);
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      ctx.beginPath(); ctx.arc(cx - 30 * s + j * 12 * s, cy, (10 - t * 4) * s, 0, Math.PI * 2); ctx.fill();
    }
  });
}

// Generate all
[IPHONE, IPAD].forEach(device => {
  screenshot(device, 1, drawGameplay);
  screenshot(device, 2, drawAction);
  screenshot(device, 3, drawPowerups);
  screenshot(device, 4, drawLeaderboard);
  screenshot(device, 5, drawSkins);
});

console.log('All screenshots generated!');
