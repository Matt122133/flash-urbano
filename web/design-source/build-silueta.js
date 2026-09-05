// Extrae la silueta del camion del logo del cliente y la emite como PNG negro
// sobre transparente, para imprimirla en la etiqueta de `020`.
//
//   cd web
//   node design-source/build-silueta.js
//
// POR QUE ESTE ARCHIVO EXISTE, que es lo que no se ve mirando el resultado:
// **el logo no se puede poner sobre papel blanco.** `logo-flash-urbano.png`
// esta hecho para el fondo azul de la marca — *FLASH* es blanco, *LOGÍSTICA Y
// TRANSPORTE* es blanco, y la caja del camion tambien. Sobre una hoja blanca no
// queda un logo apagado: queda *URBANO* flotando y un contorno suelto. Es la
// misma razon por la que `app/icon.svg` pinta un cuadrado azul detras.
//
// Lo unico de la marca que sobrevive fuera del azul es la FORMA del camion, y
// eso es lo que este script recorta. El nombre no se copia de aca: la etiqueta
// lo compone como texto del documento.
//
// Ver specs/020-resumen-imprimible/research.md D3.
const fs = require("fs");
const path = require("path");
const { decode, encode } = require("fast-png");

const ENTRADA = path.join(__dirname, "..", "public", "logo-flash-urbano.png");
const SALIDA = path.join(__dirname, "..", "public", "silueta-camion.png");
// El MISMO pixel, embebido como data URI para que el PDF no dependa de una
// request. Se emiten los dos: el PNG para poder mirarlo, el modulo para usarlo.
const SALIDA_TS = path.join(__dirname, "..", "lib", "silueta-camion.ts");

const fallar = (msg) => {
  console.error(`build-silueta: ${msg}`);
  process.exit(1);
};

// **Se umbrala por ALFA, no por color, y esa es la decision entera.**
// El camion es blanco con contorno naranja, asi que umbralar por color daria un
// contorno hueco. Pero el PNG tiene canal alfa y el cuerpo blanco es OPACO, asi
// que el alfa da la silueta llena de una, sin rellenar nada.
const OPACO = 128;

// **De donde sale el camion, medido y no estimado.**
//
// Verticalmente el logo se separa solo: barriendo filas a la derecha del
// logotipo hay tres bandas con tinta y entre ellas hay filas vacias —
//
//     y =   0..174   el camion
//     y = 198..207   la linea naranja que cruza el logo
//     y = 225..244   la cola de "LOGÍSTICA Y TRANSPORTE"
//
// — asi que el corte de abajo NO va escrito a mano: se toma la primera banda
// desde arriba. Si el cliente retoca el logo y la marca cambia de alto, esto
// sigue funcionando.
//
// Horizontalmente **no hay ningun hueco**: las lineas de velocidad puentean el
// logotipo con el camion, y una barrida de columnas da una sola banda de
// x=2..599. Asi que este si es un numero afinado a mano, como el recorte de
// `build-favicon.js`.
//
// **Es un compromiso y conviene saber cual**, porque el camion y las lineas de
// velocidad se solapan en x. Lo que se probo:
//
//     400  entra un pedazo de la "O" de URBANO
//     430  camion entero, con dos lineas de velocidad cortadas al medio
//     436  camion entero; queda un resto minimo de linea contra el borde  <-- elegido
//     449  borde limpio de la caja, pero **se come la rueda de atras**
//     455  ademas recorta el borde izquierdo de la caja
//
// La rueda de atras empieza en x=436 y las lineas de velocidad siguen hasta ahi,
// asi que **no existe un corte que conserve el camion entero y no deje resto**.
// Se prioriza el camion completo: un resto de unos pixeles desaparece al tamaño
// que esto se imprime, una rueda mordida no.
const X_CAMION = 436;

const png = decode(fs.readFileSync(ENTRADA));
const { width: W, height: H, channels } = png;
if (channels !== 4) fallar(`la fuente no tiene canal alfa (${channels} canales)`);

const datos = png.data;
const opaco = (x, y) => datos[(y * W + x) * 4 + 3] >= OPACO;

// --- 1. La primera banda horizontal con tinta: el camion. -------------------
let bandaFin = null;
let vistaTinta = false;
for (let y = 0; y < H; y++) {
  let hay = false;
  for (let x = X_CAMION; x < W && !hay; x++) if (opaco(x, y)) hay = true;
  if (hay) vistaTinta = true;
  else if (vistaTinta) {
    bandaFin = y - 1;
    break;
  }
}
if (bandaFin === null) fallar("no se encontro una banda de tinta separada del resto");

