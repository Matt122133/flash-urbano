// El reporte del mes (`029`): los envios de UNA cuenta en un periodo, como CSV,
// para que Diego sepa que cobrarle.
//
// **El archivo se resuelve como dato antes de volverse texto**, y ese corte es
// el mismo que `020` hizo entre `etiqueta.ts` y `etiqueta-pdf.ts`, por el mismo
// motivo: una afirmacion sobre una lista de filas se prueba en tres lineas; la
// misma afirmacion sobre una cadena llena de comillas y puntos y comas, no.
//
// **Aca no hay plata, y no puede haberla.** El reporte lleva la ZONA; Diego
// aplica su lista de precios afuera del producto (constitucion 6.2.0, Principio
// V). `reporte.test.ts` escanea este fuente para que nadie la agregue:
// `sin-precio-a-la-vista.test.ts` mira `app/` y `components/` y **deja `lib/`
// afuera a proposito**, porque ahi el precio TIENE que seguir viviendo.
//
// Modulo puro: sin red, sin `window`, sin React. Lo que traiga los datos es
// `lib/api.ts`; lo que dispare la descarga, el componente.
import { componerDireccion, type Direccion } from "./direccion";
import { fechaEnMontevideo } from "./tablero";
import { resolverZona } from "./zona-lookup";

/** Un extremo del viaje, tal como lo guardo el servicio. */
export type DireccionGuardada = {
  calle: string;
  esquina: string;
  numero?: string | null;
  apto?: string | null;
  cooperativa: boolean;
  /** Ausente en un pedido anterior a `011`. Sin punto **no hay zona**. */
  punto?: { lat: number; lng: number } | null;
};

/**
 * Un envio tal como lo devuelve `GET /admin/reporte`.
 *
 * **Se describe aca y no se importa de `lib/api.ts`**, igual que hizo
 * `etiqueta.ts`: asi este modulo no nombra al cliente del servicio. TypeScript
 * es estructural, asi que no se pierde comprobacion.
 */
export type EnvioDelServicio = {
  codigo: string;
  /** `YYYY-MM-DD`. Ya es una fecha de calendario: `retiro_fecha` es `date`. */
  retiroFecha: string;
  entrega: DireccionGuardada;
  /** Instante RFC 3339 en UTC. **Ausente si Diego no lo marco en la app.** */
  entregadoEn?: string;
  cantidad: number;
};

/**
 * Una fila del archivo, resuelta.
 *
 * **Lo que este tipo NO tiene es tan parte del diseño como lo que tiene**: no
 * hay campo de importe, asi que no se puede filtrar uno por error.
 */
export type FilaDeReporte = {
  codigo: string;
  /** `YYYY-MM-DD`, tal cual vino. */
  retiro: string;
  /** `YYYY-MM-DD` **de Montevideo**, o `""` si no se marco la entrega. */
  entrega: string;
  /** Compuesta con la misma funcion que la pantalla y la etiqueta impresa. */
  direccion: string;
  /**
   * El nombre de la zona, o `""` cuando el pedido no tiene punto guardado.
   *
   * **Vacio NO significa "no se cobra"**: significa que no hay punto del cual
   * resolverla. Nunca se deduce de la direccion escrita — eso es adivinar una
   * zona, que el Principio V prohibe.
   */
  zona: string;
  paquetes: number;
};

/** El archivo entero, antes de ser texto. */
export type Reporte = {
  filas: FilaDeReporte[];
  /** El nombre o el mail de la cuenta. Va en el pie, no en cada fila. */
  cuenta: string;
  /** El rotulo del periodo, el mismo que muestra el cuadro del tablero. */
  periodo: string;
  /** Fecha y hora **de Montevideo** en que se genero. */
  generadoEl: string;
};

/** Lo que `componerDireccion` espera, desde lo que el servicio manda. */
export function comoDireccion(d: DireccionGuardada): Direccion {
  return {
    calle: d.calle,
    esquina: d.esquina,
    // El servicio los manda ausentes o nulos; el compositor espera texto.
    numero: d.numero ?? "",
    apto: d.apto ?? "",
    cooperativa: d.cooperativa,
    punto: d.punto ?? null,
  };
}

// ---------------------------------------------------------------------------
// De los envios del servicio a las filas del archivo
// ---------------------------------------------------------------------------

/**
 * Convierte lo que devolvio el servicio en las filas del archivo.
 *
 * **Tres funciones reusadas y ningun helper nuevo**, y es a proposito: el repo
 * ya tiene resueltas estas tres trampas y escribir una segunda version de
 * cualquiera de ellas es como se desincronizan.
 *
 *   - `componerDireccion` es la misma que usan la pantalla y la etiqueta
 *     impresa, asi que los tres no pueden divergir (FR-008).
 *   - `resolverZona` es la misma del formulario y la etiqueta, contra los
 *     poligonos del KML de Diego. **Sin punto no hay zona** y la celda va
 *     vacia; nunca se deduce de la direccion escrita, que es adivinar una zona
 *     (FR-007, Principio V).
 *   - `fechaEnMontevideo` es la de `025`, con la zona IANA escrita y no un
 *     `-03:00` a mano: si Uruguay vuelve al horario de verano, un desplazamiento
 *     fijo se equivocaria una hora durante meses sin que nada falle.
 */
