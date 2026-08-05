import { asset } from "./asset";
import type { Punto } from "./direccion";

/**
 * Resolucion de direcciones por cruce de calles.
 *
 * El contrato de este modulo esta en
 * specs/003-direccion-por-esquina/contracts/direcciones.md y existe para
 * cumplir FR-024: el dia que haya backend con PostGIS cambia la implementacion
 * y el formulario no se entera.
 *
 * Salvo `cargarIndice`, todo aca es funcion pura sobre un indice ya cargado:
 * sin `window`, sin red, sin estado global. Corre igual en el navegador que
 * bajo Vitest, que es lo que hace testeable a zona-lookup.ts y por la misma
 * razon: de esto sale donde hay que ir a buscar un paquete.
 */

// ---------------------------------------------------------------------------
// Forma del indice
// ---------------------------------------------------------------------------

/**
 * Lo que emite design-source/build-calles.js. Cada esquina es una fila de 12
 * numeros y no un objeto: son ~21.000, y los nombres de campo repetidos 21.000
 * veces se pagan en bytes que el cliente descarga.
 *
 * [calleA, calleB, lat, lng, antesA(2), despuesA(2), antesB(2), despuesB(2)]
 *
 * Los ocho ultimos son desplazamientos enteros contra el punto, en unidades de
 * `escala` (1e-5 grados, ~1 m).
 */
export type IndiceCrudo = {
  version: number;
  escala: number;
  calles: string[];
  esquinas: number[][];
};

export type Calle = {
  id: number;
  /** Como se muestra: `Avenida 18 de Julio`. */
  nombre: string;
  /** Para buscar: sin tildes, minusculas, espacios colapsados. */
  busqueda: string;
  /** `busqueda` sin el prefijo de tipo de via. Solo para buscar. */
  canonico: string;
};

export type Esquina = {
  calleA: Calle;
  calleB: Calle;
  punto: Punto;
  antesA: Punto;
  despuesA: Punto;
  antesB: Punto;
  despuesB: Punto;
};

export type Indice = {
  calles: Calle[];
  /** id de calle -> indices de fila en el crudo. */
  porCalle: Map<number, number[]>;
  crudo: IndiceCrudo;
};

// ---------------------------------------------------------------------------
// Nombres
// ---------------------------------------------------------------------------

/**
 * Prefijos de tipo de via. Se sacan solo para buscar: asi tipear "varela"
 * encuentra `Avenida Jose Pedro Varela` y `Jose Pedro Varela`.
 *
 * **La identidad de una calle sigue siendo su nombre completo.** Agrupar
 * geometria por el canonico juntaria calles homonimas de barrios distintos y
 * fabricaria esquinas entre calles que nunca se tocan — o sea precios
 * inventados. Ver research.md R3.
 */
const PREFIJOS_VIA = [
  "avenida ",
  "bulevar ",
  "calle ",
  "camino ",
  "pasaje ",
  "continuacion ",
  "rambla ",
  "ruta ",
];

export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function canonizar(busqueda: string): string {
  for (const p of PREFIJOS_VIA) {
    if (busqueda.startsWith(p)) return busqueda.slice(p.length);
  }
  return busqueda;
}

// ---------------------------------------------------------------------------
// Carga
// ---------------------------------------------------------------------------

export class IndiceNoDisponible extends Error {
  constructor(causa?: unknown) {
    super("No se pudo cargar el indice de calles");
    this.name = "IndiceNoDisponible";
    this.cause = causa;
  }
}

/** Decodifica el crudo y arma los indices de consulta. Puro. */
export function prepararIndice(crudo: IndiceCrudo): Indice {
  const calles: Calle[] = crudo.calles.map((nombre, id) => {
    const busqueda = normalizar(nombre);
    return { id, nombre, busqueda, canonico: canonizar(busqueda) };
  });

  const porCalle = new Map<number, number[]>();
  crudo.esquinas.forEach((fila, i) => {
    for (const id of [fila[0], fila[1]]) {
      let lista = porCalle.get(id);
      if (!lista) porCalle.set(id, (lista = []));
      lista.push(i);
    }
  });

  return { calles, porCalle, crudo };
}

let cache: Promise<Indice> | null = null;

/**
 * Trae el indice desde public/, una sola vez.
 *
 * Es lo unico de este modulo que toca la red. Si falla lanza
 * `IndiceNoDisponible`, que quien llama tiene que poder distinguir de "no hay
 * resultados": un formulario mudo con el indice caido es peor que un error.
 */
