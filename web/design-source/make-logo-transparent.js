// Genera una versión con fondo transparente del logo de Flash Urbano.
// Usa flood-fill desde los bordes para borrar SOLO el fondo azul conectado,
// preservando los detalles internos del mismo azul (ruedas, contraformas).
const sharp = require("sharp");
const path = require("path");

const SRC = process.argv[2];
const OUT = process.argv[3];
const TOL = Number(process.argv[4] || 70);

(async () => {
  const img = sharp(SRC);
  const meta = await img.metadata();
  const { width: W, height: H } = meta;
  const raw = await img.ensureAlpha().raw().toBuffer(); // RGBA

  // Color de fondo: promedio de las 4 esquinas
  const corners = [
    [0, 0],
    [W - 1, 0],
    [0, H - 1],
    [W - 1, H - 1],
  ];
  let br = 0, bg = 0, bb = 0;
  for (const [x, y] of corners) {
    const i = (y * W + x) * 4;
    br += raw[i]; bg += raw[i + 1]; bb += raw[i + 2];
  }
  br /= 4; bg /= 4; bb /= 4;
  console.log(`fondo detectado: rgb(${br.toFixed(0)}, ${bg.toFixed(0)}, ${bb.toFixed(0)})`);

  const matches = (i) => {
    const dr = raw[i] - br, dg = raw[i + 1] - bg, db = raw[i + 2] - bb;
    return Math.sqrt(dr * dr + dg * dg + db * db) < TOL;
  };

  // Flood fill BFS desde todos los píxeles del borde
  const visited = new Uint8Array(W * H);
  const queue = new Int32Array(W * H);
  let head = 0, tail = 0;

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const p = y * W + x;
    if (visited[p]) return;
    if (!matches(p * 4)) return;
    visited[p] = 1;
    queue[tail++] = p;
  };

  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }

  while (head < tail) {
    const p = queue[head++];
    const x = p % W, y = (p / W) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }

  // Aplicar alpha 0 al fondo y calcular bbox del contenido
  let minX = W, minY = H, maxX = -1, maxY = -1, cleared = 0;
  for (let p = 0; p < W * H; p++) {
    if (visited[p]) {
      raw[p * 4 + 3] = 0;
      cleared++;
    } else {
      const x = p % W, y = (p / W) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  console.log(`píxeles transparentados: ${cleared} (${((cleared / (W * H)) * 100).toFixed(1)}%)`);
  console.log(`bbox contenido: ${minX},${minY} -> ${maxX},${maxY} (${maxX - minX + 1}x${maxY - minY + 1})`);

  await sharp(raw, { raw: { width: W, height: H, channels: 4 } })
    .extract({
      left: minX,
      top: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    })
    .resize({ width: 600, withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toFile(OUT);

  const outMeta = await sharp(OUT).metadata();
  console.log(`escrito: ${path.basename(OUT)} ${outMeta.width}x${outMeta.height}`);
})();
