// quantitative proof-frame analyzer — no image viewer needed
const fs = require('fs'), zlib = require('zlib'), path = require('path');
function decodePNG(p) {
  const buf = fs.readFileSync(p); let pos = 8, W = 0, H = 0, ct = 0; const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8), d = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { W = d.readUInt32BE(0); H = d.readUInt32BE(4); ct = d[9]; }
    if (type === 'IDAT') idat.push(d);
    if (type === 'IEND') break; pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : 1, stride = W * ch;
  const out = Buffer.alloc(W * H * ch); let prev = Buffer.alloc(stride);
  for (let y = 0; y < H; y++) {
    const f = raw[y * (stride + 1)], line = raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1)), cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0, b = prev[x], c = x >= ch ? prev[x - ch] : 0; let v = line[x];
      if (f === 1) v = (v + a) & 255; else if (f === 2) v = (v + b) & 255; else if (f === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255; }
      cur[x] = v;
    }
    cur.copy(out, y * stride); prev = cur;
  }
  return { W, H, ch, data: out };
}
function analyze(file) {
  const { W, H, ch, data } = decodePNG(file);
  let lo = 0, mid = 0, hi = 0, sat = 0, warm = 0, cool = 0;
  let rSum = 0, gSum = 0, bSum = 0;
  // band where the active lyric sits (lower-middle third, y ~ 55-75%)
  const y0 = Math.floor(H * 0.55), y1 = Math.floor(H * 0.75);
  let bandHi = 0, bandLo = 0, bandN = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * ch, r = data[i], g = data[i + 1], b = data[i + 2];
    const l = (r + g + b) / 3;
    rSum += r; gSum += g; bSum += b;
    if (l < 60) lo++; else if (l < 170) mid++; else hi++;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx - mn > 60) sat++;
    if (r > b + 25) warm++; else if (b > r + 25) cool++;
    if (y >= y0 && y < y1) {
      bandN++;
      if (l > 150) bandHi++; else if (l < 55) bandLo++;
    }
  }
  const n = W * H;
  const avgR = rSum / n, avgG = gSum / n, avgB = bSum / n;
  return {
    file: path.basename(file), dims: `${W}x${H}`,
    mean: `rgb(${avgR | 0},${avgG | 0},${avgB | 0})`,
    dark: (lo / n * 100).toFixed(0) + '%',
    mid: (mid / n * 100).toFixed(0) + '%',
    bright: (hi / n * 100).toFixed(0) + '%',
    sat: (sat / n * 100).toFixed(0) + '%',
    warm: (warm / n * 100).toFixed(0) + '%', cool: (cool / n * 100).toFixed(0) + '%',
    lyricBand_bright: (bandHi / bandN * 100).toFixed(0) + '%',
    lyricBand_dark: (bandLo / bandN * 100).toFixed(0) + '%',
  };
}
const dir = path.join(__dirname, 'proof');
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort()) {
  console.log(JSON.stringify(analyze(path.join(dir, f))));
}
