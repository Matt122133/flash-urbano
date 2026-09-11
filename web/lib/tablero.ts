/**
 * El tablero de Diego (`025`): cuantos pedidos hay registrados, y cuantos
 * pedidos y paquetes entraron por dia, semana o mes. Ver
 * specs/025-dashboard-de-diego/.
 *
 * **El calculo vive aca y no en el servicio, a proposito** (research D1). El
 * servicio devuelve hechos —una fila minima por pedido— y este modulo agrupa,
 * filtra y suma. Lo delicado del feature es donde empieza el dia en Montevideo,
 * que dia empieza la semana, y que las filas sumen el total; en `lib/` eso tiene
 * una prueba que corre en cada `npm test`. En SQL solo la tendria una prueba de
 * Go contra Postgres, que se salta sola sin base.
 *
 * **En este archivo tampoco se nombra la plata de un pedido.** El servicio no la
 * manda, y `tablero.test.ts` escanea este fuente para que nadie la agregue: un
 * total facturado sumado aca pasaria por encima de la guarda de `013`, que no
 * mira `lib/` porque ahi el dato tiene que seguir existiendo (Principio V).
 *
 * Todo es puro: sin `Date.now()` escondido. El "hoy" entra por parametro, como
 * en `lib/fechas.ts`, para que la prueba no dependa del dia en que corre.
 */

// ---------------------------------------------------------------------------
// Lo que viaja: GET /admin/tablero (contracts/tablero.md §1)
// ---------------------------------------------------------------------------

/** Un pedido reducido a lo que se cuenta. */
export type Carga = {
  /** El instante de carga, RFC 3339 en UTC. La fecha con que se corta. */
  creadoEn: string;
  /** Cuantos paquetes lleva. Al menos uno. */
  cantidad: number;
  /** La CUENTA que lo creo, no el nombre de remitente escrito en el pedido. */
  clienteId: string;
};

/** Una cuenta, para el filtro. */
export type Cliente = {
  id: string;
  /** `null` cuando el alta quedo a medias: se muestra solo el mail. */
  nombre: string | null;
  email: string;
};

export type RespuestaTablero = {
  /** Una por pedido. La clave dice `pedidos`; cada elemento es una carga. */
  pedidos: Carga[];
  clientes: Cliente[];
};

/** Las tres granularidades del corte (FR-005). */
export type Corte = "dia" | "semana" | "mes";

// ---------------------------------------------------------------------------
// Lo que dice la pantalla (research D10)
//
// Los textos que el spec regula viven aca y no en el componente, porque en este
// repo nada renderiza React en una prueba: una constante en `lib/` si se puede
// afirmar. La prueba no fija la redaccion; fija lo prohibido —la palabra
// "historico", FR-004a— y lo obligatorio —que el corte diga que es por fecha de
// carga, FR-006a—.
// ---------------------------------------------------------------------------

/**
 * El rotulo del total. **No dice "historico"** aunque sea la palabra que uso
 * Diego (FR-004a): la baja de `022` borra la fila, asi que el numero puede BAJAR,
 * y un numero que se llama historico y baja parece un defecto.
 */
export const TEXTO_TOTAL = "Pedidos registrados";

/** La mitad de FR-004 que vive en la pantalla: el numero puede bajar, y se dice. */
export const BAJADA_TOTAL =
  "Los que hay hoy en el sistema. Si un cliente da de baja uno, deja de contarse.";

/** Sin ningun pedido (FR-015): el cero se explica, no se deja solo. */
export const TEXTO_SIN_PEDIDOS = "Todavía no hay pedidos cargados.";

/**
 * Cuando los datos no llegaron (FR-016). **Nunca se muestran ceros en su lugar**:
 * un cero falso es peor que un error visible.
 */
export const TEXTO_ERROR = "No pudimos traer los números. Probá de nuevo en un rato.";

/**
 * Lo que ve una cuenta que no es administradora (FR-003). Nada mas: ni numeros,
 * ni clientes, ni un enlace a otra cosa.
 */
export const TEXTO_SOLO_ADMINISTRACION = "Esta sección es solo para la administración.";

// ---------------------------------------------------------------------------
// Los numeros
// ---------------------------------------------------------------------------

/**
 * Cuantos pedidos hay registrados: uno por carga (FR-004).
 *
 * Es un largo y nada mas, y se deja como funcion con nombre para que el
 * componente no cuente por su lado: si el total y las filas salieran de dos
 * lugares distintos, podrian dejar de sumar lo mismo sin que nada lo note.
 */