export function filasDeEnvios(envios: readonly EnvioDelServicio[]): FilaDeReporte[] {
  return envios.map((e) => ({
    codigo: e.codigo,
    retiro: e.retiroFecha,
    // **Vacia cuando Diego no lo marco en la app, y el envio aparece igual.**
    // Si el reporte se cortara por esta fecha, cada olvido suyo seria un envio
    // facturado de menos.
    entrega: e.entregadoEn ? fechaEnMontevideo(e.entregadoEn) : "",
    direccion: componerDireccion(comoDireccion(e.entrega)),
    zona: e.entrega.punto ? (resolverZona(e.entrega.punto.lat, e.entrega.punto.lng)?.nombre ?? "") : "",
    paquetes: e.cantidad,
  }));
}

// ---------------------------------------------------------------------------
// De las filas al texto
// ---------------------------------------------------------------------------

/**
 * El separador. **`;` y no `,`**, y no es una preferencia: una planilla
 * configurada en español espera punto y coma, y con coma abre **todo en una
 * sola columna**. El archivo seria "correcto" y no serviria para nada, que es
 * justo el sintoma por el que casi elegimos XLSX.
 */
const SEPARADOR = ";";

/**
 * Fin de linea CRLF, que es lo que pide RFC 4180 y lo que no sorprende a
 * ninguna planilla de Windows.
 */
const FIN_DE_LINEA = "\r\n";

/**
 * La marca de orden de bytes de UTF-8.
 *
 * **Sin esto Excel asume la codificacion local y "Piñeyro" sale "PiÃ±eyro".**
 * Las calles de Montevideo estan llenas de tildes y de ñ, asi que no es un caso
 * raro: es el caso. Y el defecto es invisible hasta que alguien abre el archivo
 * en una planilla y no en un editor de texto.
 */
const BOM = "﻿";

const ENCABEZADO = [
  "Codigo",
  "Fecha de retiro",
  "Fecha de entrega",
  "Direccion de entrega",
  "Zona",
  "Paquetes",
];

/**
 * Cita un campo si hace falta (FR-016).
 *
 * El campo peligroso es la direccion —*"Rivera 1234, apto 2"*— y una coma o un
 * punto y coma suelto parte la fila en dos sin que nada falle. Las comillas
 * internas se duplican, como manda RFC 4180.
 */
function citar(valor: string): string {
  if (!/[";\r\n,]/.test(valor)) return valor;
  return `"${valor.replace(/"/g, '""')}"`;
}

const renglon = (campos: readonly (string | number)[]) =>
  campos.map((c) => citar(String(c))).join(SEPARADOR);

/**
 * El archivo entero, listo para descargar.
 *
 * **El bloque de contexto va al FINAL, despues de un renglon en blanco**
 * (FR-014a). Arriba del encabezado, la planilla tomaria esa primera fila como
 * encabezado y se perderian los nombres de columna, el filtro y el orden. Y el
 * renglon en blanco deja el bloque **fuera de la region contigua**, asi que
 * ordenar los datos no se lo lleva puesto.
 */
export function textoDelReporte(r: Reporte): string {
  const lineas = [
    renglon(ENCABEZADO),
    ...r.filas.map((f) => renglon([f.codigo, f.retiro, f.entrega, f.direccion, f.zona, f.paquetes])),
    "",
    renglon(["Cuenta", r.cuenta]),
    renglon(["Periodo", r.periodo]),
    renglon(["Generado el", r.generadoEl]),
  ];
  return BOM + lineas.join(FIN_DE_LINEA) + FIN_DE_LINEA;
}

/**
 * El nombre del archivo (FR-015): lleva periodo y cuenta para que dos descargas
 * no se pisen en la carpeta.
 */
export function nombreDeArchivo(r: Reporte): string {
  const limpio = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
  return `flash-urbano-${limpio(r.periodo)}-${limpio(r.cuenta)}.csv`;
}

/**
 * Fecha y hora de Montevideo, para el pie.
 *
 * La zona va **escrita**, igual que en `lib/tablero.ts`: ni la del navegador de
 * quien mire —que puede estar en otro lado— ni UTC.
 */
export function generadoEnMontevideo(instante: Date): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instante);
  const p = (tipo: string) => partes.find((x) => x.type === tipo)?.value ?? "";
  return `${p("year")}-${p("month")}-${p("day")} ${p("hour")}:${p("minute")}`;
}

/**
 * La ruta del reporte, con sus tres parametros obligatorios.
 *
 * **Vive aca y no en `lib/api.ts`** porque es una cadena pura, se prueba sin
 * red, y `api.ts` es un archivo que conviene no tocar: la guarda de
 * `cotizar-abierto.test.ts` vigila que no se meta en el grafo del formulario de
 * pedido, y cada cambio suyo hay que mirarlo contra eso.
 *
 * Los tres van escapados aunque hoy ninguno lo necesite —un id es un uuid y las
 * fechas son digitos—: el dia que la cuenta se identifique de otra forma, esto
 * ya esta bien y nadie tiene que acordarse.
 */
export function rutaDelReporte(cliente: string, desde: string, hasta: string): string {
  const q = new URLSearchParams({ cliente, desde, hasta });
  return `/admin/reporte?${q.toString()}`;
}

/** Lo que devuelve esa ruta. Descrito aca, no importado de `lib/api.ts`. */
export type RespuestaReporte = { pedidos: EnvioDelServicio[] };
