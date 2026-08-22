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
  /**
   * Cabeceras extra. Hoy solo la de idempotencia, y por eso no se generaliza
   * mas: una firma que acepte cualquier cabecera invita a mandar la credencial
   * por ahi y saltearse la unica puerta que la pone.
   */
  cabeceras?: Record<string, string>;
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
  // Despues de Authorization a proposito: si alguien pasara "Authorization" en
  // `cabeceras`, lo pisaria. Se decide al reves —lo explicito de arriba gana—
  // porque la credencial la pone quien sabe cual es, no quien llama.
  for (const [k, v] of Object.entries(opciones.cabeceras ?? {})) {
    if (k.toLowerCase() === "authorization") continue;
    cabeceras[k] = v;
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

// ---------------------------------------------------------------------------
// Pedidos (007)
// ---------------------------------------------------------------------------

/** Cabecera que identifica un INTENTO de envio. Ver contracts/pedidos.md. */
export const CABECERA_IDEMPOTENCIA = "Idempotency-Key";

/** Un punto en lat/lng, tal como viaja en la respuesta. */
export type PuntoGuardado = { lat: number; lng: number };

/**
 * Una direccion tal como se guardo con el pedido.
 *
 * `numero` y `apto` son NULABLES en la base y llegan como `null`, no como `""`.
 * La diferencia importa al mostrarlos: "no lo dijo" no es "dijo que no".
 *
 * **El punto solo lo tiene el retiro.** La entrega quedo como texto en `003`
 * (FR-007a de aquel feature): no incide en el precio y la ubica la app Android.
 * Por eso es opcional aca y no un campo que a veces viene en cero.
 */
export type DireccionGuardada = {
  calle: string;
  esquina: string;
  numero: string | null;
  apto: string | null;
  cooperativa: boolean;
  punto?: PuntoGuardado | null;
};

/**
 * Un pedido tal como lo devuelve el servicio.
 *
 * **Es una copia a mano de `pedidos.Pedido` del backend**, igual que `Usuario`
 * lo es de `usuarios.Vista`. El ADR acepto ese acoplamiento para una superficie
 * de este tamaño, y la contra hay que tenerla presente: **TypeScript no valida
 * nada de lo que llega por la red**. Si el servicio cambia la forma de un
 * pedido, este tipo miente en silencio y lo que se rompe es una pantalla, no una
 * compilacion.
 *
 * `007` declaraba solo siete campos —lo unico que la pantalla de confirmacion
 * necesitaba—. `010` lo ensancha hasta lo que la respuesta trae de verdad,
 * porque el historial muestra el pedido entero y repetirlo lo necesita completo.
 *
 * **`estado` y `paqueteTamano` son `string` a proposito**, no uniones. El
 * servicio acepta tres valores de cada uno hoy y la lista ya cambio una vez; un
 * valor nuevo tiene que poder mostrarse crudo en vez de romper la pantalla, y
 * una union aca daria la ilusion de una garantia que nadie comprueba.
 */
export type PedidoGuardado = {
  id: string;
  usuarioId: string;
  codigo: string;
  estado: string;

  remitenteNombre: string;
  remitenteTelefono: string;

  retiro: DireccionGuardada;
  entrega: DireccionGuardada;

  paqueteTamano: string;
  cantidad: number;

  /** `YYYY-MM-DD` y `HH:MM`, en hora de Montevideo. No son un instante. */
  retiroFecha: string;
  retiroHora: string;

  destinatarioNombre: string;
  destinatarioTelefono: string;

  /** Pesos enteros, congelado al crear. Un cambio de precios no lo reescribe. */
  precio: number;
  zonaId: number;

  creadoEn: string;
  actualizadoEn: string;
};

/**
 * Crea un pedido.
 *
 * `clave` identifica el INTENTO, no el paquete: los reintentos y la reanudacion
 * posterior al ingreso tienen que compartirla, o cada uno crearia un pedido.
 *
 * **El servicio responde 201 con uno nuevo y 200 con el que ya existia**, y
 * desde aca los dos casos son el mismo: se devuelve el pedido. Quien reintenta
 * porque no supo si funciono tiene que llegar al mismo lugar que si hubiera
 * funcionado a la primera; distinguirlos obligaria a cada pantalla a decidir
 * que hacer con una diferencia que no le importa.
 */
export async function crearPedido(
  cuerpo: unknown,
  clave: string,
  credencial: string | null,
): Promise<PedidoGuardado> {
  const r = await pedir<{ pedido: PedidoGuardado }>("/pedidos", {
    metodo: "POST",
    cuerpo,
    credencial,
    cabeceras: { [CABECERA_IDEMPOTENCIA]: clave },
  });
  return r.pedido;
}

/**
 * Los pedidos de quien pide, **del mas nuevo al mas viejo**.
 *
 * Nacio en `007` sin pantalla (FR-030 difirio "Mis Pedidos"): existia para poder
 * leer los pedidos sin abrir la base. Desde `010` es lo que alimenta el
 * historial de *Mi cuenta* y la precarga de un pedido repetido.
 *
 * **El orden lo pone el servicio** (`creado_en DESC`) y no se re-ordena aca:
 * FR-002 se rompe re-ordenando, no confiando.
 *
 * **No acepta ningun parametro que permita pedir los de otro**, y no debe
 * aceptarlo: quien es sale de la credencial, del lado del servicio.
 */
export async function misPedidos(credencial: string | null): Promise<PedidoGuardado[]> {
  const r = await pedir<{ pedidos: PedidoGuardado[] }>("/pedidos", { credencial });
  return r.pedidos ?? [];
}