export function cargarIndice(): Promise<Indice> {
  if (cache) return cache;
  cache = (async () => {
    let res: Response;
    try {
      // `asset()` agrega el basePath de GitHub Pages. Sin eso anda en local y
      // da 404 en produccion, que es la peor forma de romperse.
      res = await fetch(asset("/calles-mvd.json"));
    } catch (e) {
      throw new IndiceNoDisponible(e);
    }
    if (!res.ok) throw new IndiceNoDisponible(new Error(`HTTP ${res.status}`));
    try {
      return prepararIndice((await res.json()) as IndiceCrudo);
    } catch (e) {
      throw new IndiceNoDisponible(e);
    }
  })().catch((e) => {
    // Un fallo no debe quedar cacheado: el proximo intento tiene que reintentar.
    cache = null;
    throw e;
  });
  return cache;
}

/** Solo para pruebas: olvida el indice cargado. */
export function olvidarIndice(): void {
  cache = null;
}

// ---------------------------------------------------------------------------
// Busqueda
// ---------------------------------------------------------------------------

const MINIMO_PARA_BUSCAR = 3;
const TOPE_SUGERENCIAS = 8;

function puntajeDe(calle: Calle, q: string): number | null {
  // Menor es mejor. Se prefiere lo que empieza con lo tipeado: quien escribe
  // "rivera" busca Rivera, no "Camino Rivera".
  if (calle.busqueda.startsWith(q)) return 0;
  if (calle.canonico.startsWith(q)) return 1;
  if (calle.busqueda.includes(q)) return 2;
  if (calle.canonico.includes(q)) return 3;
  return null;
}

function ordenar(hallazgos: Array<{ calle: Calle; puntaje: number }>): Calle[] {
  return hallazgos
    .sort(
      (a, b) =>
        a.puntaje - b.puntaje ||
        a.calle.nombre.length - b.calle.nombre.length ||
        a.calle.busqueda.localeCompare(b.calle.busqueda),
    )
    .slice(0, TOPE_SUGERENCIAS)
    .map((h) => h.calle);
}

/**
 * Sugerencias de calle a partir de lo tipeado.
 *
 * Texto vacio o muy corto devuelve nada, no todo: una lista de 5.700 nombres no
 * es una sugerencia.
 */
export function buscarCalle(indice: Indice, texto: string): Calle[] {
  const q = normalizar(texto);
  if (q.length < MINIMO_PARA_BUSCAR) return [];
  const hallazgos = [];
  for (const calle of indice.calles) {
    const puntaje = puntajeDe(calle, q);
    if (puntaje !== null) hallazgos.push({ calle, puntaje });
  }
  return ordenar(hallazgos);
}

/** Busca una calle por su nombre exacto tal como se muestra. */
export function callePorNombre(indice: Indice, nombre: string): Calle | null {
  const q = normalizar(nombre);
  return indice.calles.find((c) => c.busqueda === q) ?? null;
}

/**
 * Las calles que **efectivamente cruzan** la calle dada (FR-009).
 *
 * Es lo que impide armar un cruce que no existe: si nunca se ofrece, no se
 * elige.
 */
export function buscarEsquinaDe(
  indice: Indice,
  calle: Calle,
  texto: string,
): Calle[] {
  const filas = indice.porCalle.get(calle.id);
  if (!filas) return [];

  const q = normalizar(texto);
  const vistas = new Set<number>();
  const hallazgos = [];

  for (const i of filas) {
    const fila = indice.crudo.esquinas[i];
    const otra = fila[0] === calle.id ? fila[1] : fila[0];
    if (otra === calle.id || vistas.has(otra)) continue;
    vistas.add(otra);

    const cruzada = indice.calles[otra];
    if (q.length < MINIMO_PARA_BUSCAR) {
      hallazgos.push({ calle: cruzada, puntaje: 0 });
      continue;
    }
    const puntaje = puntajeDe(cruzada, q);
    if (puntaje !== null) hallazgos.push({ calle: cruzada, puntaje });
  }

  return ordenar(hallazgos);
}

function decodificar(indice: Indice, fila: number[]): Esquina {
  const e = indice.crudo.escala;
  const punto = { lat: fila[2], lng: fila[3] };
  const desde = (i: number): Punto => ({
    lat: punto.lat + fila[i] / e,
    lng: punto.lng + fila[i + 1] / e,
  });
  return {
    calleA: indice.calles[fila[0]],
    calleB: indice.calles[fila[1]],
    punto,
    antesA: desde(4),
    despuesA: desde(6),
    antesB: desde(8),
    despuesB: desde(10),
  };
}

