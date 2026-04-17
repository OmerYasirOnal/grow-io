const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'assets');

function generate(size, filename) {
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  const cx = size / 2, cy = size / 2;

  // Background gradient
  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.7);
  bg.addColorStop(0, '#0d1030');
  bg.addColorStop(1, '#0a0a1a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Subtle grid
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = size * 0.002;
  const gs = size / 12;
  for (let x = gs; x < size; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke(); }
  for (let y = gs; y < size; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke(); }

  // Snake body - spiral
  const colors = ['#00e5ff', '#00bcd4', '#0097a7', '#00838f', '#006064'];
  const segCount = 20;
  const baseR = size * 0.25;
  for (let i = segCount - 1; i >= 0; i--) {
    const t = i / segCount;
    const angle = t * Math.PI * 3.5 + Math.PI * 0.5;
    const r = baseR * (0.4 + t * 0.6);
    const sx = cx + Math.cos(angle) * r;
    const sy = cy * 0.95 + Math.sin(angle) * r * 0.8;
    const segR = size * (0.04 + (1 - t) * 0.03);

    const ci = Math.floor(t * (colors.length - 1));
    ctx.fillStyle = colors[ci];
    ctx.shadowColor = colors[ci];
    ctx.shadowBlur = size * 0.03;
    ctx.beginPath();
    ctx.arc(sx, sy, segR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Snake head (first segment position)
  const headAngle = Math.PI * 0.5;
  const headR = baseR * 0.4;
  const hx = cx + Math.cos(headAngle) * headR;
  const hy = cy * 0.95 + Math.sin(headAngle) * headR * 0.8;
  const headSize = size * 0.065;

  ctx.fillStyle = '#00e5ff';
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = size * 0.06;
  ctx.beginPath();
  ctx.arc(hx, hy, headSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Eyes
  const eyeR = headSize * 0.3;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(hx - headSize * 0.3, hy - headSize * 0.2, eyeR, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(hx + headSize * 0.3, hy - headSize * 0.2, eyeR, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(hx - headSize * 0.25, hy - headSize * 0.25, eyeR * 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(hx + headSize * 0.25, hy - headSize * 0.25, eyeR * 0.5, 0, Math.PI * 2); ctx.fill();

  // Food particles scattered
  const foodColors = ['#76ff03', '#ff4081', '#ffab00', '#7c4dff', '#00e5ff'];
  for (let i = 0; i < 30; i++) {
    const fx = Math.random() * size;
    const fy = Math.random() * size;
    const fr = size * (0.005 + Math.random() * 0.01);
    const fc = foodColors[Math.floor(Math.random() * foodColors.length)];
    ctx.fillStyle = fc;
    ctx.shadowColor = fc;
    ctx.shadowBlur = size * 0.01;
    ctx.beginPath();
    ctx.arc(fx, fy, fr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // "GROW" text
  const fontSize = size * 0.13;
  ctx.font = `900 ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#00e5ff';
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = size * 0.04;
  ctx.fillText('GROW', cx, size * 0.82);
  ctx.shadowBlur = 0;

  // ".io" subtitle
  ctx.font = `700 ${fontSize * 0.45}px sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('.io', cx + fontSize * 1.1, size * 0.82);

  // Save
  const buf = c.toBuffer('image/png');
  fs.writeFileSync(path.join(OUT, filename), buf);
  console.log(`Generated ${filename} (${size}x${size})`);
}

function generateSplash(size, filename) {
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');

  // Dark background
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, size, size);

  // Title
  const fontSize = size * 0.15;
  ctx.font = `900 ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#00e5ff';
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = size * 0.05;
  ctx.fillText('GROW', size / 2, size * 0.45);
  ctx.shadowBlur = 0;

  ctx.font = `700 ${fontSize * 0.45}px sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('.io', size / 2 + fontSize * 1.1, size * 0.45);

  const buf = c.toBuffer('image/png');
  fs.writeFileSync(path.join(OUT, filename), buf);
  console.log(`Generated ${filename} (${size}x${size})`);
}

// Generate all
generate(1024, 'icon.png');
generate(1024, 'adaptive-icon.png');
generateSplash(1024, 'splash-icon.png');
console.log('All icons generated!');
