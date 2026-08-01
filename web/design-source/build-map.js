// Genera el mapa final de zonas: rellenos semitransparentes por zona,
// etiquetas recoloreadas a juego y panel de leyenda con precios.
const sharp = require("sharp");

const SRC = process.argv[2];
const OUT = process.argv[3];
const R = Number(process.argv[4] || 12);
const ALPHA = 0.4;

const ZONES = [
  { zona: 1, precio: 150, cx: 577, cy: 464, color: [37, 99, 235] },
  { zona: 2, precio: 200, cx: 543, cy: 233, color: [5, 150, 105] },
  { zona: 3, precio: 250, cx: 177, cy: 301, color: [217, 119, 6] },
  { zona: 4, precio: 250, cx: 930, cy: 328, color: [147, 51, 234] },
  { zona: 5, precio: 350, cx: 1215, cy: 384, color: [220, 38, 38] },
];
const BOXES = {
  2: [500, 201, 586, 266], 3: [134, 269, 220, 334], 4: [887, 296, 973, 361],
  5: [1172, 352, 1258, 417], 1: [534, 431, 620, 497],
};
const allBoxes = Object.values(BOXES);
const inBox = (x, y) => allBoxes.some(([x0, y0, x1, y1]) =>
  x >= x0 - 4 && x <= x1 + 4 && y >= y0 - 4 && y <= y1 + 4);

const hex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");