export function registrados(cargas: readonly Carga[]): number {
  return cargas.length;
}

// ---------------------------------------------------------------------------
// El corte por periodo (US2)
// ---------------------------------------------------------------------------

/**
 * La aclaracion de FR-006a: con que fecha se corta. Sin ella, un pedido cargado
 * hoy para retirar el mes que viene parece mal contado.
 */
export const TEXTO_CORTE = "Cada pedido cuenta en el día en que se cargó, no en el del retiro.";

/** `YYYY-MM-DD`, una fecha de calendario de Montevideo. */
type Fecha = string;

export type Periodo = {
  /** Ordena igual que el tiempo: `2026-09-10`, el lunes `2026-09-07`, `2026-09`. */
  clave: string;
  /** Lo que se lee (FR-006): sin ambiguedad de que periodo es. */
  rotulo: string;
};

export type Fila = { periodo: Periodo; pedidos: number; paquetes: number };

export type Resumen = { registrados: number; filas: Fila[] };

/**
 * Donde ocurre el trabajo, y por eso donde empieza el dia (FR-007). **Nunca la
 * zona del navegador** —el de quien mire puede estar en otro lado— ni UTC: un
 * pedido de las 22:00 de Montevideo ya es del dia siguiente en UTC. Es la misma
 * trampa que el servicio documenta sobre Railway corriendo en UTC.
 */
const ZONA = "America/Montevideo";

/**
 * Un solo formateador, con la zona **escrita**. `en-CA` y no `es-UY` porque de
 * aca solo salen numeros, y se piden por partes: el orden en que un locale los
 * junta no es algo en lo que apoyarse.
 */
const PARTES_EN_MONTEVIDEO = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * La fecha de Montevideo de un instante RFC 3339 (research D3).
 *
 * **La zona sale de `Intl` y no de un `-03:00` escrito a mano**: Uruguay no tiene
 * horario de verano desde 2015, pero si vuelve, la base IANA lo sabe y un
 * desplazamiento fijo se equivocaria una hora durante meses sin que nada falle.
 */
export function fechaEnMontevideo(instante: string): Fecha {
  const partes = PARTES_EN_MONTEVIDEO.formatToParts(new Date(instante));
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}

// Los nombres, **escritos a mano** (research D4): lo que `Intl` devuelve para un
// locale depende de los datos ICU de cada motor, y la prueba afirma el texto
// exacto.
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * La aritmetica de calendario se hace sobre medianoche **UTC**, con `getUTC*`:
 * es una fecha sin hora, y asi ni la zona del proceso ni un cambio de horario
 * pueden correrla un dia.
 */
