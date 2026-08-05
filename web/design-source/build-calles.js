// Convierte los ejes viales del curso de TSIG en public/calles-mvd.json, el
// indice con el que el formulario resuelve una direccion a partir de calle y
// esquina.
//
//   node design-source/build-calles.js <carpeta-con-los-sql> public/calles-mvd.json
//
// Se emite JSON servido desde public/ y NO un modulo TypeScript como
// lib/zonas.ts: son ~0,9 MB, y meterlos en el bundle penalizaria a todo el que
// entra al sitio aunque nunca cargue una direccion. Ver
// specs/003-direccion-por-esquina/research.md R5.
//
// El script falla ruidosamente ante cualquier anomalia. Un indice generado a
// medias es peor que ninguno cuando de el sale donde hay que ir a buscar un
// paquete.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const SRC = process.argv[2];
const OUT = process.argv[3];

if (!SRC || !OUT) {
  console.error(
    "uso: node design-source/build-calles.js <carpeta-con-los-sql> <salida.json>",
  );
  process.exit(1);
}

const fallar = (msg) => {
  console.error(`build-calles: ${msg}`);
  process.exit(1);
};

// ---------------------------------------------------------------------------
// Area de servicio
// ---------------------------------------------------------------------------

// El recorte sale de las zonas reales (FR-006), no de un recuadro escrito a
// mano: si el cliente corrige un limite y las zonas se regeneran, el area de
// este indice lo sigue. Se lee lib/zonas.ts como texto en vez de importarlo
// porque este script es CommonJS y aquello es TypeScript.
const MARGEN_GRADOS = 0.02; // ~2 km, para que las esquinas del borde tengan contiguas

function areaDeServicio() {
  const ruta = path.join(__dirname, "..", "lib", "zonas.ts");
  let texto;
  try {
    texto = fs.readFileSync(ruta, "utf8");
  } catch {
    fallar(`no se pudo leer ${ruta}; hace falta para saber el area de servicio`);
  }

  const pares = [...texto.matchAll(/\[\s*(-?\d+\.\d+),\s*(-?\d+\.\d+)\s*\]/g)];
  if (pares.length < 100) fallar("lib/zonas.ts no trajo vertices reconocibles");

  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of pares) {
    const lat = Number(p[1]);
    const lng = Number(p[2]);
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return {
    minLat: minLat - MARGEN_GRADOS,
    maxLat: maxLat + MARGEN_GRADOS,
    minLng: minLng - MARGEN_GRADOS,
    maxLng: maxLng + MARGEN_GRADOS,
  };
}

// ---------------------------------------------------------------------------
// Nombres
// ---------------------------------------------------------------------------

// Nombres que no son un nombre: son la clasificacion de la via. No se ofrecen
// nunca como sugerencia (FR-004).
const GENERICOS = new Set([
  "vehicular/ peatonal",
  "vehicular / peatonal",
  "vehicular",
  "peatonal",
  "camino vecinal",
  "sin nombre",
]);

const normalizar = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// ---------------------------------------------------------------------------
// Lectura de la geometria
// ---------------------------------------------------------------------------

// Los .sql son INSERT con la geometria en WKB hexadecimal. Se parsea a mano
// para no arrastrar dependencias: el formato es fijo y son tres campos.
const RE_INSERT = /VALUES \((\d+), (NULL|'(?:[^']|'')*'), '([0-9A-Fa-f]+)'\)/;

function leerLineString(hex) {
  const buf = Buffer.from(hex, "hex");
  // byte 0: orden de bytes (1 = little endian). bytes 1-4: tipo con flag de
  // SRID. bytes 5-8: el SRID. byte 9: cantidad de puntos.
  if (buf[0] !== 1) return null;
  const n = buf.readUInt32LE(9);
  if (n < 2) return null;
  const pts = new Array(n);
  for (let i = 0; i < n; i++) {
    const o = 13 + i * 16;
    // El dato viene lon,lat; el sitio y Leaflet trabajan en [lat, lng].
    pts[i] = [buf.readDoubleLE(o + 8), buf.readDoubleLE(o)];
  }
  return pts;
}