(async () => {
  const img = sharp(SRC);
  const { width: W, height: H } = await img.metadata();
  const raw = await img.removeAlpha().raw().toBuffer();

  const base = new Uint8Array(W * H);
  const water = new Uint8Array(W * H);
  const labelBlue = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) {
    const r = raw[p * 3], g = raw[p * 3 + 1], b = raw[p * 3 + 2];
    if (b > 140 && r < 90 && g < 120 && b - r > 80) labelBlue[p] = 1;
    if (r < 80 && g < 80 && b < 80) base[p] = 1;
    else if (b - r > 18 && b > 195 && r > 130 && g > 170) { base[p] = 1; water[p] = 1; }
  }
  for (const [x0, y0, x1, y1] of allBoxes)
    for (let y = y0 - 3; y <= y1 + 3; y++)
      for (let x = x0 - 3; x <= x1 + 3; x++)
        if (x >= 0 && y >= 0 && x < W && y < H) base[y * W + x] = 0;

  const dilate = (src, times) => {
    let cur = src;
    for (let t = 0; t < times; t++) {
      const nx = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const p = y * W + x;
        if (cur[p]) { nx[p] = 1; continue; }
        if ((x > 0 && cur[p - 1]) || (x < W - 1 && cur[p + 1]) ||
            (y > 0 && cur[p - W]) || (y < H - 1 && cur[p + W])) nx[p] = 1;
      }
      cur = nx;
    }
    return cur;
  };

  const barrier = dilate(base, R);
  let owner = new Int8Array(W * H);
  const q = new Int32Array(W * H);
  for (const Z of ZONES) {
    let seed = -1;
    for (let rad = 0; rad < 300 && seed < 0; rad += 2)
      for (let a = 0; a < 360; a += 8) {
        const x = Math.round(Z.cx + rad * Math.cos((a * Math.PI) / 180));
        const y = Math.round(Z.cy + rad * Math.sin((a * Math.PI) / 180));
        if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1 || inBox(x, y)) continue;
        const p = y * W + x;
        if (!barrier[p]) { seed = p; break; }
      }
    if (seed < 0 || owner[seed]) { console.log(`aviso: zona ${Z.zona} sin region propia`); continue; }
    let head = 0, tail = 0; q[tail++] = seed; owner[seed] = Z.zona;
    while (head < tail) {
      const p = q[head++];
      const x = p % W, y = (p / W) | 0;
      if (x > 0 && !barrier[p - 1] && !owner[p - 1]) { owner[p - 1] = Z.zona; q[tail++] = p - 1; }
      if (x < W - 1 && !barrier[p + 1] && !owner[p + 1]) { owner[p + 1] = Z.zona; q[tail++] = p + 1; }
      if (y > 0 && !barrier[p - W] && !owner[p - W]) { owner[p - W] = Z.zona; q[tail++] = p - W; }
      if (y < H - 1 && !barrier[p + W] && !owner[p + W]) { owner[p + W] = Z.zona; q[tail++] = p + W; }
    }
  }
  for (let t = 0; t < R; t++) {
    const nx = new Int8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = y * W + x;
      if (owner[p]) { nx[p] = owner[p]; continue; }
      const c = [x > 0 ? owner[p - 1] : 0, x < W - 1 ? owner[p + 1] : 0,
                 y > 0 ? owner[p - W] : 0, y < H - 1 ? owner[p + W] : 0].find(Boolean);
      if (c) nx[p] = c;
    }
    owner = nx;
  }

  const byZone = Object.fromEntries(ZONES.map((z) => [z.zona, z.color]));
  const out = Buffer.from(raw);
  const areas = {};
  for (let p = 0; p < W * H; p++) {
    const z = owner[p];
    if (!z) continue;
    areas[z] = (areas[z] || 0) + 1;
    if (water[p]) continue;
    const c = byZone[z];
    // las cajas de etiqueta se recolorean solidas, no tintadas
    const x = p % W, y = (p / W) | 0;
    if (labelBlue[p] && inBox(x, y)) {
      out[p * 3] = c[0]; out[p * 3 + 1] = c[1]; out[p * 3 + 2] = c[2];
      continue;
    }
    for (let k = 0; k < 3; k++)
      out[p * 3 + k] = Math.round(raw[p * 3 + k] * (1 - ALPHA) + c[k] * ALPHA);
  }
  // etiquetas cuyo interior no quedo cubierto por su region
  for (const [zStr, rect] of Object.entries(BOXES)) {
    const c = byZone[zStr];
    const [x0, y0, x1, y1] = rect;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const p = y * W + x;
      if (labelBlue[p]) { out[p * 3] = c[0]; out[p * 3 + 1] = c[1]; out[p * 3 + 2] = c[2]; }
    }
  }
  console.log("cobertura por zona (% del lienzo):");
  ZONES.forEach((z) => console.log(`  zona ${z.zona} $${z.precio}: ${(((areas[z.zona] || 0) / (W * H)) * 100).toFixed(1)}%`));

  // --- leyenda sobre el agua (abajo a la izquierda) ---
  const LX = 18, LY = H - 226, LW = 300, LH = 210;
  const rows = ZONES.map((z, i) => {
    const y = LY + 80 + i * 26;
    return `
      <rect x="${LX + 18}" y="${y - 12}" width="16" height="16" rx="4" fill="${hex(z.color)}" opacity="0.85"/>
      <text x="${LX + 44}" y="${y + 1}" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="#0f172a">Zona ${z.zona}</text>
      <text x="${LX + LW - 18}" y="${y + 1}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="bold" fill="#0f172a">$ ${z.precio}</text>`;
  }).join("");
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${LX}" y="${LY}" width="${LW}" height="${LH}" rx="14" fill="#ffffff" opacity="0.94"/>
    <rect x="${LX}" y="${LY}" width="${LW}" height="${LH}" rx="14" fill="none" stroke="#cbd5e1" stroke-width="1"/>
    <text x="${LX + 18}" y="${LY + 32}" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="bold" fill="#0f172a">Zonas de entrega</text>
    <text x="${LX + 18}" y="${LY + 54}" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#64748b">Precio de referencia por envío</text>
    ${rows}
  </svg>`;

  await sharp(out, { raw: { width: W, height: H, channels: 3 } })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
    .toFile(OUT);

  const m = await sharp(OUT).metadata();
  console.log(`\nescrito ${OUT} ${m.width}x${m.height} ${(m.size / 1024).toFixed(0)}KB`);
})();