function aUTC(fecha: Fecha): Date {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

function deUTC(fecha: Date): Fecha {
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${fecha.getUTCFullYear()}-${dos(fecha.getUTCMonth() + 1)}-${dos(fecha.getUTCDate())}`;
}

function sumarDias(fecha: Fecha, dias: number): Fecha {
  const d = aUTC(fecha);
  d.setUTCDate(d.getUTCDate() + dias);
  return deUTC(d);
}

/** "jue 10 sep", con o sin el año. */
function diaLegible(fecha: Fecha, conAnio: boolean): string {
  const d = aUTC(fecha);
  const base = `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} ${MESES_CORTOS[d.getUTCMonth()]}`;
  return conAnio ? `${base} ${d.getUTCFullYear()}` : base;
}

/**
 * El lunes de la semana de una fecha. **La semana empieza el lunes** (ISO 8601,
 * y como se cuenta en Uruguay): un domingo es el ultimo dia de la semana del
 * lunes anterior, no el primero de la siguiente.
 */
function lunesDe(fecha: Fecha): Fecha {
  const desdeElLunes = (aUTC(fecha).getUTCDay() + 6) % 7;
  return sumarDias(fecha, -desdeElLunes);
}

/** El periodo al que pertenece una fecha de Montevideo (research D4). */
export function periodoDe(fecha: Fecha, corte: Corte): Periodo {
  if (corte === "dia") {
    return { clave: fecha, rotulo: diaLegible(fecha, true) };
  }

  if (corte === "semana") {
    const lunes = lunesDe(fecha);
    const domingo = sumarDias(lunes, 6);
    // Los DOS extremos, porque "semana 37" o "semana del 7" dejan dudas justo
    // donde FR-006 pide que no las haya. El año va una vez al final, salvo que
    // la semana cruce de un año al otro.
    const mismoAnio = lunes.slice(0, 4) === domingo.slice(0, 4);
    return {
      clave: lunes,
      rotulo: `${diaLegible(lunes, !mismoAnio)} – ${diaLegible(domingo, true)}`,
    };
  }

  const [anio, mes] = fecha.split("-").map(Number);
  return { clave: fecha.slice(0, 7), rotulo: `${MESES[mes - 1]} ${anio}` };
}

/** La fecha que sigue a la del periodo, dentro del siguiente periodo. */
function periodoSiguiente(clave: string, corte: Corte): Fecha {
  if (corte === "dia") return sumarDias(clave, 1);
  if (corte === "semana") return sumarDias(clave, 7);
  const [anio, mes] = clave.split("-").map(Number);
  return deUTC(new Date(Date.UTC(anio, mes, 1)));
}

/**
 * El resumen que muestra el tablero: el total y el corte (FR-004, FR-005,
 * FR-008).
 *
 * - **Cada pedido cae en el periodo de su fecha de carga** en Montevideo
 *   (FR-005a), sin importar su estado ni su fecha de retiro. Por eso las filas
 *   de cualquier corte suman `registrados`.
 * - **Sin huecos** (research D5): del periodo del primer pedido al de `hoy`, cada
 *   periodo aparece una vez, del mas nuevo al mas viejo. Un periodo sin pedidos
 *   es una fila en cero: un hueco solo lo nota quien ya sabe que falta.
 * - **Sin ningun pedido**, una sola fila: la de hoy, en cero (FR-015). Una tabla
 *   vacia se lee como una pantalla rota.
 *
 * - **Con un cliente elegido** (US3), solo cuentan sus pedidos, pero **el rango
 *   de periodos es el mismo que sin filtro**: las filas no aparecen ni
 *   desaparecen al filtrar, cambian sus numeros. Un cliente sin pedidos ve la
 *   misma grilla en cero.
 *
 * `hoy` entra por parametro (`YYYY-MM-DD` de Montevideo): la funcion no mira el
 * reloj, y la prueba no depende del dia en que corre.
 */
export function resumir(
  todas: readonly Carga[],
  { corte, hoy, clienteId }: { corte: Corte; hoy: Fecha; clienteId?: string },
): Resumen {
  const fechaDe = new Map(todas.map((c) => [c, fechaEnMontevideo(c.creadoEn)]));

  // El rango sale de TODAS las cargas, no de las del cliente elegido (D5). Va
  // del primer periodo con pedidos —o de hoy, si no hay— hasta el mayor entre
  // hoy y el ultimo pedido. Lo segundo es por un reloj corrido: un pedido "del
  // futuro" no puede quedar fuera de la tabla y dejar de sumar.
  const claves = [...fechaDe.values(), hoy].map((f) => periodoDe(f, corte).clave).sort();
  const desde = claves[0];
  const hasta = claves[claves.length - 1];

  const filas: Fila[] = [];
  const porClave = new Map<string, Fila>();
  let fecha: Fecha = corte === "mes" ? `${desde}-01` : desde;
  for (;;) {
    const periodo = periodoDe(fecha, corte);
    if (periodo.clave > hasta) break;
    const fila = { periodo, pedidos: 0, paquetes: 0 };
    filas.push(fila);
    porClave.set(periodo.clave, fila);
    fecha = periodoSiguiente(periodo.clave, corte);
  }

  // "Cliente" es la CUENTA que creo el pedido (FR-009): se filtra por id, nunca
  // por el nombre de remitente escrito en el pedido, que es texto libre.
  const cargas = clienteId === undefined ? todas : todas.filter((c) => c.clienteId === clienteId);

  for (const c of cargas) {
    const fila = porClave.get(periodoDe(fechaDe.get(c)!, corte).clave)!;
    fila.pedidos += 1;
    fila.paquetes += c.cantidad;
  }

  return { registrados: registrados(cargas), filas: filas.reverse() };
}

// ---------------------------------------------------------------------------
// El filtro por cliente (US3)
// ---------------------------------------------------------------------------

/** FR-011: un cliente sin pedidos muestra ceros, y esto los explica. */
export const TEXTO_CLIENTE_SIN_PEDIDOS = "Este cliente todavía no cargó ningún pedido.";

/**
 * Como se nombra una cuenta en el selector: **nombre y mail** (research D6). El
 * mail es lo que distingue a dos clientes con el mismo nombre (US3-4). Sin
 * nombre —el alta quedo a medias—, solo el mail.
 */
export function rotuloCliente(cliente: Cliente): string {
  const nombre = cliente.nombre?.trim();
  return nombre ? `${nombre} — ${cliente.email}` : cliente.email;
}