function cargarPolilineas(carpeta, area) {
  let archivos;
  try {
    archivos = fs
      .readdirSync(carpeta)
      .filter((f) => /ft_street.*\.sql$/i.test(f))
      .sort();
  } catch {
    fallar(`no se pudo leer la carpeta ${carpeta}`);
  }
  if (archivos.length === 0) {
    fallar(`no hay archivos ft_street*.sql en ${carpeta}`);
  }

  const polilineas = [];
  const conteo = { total: 0, sinNombre: 0, genericos: 0, fueraDelArea: 0 };

  for (const archivo of archivos) {
    const texto = fs.readFileSync(path.join(carpeta, archivo), "utf8");
    for (const linea of texto.split("\n")) {
      const m = RE_INSERT.exec(linea);
      if (!m) continue;
      conteo.total++;

      const pts = leerLineString(m[3]);
      if (!pts) continue;

      // Basta con el primer vertice para decidir el recorte: los tramos son
      // cortos y el margen del area cubre los que quedan a caballo.
      const [lat0, lng0] = pts[0];
      if (
        lat0 < area.minLat || lat0 > area.maxLat ||
        lng0 < area.minLng || lng0 > area.maxLng
      ) {
        conteo.fueraDelArea++;
        continue;
      }

      if (m[2] === "NULL") {
        conteo.sinNombre++;
        continue;
      }
      const nombre = m[2].slice(1, -1).replace(/''/g, "'").trim();
      if (!nombre || GENERICOS.has(normalizar(nombre))) {
        conteo.genericos++;
        continue;
      }

      polilineas.push({ nombre, pts });
    }
  }

  if (polilineas.length === 0) fallar("no quedo ninguna polilinea util");
  return { polilineas, conteo };
}

// ---------------------------------------------------------------------------
// Union de polilineas de una misma calle
// ---------------------------------------------------------------------------

// Una calle no viene como una linea sino partida en varios tramos. Si las
// esquinas contiguas se calcularan tramo por tramo, la cuadra se cortaria en
// cada juntura y el pin no podria moverse: medido sobre el dato crudo, el 4,9%
// de las esquinas quedaba con region de largo cero y el 44% con un solo lado.
//
// Por eso, antes de intersectar, se encadenan las polilineas del mismo nombre
// que se continuan punta con punta. Solo se unen junturas inequivocas — donde
// se encuentran exactamente dos extremos — para no inventar una continuidad
// que el dato no afirma en un cruce o una bifurcacion.
const clavePunto = (p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;

function unirPorNombre(polilineas) {
  const porNombre = new Map();
  for (const pl of polilineas) {
    let lista = porNombre.get(pl.nombre);
    if (!lista) porNombre.set(pl.nombre, (lista = []));
    lista.push(pl.pts);
  }

  const unidas = [];
  for (const [nombre, tramos] of porNombre) {
    // Cada punta apunta a los tramos que la tocan.
    const puntas = new Map();
    tramos.forEach((pts, i) => {
      for (const punta of [clavePunto(pts[0]), clavePunto(pts[pts.length - 1])]) {
        let lista = puntas.get(punta);
        if (!lista) puntas.set(punta, (lista = []));
        lista.push(i);
      }
    });

    const usados = new Array(tramos.length).fill(false);

    // Devuelve el unico tramo sin usar que continua por esta punta, o null si
    // no hay o si hay mas de uno.
    const siguiente = (punta, propio) => {
      const lista = puntas.get(punta) || [];
      const otros = lista.filter((i) => i !== propio && !usados[i]);
      // La punta la comparten dos extremos: el propio y a lo sumo un vecino.
      if (lista.length !== 2 || otros.length !== 1) return null;
      return otros[0];
    };

    for (let i = 0; i < tramos.length; i++) {
      if (usados[i]) continue;
      usados[i] = true;
      let cadena = tramos[i].slice();

      // Hacia adelante.
      for (;;) {
        const fin = cadena[cadena.length - 1];
        const j = siguiente(clavePunto(fin), -1);
        if (j === null) break;
        usados[j] = true;
        const otro = tramos[j];
        cadena = clavePunto(otro[0]) === clavePunto(fin)
          ? cadena.concat(otro.slice(1))
          : cadena.concat(otro.slice(0, -1).reverse());
      }

      // Hacia atras.
      for (;;) {
        const ini = cadena[0];
        const j = siguiente(clavePunto(ini), -1);
        if (j === null) break;
        usados[j] = true;
        const otro = tramos[j];
        cadena = clavePunto(otro[otro.length - 1]) === clavePunto(ini)
          ? otro.slice(0, -1).concat(cadena)
          : otro.slice(1).reverse().concat(cadena);
      }

      unidas.push({ nombre, pts: cadena });
    }
  }
  return unidas;
}

// ---------------------------------------------------------------------------
// Interseccion
// ---------------------------------------------------------------------------

function cruce(a1, a2, b1, b2) {
  const [y1, x1] = a1, [y2, x2] = a2, [y3, x3] = b1, [y4, x4] = b2;
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
  if (d === 0) return null;
  const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
  const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
  if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
  return { lat: y1 + t * (y2 - y1), lng: x1 + t * (x2 - x1), t, u };
}

const CELDA = 0.0005; // ~50 m. Chica para que cada celda tenga pocos tramos.

function calcularCruces(polilineas) {
  const grilla = new Map();
  const tramos = [];

  for (let pi = 0; pi < polilineas.length; pi++) {
    const pts = polilineas[pi].pts;
    for (let k = 0; k < pts.length - 1; k++) {
      const ti = tramos.length;
      tramos.push({ pi, k, a: pts[k], b: pts[k + 1] });
      const a = pts[k], b = pts[k + 1];
      const y0 = Math.floor(Math.min(a[0], b[0]) / CELDA);
      const y1 = Math.floor(Math.max(a[0], b[0]) / CELDA);
      const x0 = Math.floor(Math.min(a[1], b[1]) / CELDA);
      const x1 = Math.floor(Math.max(a[1], b[1]) / CELDA);
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const clave = y * 1000000 + x;
          let lista = grilla.get(clave);
          if (!lista) grilla.set(clave, (lista = []));
          lista.push(ti);
        }
      }
    }
  }

  // Cada cruce se guarda dos veces, una por polilinea, con su posicion a lo
  // largo de ella. Esa posicion es lo que despues permite ordenar las esquinas
  // de una calle y saber cuales son contiguas (research R7).
  const crudos = [];
  const vistos = new Set();

  for (const lista of grilla.values()) {
    for (let i = 0; i < lista.length; i++) {
      const ti = lista[i];
      const A = tramos[ti];
      for (let j = i + 1; j < lista.length; j++) {
        const tj = lista[j];
        const B = tramos[tj];
        // Una calle no se cruza consigo misma. Se compara por nombre y no por
        // polilinea porque una avenida son varias polilineas del mismo nombre.
        if (polilineas[A.pi].nombre === polilineas[B.pi].nombre) continue;
        const clave = ti * 4294967296 + tj;
        if (vistos.has(clave)) continue;
        vistos.add(clave);
        const c = cruce(A.a, A.b, B.a, B.b);
        if (!c) continue;
        crudos.push({
          lat: c.lat,
          lng: c.lng,
          piA: A.pi, posA: A.k + c.t,
          piB: B.pi, posB: B.k + c.u,
        });
      }
    }
  }

  return crudos;
}

