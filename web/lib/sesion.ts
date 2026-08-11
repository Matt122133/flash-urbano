// Manejo de la credencial de sesion en el navegador.
//
// Vive en `localStorage` y no en una cookie (research D4). Es la consecuencia
// incomoda de la decision del ADR de mandar la credencial en un header: al no
// usar cookies, la tiene que guardar el codigo de la pagina. Lo que hace el
// riesgo aceptable es que el sitio es un export estatico sin contenido de
// terceros, que hay una CSP estricta encima, y que la sesion se puede revocar
// de inmediato del lado del servicio.
//
// Dos cosas que este modulo NO hace, y son deliberadas:
//
// 1. **No decide si la sesion sirve.** Solo el servicio puede saberlo: una
//    credencial revocada no cambia de forma. Lo unico que se descarta de este
//    lado es la que ya venció, porque mandarla es una llamada que se sabe
//    perdida.
// 2. **No aparece en el camino de cotizar** (FR-001, FR-002). Hay una prueba
//    que lo vigila en `cotizar-abierto.test.ts`.

/**
 * Clave unica bajo la que se guarda todo.
 *
 * Una sola y no dos —credencial por un lado, vencimiento por el otro— porque
 * dos claves se pueden desincronizar: una escritura a medias dejaria una
 * credencial sin fecha, o una fecha sin credencial.
 */
const CLAVE = "flashurbano.sesion";

/** Lo que se guarda. */
export type Sesion = {
  credencial: string;
  /** Cuando vence, en ISO 8601. Lo dice el servicio al emitirla. */
  expiraEn: string;
};

/**
 * Devuelve el almacen del navegador, o null si no hay.
 *
 * El null no es defensivo de mas: el sitio se prerenderiza en Node al compilar
 * para Pages, y ahi `localStorage` no existe. Sin esta guarda el build se rompe
 * en cualquier pantalla que importe este modulo.
 *
 * Tambien cubre el navegador que tiene el almacenamiento bloqueado —Safari en
 * navegacion privada lo hace— donde el acceso lanza en vez de devolver null.
 */
function almacen(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Guarda la credencial que devolvio el servicio. */
export function guardar(sesion: Sesion): void {
  almacen()?.setItem(CLAVE, JSON.stringify(sesion));
}

/** Borra la credencial. Es lo que hace "salir" de este lado. */
export function borrar(): void {
  almacen()?.removeItem(CLAVE);
}

/**
 * Devuelve la sesion guardada, o null.
 *
 * **Una credencial vencida se descarta al leerla**, y ademas se borra: dejarla
 * ahi haria que cada lectura posterior repitiera el mismo trabajo, y que un
 * volcado del almacenamiento mostrara una credencial que ya no sirve.
 *
 * Un contenido corrupto —alguien edito el almacenamiento, o quedo a medias de
 * una version anterior— se trata igual que una vencida. No hay nada util que
 * hacer con el, y lanzar dejaria la pantalla rota sin forma de salir salvo
 * limpiar el navegador a mano.
 */
export function leer(): Sesion | null {
  const crudo = almacen()?.getItem(CLAVE);
  if (!crudo) return null;

  let sesion: Sesion;
  try {
    sesion = JSON.parse(crudo) as Sesion;
  } catch {
    borrar();
    return null;
  }

  if (typeof sesion?.credencial !== "string" || !sesion.credencial || typeof sesion?.expiraEn !== "string") {
    borrar();
    return null;
  }

  const vence = Date.parse(sesion.expiraEn);
  if (Number.isNaN(vence) || vence <= Date.now()) {
    borrar();
    return null;
  }

  return sesion;
}

/** La credencial sola, que es lo que necesita el cliente del API. */
export function credencial(): string | null {
  return leer()?.credencial ?? null;
}

/**
 * Avisa cuando la sesion cambia en OTRA pestaña.
 *
 * El evento `storage` solo lo reciben las pestañas distintas de la que
 * escribio, que es exactamente lo que hace falta: quien cerro sesion ya lo sabe.
 * Sin esto, cerrar sesion en una pestaña deja a la otra mostrando el nombre de
 * alguien que ya no esta adentro, y peor, ofreciendo acciones que van a fallar.
 *
 * Devuelve la funcion para desuscribirse. Quien no la llame deja el listener
 * vivo despues de desmontar el componente.
 */
export function suscribirse(alCambiar: (sesion: Sesion | null) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const manejar = (evento: Event) => {
    // `key` en null es `localStorage.clear()`: se limpio todo, incluida la
    // sesion. Filtrar solo por nuestra clave lo dejaria pasar sin avisar.
    const clave = (evento as StorageEvent).key;
    if (clave !== null && clave !== CLAVE) return;
    alCambiar(leer());
  };

  window.addEventListener("storage", manejar);
  return () => window.removeEventListener("storage", manejar);
}
