// Convierte el KML de zonas que definio el cliente en lib/zonas.ts, el modulo
// tipado que consume el sitio.
//
//   node design-source/build-zonas.js design-source/zonas-flash-urbano.kml lib/zonas.ts
//
// Se emite codigo TypeScript y NO un .geojson servido desde public/ a proposito:
// importar el modulo lo mete en el bundle, asi el calculo del precio no depende
// de que salga bien una request. Ver specs/002-mapa-zonas-precio/research.md D3.
//
// El script falla ruidosamente ante cualquier anomalia. Un archivo generado a
// medias es peor que ninguno cuando de el depende cuanto se le cobra a alguien.
const fs = require("fs");

const SRC = process.argv[2];
const OUT = process.argv[3];

if (!SRC || !OUT) {
  console.error("uso: node design-source/build-zonas.js <entrada.kml> <salida.ts>");
  process.exit(1);
}

// Unico lugar donde vive un precio (FR-005). Los colores son de la paleta de
// Tailwind que ya usa el sitio, para que el mapa no desentone.
const ZONAS = {
  1: { precio: 150, color: "#2563eb" },
  2: { precio: 200, color: "#059669" },
  3: { precio: 250, color: "#d97706" },
  4: { precio: 250, color: "#9333ea" },
  5: { precio: 350, color: "#dc2626" },
};

const fallar = (msg) => {
  console.error(`build-zonas: ${msg}`);
  process.exit(1);
};

// El KML trae nombres como "Zona 4" (espacio duro) o "Zona  4". Colapsar a
// un solo espacio normal es FR-003.
const normalizar = (s) => s.replace(/[\s ]+/g, " ").trim();

const kml = fs.readFileSync(SRC, "utf8");

const encontradas = new Map();
for (const bloque of kml.split("<Placemark>").slice(1)) {
  const nombre = bloque.match(/<name>([\s\S]*?)<\/name>/);
  const coords = bloque.match(/<coordinates>([\s\S]*?)<\/coordinates>/);
  if (!nombre || !coords) continue;

  const limpio = normalizar(nombre[1]);
  const m = limpio.match(/^Zona (\d)$/);
  if (!m) fallar(`nombre de placemark no reconocido: ${JSON.stringify(limpio)}`);

  const id = Number(m[1]);
  if (!ZONAS[id]) fallar(`"${limpio}" no tiene precio definido en este script`);
  if (encontradas.has(id)) fallar(`"${limpio}" aparece dos veces en el KML`);

  // KML entrega lon,lat[,alt]; el sitio y Leaflet trabajan en [lat, lng].
  const anillo = coords[1]
    .trim()
    .split(/\s+/)
    .map((par) => {
      const [lon, lat] = par.split(",").map(Number);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        fallar(`coordenada invalida en "${limpio}": ${JSON.stringify(par)}`);
      }
      return [lat, lon];
    });

  if (anillo.length < 4) fallar(`"${limpio}" tiene solo ${anillo.length} vertices`);

  const [priLat, priLng] = anillo[0];
  const [ultLat, ultLng] = anillo[anillo.length - 1];
  if (priLat !== ultLat || priLng !== ultLng) {
    fallar(`"${limpio}" no cierra: primer vertice != ultimo`);
  }

  encontradas.set(id, { id, nombre: limpio, ...ZONAS[id], anillo });
}

const faltantes = Object.keys(ZONAS)
  .map(Number)
  .filter((id) => !encontradas.has(id));
if (faltantes.length) {
  fallar(`faltan zonas en el KML: ${faltantes.map((id) => `Zona ${id}`).join(", ")}`);
}

// El orden ascendente por id no es cosmetico: resolverZona() lo recorre tal cual
// y devuelve el primer match, y eso ES la regla de desempate sobre los bordes
// compartidos (FR-018).
const zonas = [...encontradas.values()].sort((a, b) => a.id - b.id);

const cuerpo = zonas
  .map((z) => {
    const puntos = z.anillo
      .map(([lat, lng]) => `    [${lat}, ${lng}],`)
      .join("\n");
    return `  {
    id: ${z.id},
    nombre: ${JSON.stringify(z.nombre)},
    precio: ${z.precio},
    color: ${JSON.stringify(z.color)},
    anillo: [
${puntos}
    ],
  },`;
  })
  .join("\n");

const salida = `// ARCHIVO GENERADO — NO EDITAR A MANO.
//
// Regenerar con:
//   cd web
//   node design-source/build-zonas.js design-source/zonas-flash-urbano.kml lib/zonas.ts
//
// Fuente: design-source/zonas-flash-urbano.kml, los poligonos trazados sobre las
// calles que definio el cliente. La definicion autoritativa de los limites son
// esas calles, listadas en specs/002-mapa-zonas-precio/spec.md § Limites de zona:
// si un poligono se aparta de su calle, el defecto esta en el poligono.

export type ZonaId = 1 | 2 | 3 | 4 | 5;

export type Zona = {
  id: ZonaId;
  nombre: string;
  /** Pesos uruguayos. Monto fijo por zona: no se multiplica por cantidad ni tamano. */
  precio: number;
  color: string;
  /** Vertices [lat, lng]. Cerrado: el primero es igual al ultimo. */
  anillo: [number, number][];
};

/**
 * Las cinco zonas, ordenadas por id ascendente.
 *
 * Ese orden es normativo: resolverZona() lo recorre tal cual y devuelve el
 * primer match, y eso es lo que hace determinista la resolucion sobre un borde
 * compartido entre dos zonas.
 */
export const ZONAS: readonly Zona[] = [
${cuerpo}
];
`;

fs.writeFileSync(OUT, salida);

const vertices = zonas.reduce((n, z) => n + z.anillo.length, 0);
console.log(`escrito ${OUT}`);
for (const z of zonas) {
  console.log(`  ${z.nombre}: $${z.precio}, ${z.anillo.length} vertices`);
}
console.log(`total ${zonas.length} zonas, ${vertices} vertices`);