// ---------------------------------------------------------------------------
// Colapso de calzadas dobles
// ---------------------------------------------------------------------------

// Una avenida con cantero central son dos polilineas paralelas, asi que el
// cruce con otra avenida igual genera hasta cuatro puntos. 60 m cubre el ancho
// de una avenida con cantero sin llegar a fusionar dos esquinas consecutivas,
// que en Montevideo estan a 80-100 m (research R4).
const TOL_COLAPSO_M = 60;

const METROS_POR_GRADO_LAT = 110540;
const metrosPorGradoLng = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);

function distanciaM(lat1, lng1, lat2, lng2) {
  const dy = (lat2 - lat1) * METROS_POR_GRADO_LAT;
  const dx = (lng2 - lng1) * metrosPorGradoLng(lat1);
  return Math.hypot(dx, dy);
}

function colapsar(crudos, polilineas) {
  const porPar = new Map();
  for (const c of crudos) {
    const na = polilineas[c.piA].nombre;
    const nb = polilineas[c.piB].nombre;
    const clave = na < nb ? `${na} ${nb}` : `${nb} ${na}`;
    let lista = porPar.get(clave);
    if (!lista) porPar.set(clave, (lista = []));
    lista.push(c);
  }

  const esquinas = [];
  for (const lista of porPar.values()) {
    const grupos = [];
    for (const c of lista) {
      const g = grupos.find(
        (grupo) => distanciaM(grupo[0].lat, grupo[0].lng, c.lat, c.lng) < TOL_COLAPSO_M,
      );
      if (g) g.push(c);
      else grupos.push([c]);
    }
    for (const g of grupos) {
      // Se conserva un representante por polilinea para poder ubicar la esquina
      // dentro de cada calle; el punto es el centroide del grupo.
      esquinas.push({
        lat: g.reduce((s, c) => s + c.lat, 0) / g.length,
        lng: g.reduce((s, c) => s + c.lng, 0) / g.length,
        piA: g[0].piA, posA: g[0].posA,
        piB: g[0].piB, posB: g[0].posB,
      });
    }
  }
  return esquinas;
}

// ---------------------------------------------------------------------------
// Esquinas contiguas
// ---------------------------------------------------------------------------

