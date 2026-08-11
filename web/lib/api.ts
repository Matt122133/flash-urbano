// Cliente del API de Flash Urbano.
//
// El sitio y el servicio viven en origenes distintos —el sitio es un export
// estatico, el servicio corre en Railway— asi que cada llamada de este archivo
// cruza CORS. Dos decisiones lo gobiernan:
//
// 1. La direccion del servicio sale de la configuracion de BUILD, no del codigo
//    (FR-024). Mudar el sitio a flashurbano.uy tiene que ser cambiar una
//    variable, no editar pantallas.
// 2. La credencial viaja en un header `Authorization`, nunca en una cookie
//    (FR-016). Es la decision del ADR que esquiva el bloqueo de cookies entre
//    origenes, y es lo que hace que el login no se rompa en Safari de iPhone.
//
// IMPORTANTE: este modulo NO puede aparecer en el camino de cotizar. El precio
// se calcula en el navegador con los datos que el sitio ya sirve (FR-001,
// FR-002), y tiene que funcionar con el servicio apagado. Hay una prueba que lo
// vigila en `cotizar-abierto.test.ts`.

/** Cuanto se espera antes de dar una llamada por perdida. */
const TIEMPO_LIMITE_MS = 10_000;

/**
 * Direccion del servicio, inyectada en el bundle en tiempo de build.
 *
 * Se lee adentro de una funcion y no en una constante de modulo para que las
 * pruebas puedan variarla. La expresion literal `process.env.NEXT_PUBLIC_API_URL`
 * sigue estando presente, que es lo que Next necesita para reemplazarla.
 */
export function baseDelApi(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
}

/** Un fallo de una llamada al API, ya clasificado. */
export class ErrorApi extends Error {
  /**
   * Codigo HTTP, o 0 cuando la llamada nunca llego a destino.
   *
   * La diferencia importa: 0 significa "el servicio no contesta" y merece un
   * mensaje distinto de "tu codigo esta mal".
   */
  readonly estado: number;

  constructor(mensaje: string, estado: number) {
    super(mensaje);
    this.name = "ErrorApi";
    this.estado = estado;
  }

  /** El servicio esta caido, sin red, o tardo demasiado. */
  get sinRespuesta(): boolean {
    return this.estado === 0;
  }

  /** La credencial no sirve: vencio, se revoco, o nunca fue valida. */
  get sesionInvalida(): boolean {
    return this.estado === 401;
  }
}

export type OpcionesPedido = {
  metodo?: "GET" | "POST" | "PUT";
  cuerpo?: unknown;
  /** Credencial de sesion. Sin ella el pedido va anonimo. */
  credencial?: string | null;
  senal?: AbortSignal;
};

/**
 * Hace una llamada al API y devuelve el cuerpo ya decodificado.
 *
 * Lanza `ErrorApi` en cualquier fallo, incluido el de red: quien llama tiene un
 * solo lugar donde ocuparse del error, en vez de tener que distinguir entre una
 * excepcion de `fetch` y una respuesta con estado feo.
 */
export async function pedir<T>(ruta: string, opciones: OpcionesPedido = {}): Promise<T> {
  const base = baseDelApi();
  if (!base) {
    // Sin base URL no hay nada que intentar. Es un error de configuracion del
    // build (FR-024), no del usuario, y decirlo asi ahorra media hora de
    // depuracion mirando CORS.
    throw new ErrorApi("El sitio no tiene configurada la direccion del servicio.", 0);
  }

  const cabeceras: Record<string, string> = {};
  if (opciones.cuerpo !== undefined) {
    cabeceras["Content-Type"] = "application/json";
  }
  if (opciones.credencial) {
    cabeceras["Authorization"] = `Bearer ${opciones.credencial}`;
  }

  // Sin plazo, un servicio que acepta la conexion y no responde deja la pantalla
  // esperando para siempre. El spec lo pide explicitamente para el caso del
  // mail que no llega: "sin quedarse esperando para siempre".
  const reloj = AbortSignal.timeout(TIEMPO_LIMITE_MS);
  const senal = opciones.senal ? AbortSignal.any([opciones.senal, reloj]) : reloj;

  let respuesta: Response;
  try {
    respuesta = await fetch(`${base}${ruta}`, {
      method: opciones.metodo ?? "GET",
      headers: cabeceras,
      body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
      // Explicito y a proposito: sin cookies. La credencial va en el header.
      credentials: "omit",
      signal: senal,
    });
  } catch {
    throw new ErrorApi("No pudimos conectarnos con el servicio. Intentalo de nuevo.", 0);
  }

  if (respuesta.status === 204) {
    return undefined as T;
  }

  const cuerpo = await leerJson(respuesta);

  if (!respuesta.ok) {
    const mensaje =
      typeof cuerpo === "object" && cuerpo !== null && typeof (cuerpo as { error?: unknown }).error === "string"
        ? (cuerpo as { error: string }).error
        : "No pudimos procesar el pedido.";
    throw new ErrorApi(mensaje, respuesta.status);
  }

  return cuerpo as T;
}

/**
 * Decodifica el cuerpo sin romperse si no es JSON.
 *
 * Un 502 de un proxy llega en HTML. Dejar que `response.json()` explote ahi
 * convertiria un "el servicio esta caido" en un error de parseo indescifrable.
 */
async function leerJson(respuesta: Response): Promise<unknown> {
  const texto = await respuesta.text();
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}