/**
 * Resuelve un par calle/esquina a puntos concretos.
 *
 * **Devuelve siempre una lista, nunca "la" esquina.** Una firma que devolviera
 * un solo resultado obligaria a elegir uno adentro, y elegir en silencio es
 * adivinar una zona, o sea adivinar un precio (Principio V, FR-021). Vacia si
 * no se cruzan; con varios elementos si se cruzan mas de una vez o si hay
 * homonimas en barrios distintos.
 */
export function buscarEsquina(indice: Indice, a: Calle, b: Calle): Esquina[] {
  const filas = indice.porCalle.get(a.id);
  if (!filas) return [];
  const out: Esquina[] = [];
  for (const i of filas) {
    const fila = indice.crudo.esquinas[i];
    if (fila[0] === b.id || fila[1] === b.id) out.push(decodificar(indice, fila));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Region permitida
// ---------------------------------------------------------------------------

const METROS_POR_GRADO_LAT = 110540;
const metrosPorGradoLng = (lat: number) =>
  111320 * Math.cos((lat * Math.PI) / 180);

/** Margen lateral de la cuadra: cubre veredas y retiros. */
export const MARGEN_CUADRA_M = 50;

/**
 * Donde puede moverse el pin: la polilinea `antes -> esquina -> despues` sobre
 * la calle declarada, con un margen a cada lado.
 *
 * Se toma sobre la calle y no sobre la esquina porque la puerta pertenece a la
 * calle; la esquina solo la ubica.
 *
 * Cuando de un lado no hay contigua, ese extremo es la esquina misma y la
 * region degenera en un disco del radio del margen. Pasa en el 4% de las
 * esquinas y sigue siendo usable, que es lo que importa.
 */
export type Region = { eje: Punto[]; margenM: number };

export function regionPermitida(esquina: Esquina, cual: "A" | "B"): Region {
  const antes = cual === "A" ? esquina.antesA : esquina.antesB;
  const despues = cual === "A" ? esquina.despuesA : esquina.despuesB;
  return { eje: [antes, esquina.punto, despues], margenM: MARGEN_CUADRA_M };
}

/** Punto mas cercano del segmento `a-b` a `p`, trabajando en metros locales. */
function proyectar(p: Punto, a: Punto, b: Punto): { punto: Punto; distanciaM: number } {
  const kx = metrosPorGradoLng(p.lat);
  const ky = METROS_POR_GRADO_LAT;
  const ax = a.lng * kx, ay = a.lat * ky;
  const bx = b.lng * kx, by = b.lat * ky;
  const px = p.lng * kx, py = p.lat * ky;

  const dx = bx - ax, dy = by - ay;
  const largo2 = dx * dx + dy * dy;
  const t = largo2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / largo2));
  const cx = ax + t * dx, cy = ay + t * dy;

  return {
    punto: { lat: cy / ky, lng: cx / kx },
    distanciaM: Math.hypot(px - cx, py - cy),
  };
}

function masCercanoDelEje(region: Region, p: Punto) {
  let mejor = proyectar(p, region.eje[0], region.eje[1]);
  for (let i = 1; i < region.eje.length - 1; i++) {
    const cand = proyectar(p, region.eje[i], region.eje[i + 1]);
    if (cand.distanciaM < mejor.distanciaM) mejor = cand;
  }
  return mejor;
}

/** Si el punto cae dentro de la region. */
export function contiene(region: Region, p: Punto): boolean {
  return masCercanoDelEje(region, p).distanciaM <= region.margenM;
}

/**
 * El punto permitido mas cercano a uno que quedo afuera.
 *
 * Es lo que permite **clampear en vez de rechazar** (FR-015): al soltar el pin
 * afuera vuelve solo al borde y el estado invalido no llega a existir.
 *
 * Devuelve el punto sobre el **borde** de la region en la direccion en que el
 * usuario arrastro, no sobre el eje de la calle: pegarlo al eje lo dejaria en
 * mitad de la calzada, y el pin es libre dentro de la region a proposito.
 */
export function acercarALaRegion(region: Region, p: Punto): Punto {
  const { punto: base, distanciaM } = masCercanoDelEje(region, p);
  if (distanciaM <= region.margenM) return p;

  const t = region.margenM / distanciaM;
  return {
    lat: base.lat + (p.lat - base.lat) * t,
    lng: base.lng + (p.lng - base.lng) * t,
  };
}