// Para cada esquina, hasta donde llega la cuadra sobre cada una de sus dos
// calles. Es lo que acota el arrastre del pin (FR-014) sin tener que embarcar
// la geometria completa.
//
// El orden se toma dentro de una misma polilinea. Cuando de un lado no hay otra
// esquina, el limite es la punta de la polilinea: la cuadra se extiende hasta
// donde llega el tramo, que es lo mas cercano a la verdad que se puede afirmar.
function resolverContiguas(esquinas, polilineas) {
  const porPolilinea = new Map();
  const anotar = (pi, pos, esquina, lado) => {
    let lista = porPolilinea.get(pi);
    if (!lista) porPolilinea.set(pi, (lista = []));
    lista.push({ pos, esquina, lado });
  };
  for (const e of esquinas) {
    anotar(e.piA, e.posA, e, "A");
    anotar(e.piB, e.posB, e, "B");
  }

  const puntoEn = (pts, pos) => {
    const k = Math.min(Math.floor(pos), pts.length - 2);
    const t = pos - k;
    const a = pts[k], b = pts[k + 1];
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  };

  for (const [pi, lista] of porPolilinea) {
    const pts = polilineas[pi].pts;
    lista.sort((x, y) => x.pos - y.pos);
    for (let i = 0; i < lista.length; i++) {
      const { esquina, lado } = lista[i];
      const antes = i > 0 ? puntoEn(pts, lista[i - 1].pos) : pts[0];
      const despues =
        i < lista.length - 1 ? puntoEn(pts, lista[i + 1].pos) : pts[pts.length - 1];
      esquina[`antes${lado}`] = antes;
      esquina[`despues${lado}`] = despues;
    }
  }
}

// ---------------------------------------------------------------------------
// Emision
// ---------------------------------------------------------------------------

// Los desplazamientos van como enteros en unidades de 1e-5 grados (~1 m). Es
// resolucion de sobra para una cuadra, y son numeros chicos y repetidos, que es
// lo que comprime bien (research R7).
const ESCALA = 1e5;
const delta = (base, punto) => [
  Math.round((punto[0] - base[0]) * ESCALA),
  Math.round((punto[1] - base[1]) * ESCALA),
];

function emitir(esquinas, polilineas) {
  const indiceDeCalle = new Map();
  const calles = [];
  const idDe = (nombre) => {
    let id = indiceDeCalle.get(nombre);
    if (id === undefined) {
      id = calles.length;
      calles.push(nombre);
      indiceDeCalle.set(nombre, id);
    }
    return id;
  };

  const filas = [];
  for (const e of esquinas) {
    const base = [e.lat, e.lng];
    const a = idDe(polilineas[e.piA].nombre);
    const b = idDe(polilineas[e.piB].nombre);
    const [aaLat, aaLng] = delta(base, e.antesA || base);
    const [adLat, adLng] = delta(base, e.despuesA || base);
    const [baLat, baLng] = delta(base, e.antesB || base);
    const [bdLat, bdLng] = delta(base, e.despuesB || base);
    filas.push([
      a, b,
      Number(e.lat.toFixed(6)), Number(e.lng.toFixed(6)),
      aaLat, aaLng, adLat, adLng,
      baLat, baLng, bdLat, bdLng,
    ]);
  }

  return { version: 1, escala: ESCALA, calles, esquinas: filas };
}

// ---------------------------------------------------------------------------

const area = areaDeServicio();
console.log(
  `area de servicio: lat ${area.minLat.toFixed(4)}..${area.maxLat.toFixed(4)}, ` +
    `lng ${area.minLng.toFixed(4)}..${area.maxLng.toFixed(4)}`,
);

const { polilineas: sueltas, conteo } = cargarPolilineas(SRC, area);
console.log(`tramos leidos:        ${conteo.total}`);
console.log(`  fuera del area:     ${conteo.fueraDelArea}`);
console.log(`  sin nombre:         ${conteo.sinNombre}`);
console.log(`  nombre generico:    ${conteo.genericos}`);
console.log(`polilineas utiles:    ${sueltas.length}`);

const polilineas = unirPorNombre(sueltas);
console.log(`tras unir por calle:  ${polilineas.length}`);

const crudos = calcularCruces(polilineas);
console.log(`puntos de cruce:      ${crudos.length}`);

const esquinas = colapsar(crudos, polilineas);
console.log(`esquinas colapsadas:  ${esquinas.length}`);

resolverContiguas(esquinas, polilineas);

const indice = emitir(esquinas, polilineas);
const json = JSON.stringify(indice);
fs.writeFileSync(OUT, json);

const crudoMB = Buffer.byteLength(json) / 1e6;
const gzipMB = zlib.gzipSync(json, { level: 9 }).length / 1e6;

console.log("");
console.log(`calles:               ${indice.calles.length}`);
console.log(`esquinas:             ${indice.esquinas.length}`);
console.log(`indice crudo:         ${crudoMB.toFixed(2)} MB`);
console.log(`indice comprimido:    ${gzipMB.toFixed(2)} MB`);

// SC-007 es un requisito, no una aspiracion: si el indice se pasa del techo el
// cliente lo paga en datos moviles, asi que el script lo dice y falla.
if (gzipMB > 1) {
  fallar(
    `el indice comprimido pesa ${gzipMB.toFixed(2)} MB y el techo es 1 MB (SC-007)`,
  );
}
console.log(`\nescrito en ${OUT}`);