// --- 2. Componentes conexas: se descartan las MOTAS, no las piezas. ---------
//
// **El camion NO es una pieza sola**, y suponer que si fue el primer error de
// este script. Medido, son cinco componentes y las cinco son el camion:
//
//     11082 px  x=430..531  y=  0..133   la caja
//      5749 px  x=518..599  y= 30..133   la cabina
//      1760 px  x=430..588  y=114..147   el chasis
//      1092 px  x=436..472  y=129..166   la rueda de atras
//      1079 px  x=532..567  y=129..166   la rueda de adelante
//
// Quedarse con la mas grande dejaba **solo la caja**. Asi que se conservan
// todas y el filtro sirve nada mas para descartar motas: pedazos de linea de
// velocidad o restos del logotipo que el recorte no atrapo. El umbral esta
// bien lejos de la pieza real mas chica (1079 px).
const MINIMO_PIEZA = 300;
const marca = new Int32Array(W * (bandaFin + 1)).fill(-1);
let grupos = [];
for (let y = 0; y <= bandaFin; y++) {
  for (let x = X_CAMION; x < W; x++) {
    if (!opaco(x, y) || marca[y * W + x] !== -1) continue;
    const id = grupos.length;
    const pila = [[x, y]];
    marca[y * W + x] = id;
    let n = 0;
    while (pila.length) {
      const [cx, cy] = pila.pop();
      n++;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < X_CAMION || nx >= W || ny < 0 || ny > bandaFin) continue;
        if (!opaco(nx, ny) || marca[ny * W + nx] !== -1) continue;
        marca[ny * W + nx] = id;
        pila.push([nx, ny]);
      }
    }
    grupos.push(n);
  }
}
if (!grupos.length) fallar("no quedo ningun pixel opaco despues del recorte");

const piezas = new Set(grupos.map((n, i) => (n >= MINIMO_PIEZA ? i : -1)).filter((i) => i >= 0));
const motas = grupos.filter((n) => n < MINIMO_PIEZA);
if (!piezas.size) fallar("ninguna componente supero el minimo de pieza");
const esCamion = (i) => piezas.has(i);

// --- 3. Recortar al contenido y emitir. -------------------------------------
let minX = W, maxX = 0, minY = H, maxY = 0;
for (let y = 0; y <= bandaFin; y++)
  for (let x = X_CAMION; x < W; x++)
    if (esCamion(marca[y * W + x])) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

const w = maxX - minX + 1;
const h = maxY - minY + 1;
const salida = new Uint8Array(w * h * 4);
let pintados = 0;
for (let y = 0; y < h; y++)
  for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    // RGB en 0 = negro. El alfa es la silueta.
    if (esCamion(marca[(minY + y) * W + (minX + x)])) {
      salida[i + 3] = 255;
      pintados++;
    }
  }

const buf = Buffer.from(encode({ width: w, height: h, data: salida, channels: 4, depth: 8 }));
fs.writeFileSync(SALIDA, buf);

// **Por que tambien un modulo TS y no solo el PNG en `public/`.**
// Servido desde `public/` habria que ir a buscarlo con una request, y una
// request falla: la etiqueta quedaria dependiendo de la red para dibujar un
// logo. Embebido, generar el PDF no toca nada. Es la misma decision que `002`
// tomo con las zonas —el dato en el bundle y no en `public/`— y la misma que
// `app/icon.svg`, que lleva su PNG en base64 adentro.
//
// Cuesta ~33% mas que el binario por el base64, sobre un archivo de 2 KB.
fs.writeFileSync(
  SALIDA_TS,
  `// ARCHIVO GENERADO — NO EDITAR A MANO.
//
// Regenerar con:
//   cd web
//   node design-source/build-silueta.js
//
// La silueta del camion de la marca, recortada del logo del cliente y embebida
// para que dibujar la etiqueta no dependa de ninguna request. El PNG equivalente
// vive en public/silueta-camion.png y esta para poder mirarlo.

/** PNG negro sobre transparente, ${w}x${h}. */
export const SILUETA_CAMION = "data:image/png;base64,${buf.toString("base64")}";

/** Proporcion ancho/alto, para escalarla sin deformarla. */
export const SILUETA_PROPORCION = ${(w / h).toFixed(6)};
`,
);

console.log(`escrito ${path.relative(process.cwd(), SALIDA)}`);
console.log(`  recorte: x>=${X_CAMION}, y<=${bandaFin} (primera banda de tinta)`);
console.log(`  ${piezas.size} pieza(s): ${[...piezas].map((i) => grupos[i]).sort((a, b) => b - a).join(", ")} px`);
console.log(motas.length ? `  ${motas.length} mota(s) descartada(s): ${motas.join(", ")} px` : "  sin motas");
console.log(`  silueta: ${w}x${h}, ${pintados} px pintados, ${(buf.length / 1024).toFixed(1)} KB`);
console.log(`  tambien escrito ${path.relative(process.cwd(), SALIDA_TS)}`);
