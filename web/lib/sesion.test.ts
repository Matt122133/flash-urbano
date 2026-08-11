import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { borrar, credencial, guardar, leer, suscribirse, type Sesion } from "./sesion";

const CLAVE = "flashurbano.sesion";

// El entorno de vitest es `node`, sin DOM: no hay localStorage ni window. Se
// arman los dos a mano en vez de mover el proyecto entero a jsdom, y esa
// decision tiene una razon que no es la pereza — `lib/sesion.ts` TIENE que
// funcionar sin localStorage, porque el sitio se prerenderiza en Node al
// compilar para Pages. Probarlo en un entorno donde el almacen no existe por
// defecto es probar el caso real, no esquivarlo.

/** Un localStorage de mentira, con la misma superficie que se usa. */
function almacenFalso(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
    removeItem: (k: string) => void datos.delete(k),
    clear: () => datos.clear(),
    key: (i: number) => [...datos.keys()][i] ?? null,
    get length() {
      return datos.size;
    },
    /** Solo para las aserciones de las pruebas. */
    _datos: datos,
  };
}

function enUnRato(ms = 60 * 60 * 1000): string {
  return new Date(Date.now() + ms).toISOString();
}

const SESION: Sesion = { credencial: "token-opaco-de-prueba", expiraEn: enUnRato() };

let almacen: ReturnType<typeof almacenFalso>;

beforeEach(() => {
  almacen = almacenFalso();
  vi.stubGlobal("localStorage", almacen);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("guardar y leer", () => {
  it("devuelve lo que se guardo", () => {
    guardar(SESION);
    expect(leer()).toEqual(SESION);
    expect(credencial()).toBe(SESION.credencial);
  });

  it("no hay sesion antes de guardar nada", () => {
    expect(leer()).toBeNull();
    expect(credencial()).toBeNull();
  });

  it("borrar deja al navegador sin identidad", () => {
    guardar(SESION);
    borrar();
    expect(leer()).toBeNull();
    expect(almacen._datos.has(CLAVE)).toBe(false);
  });
});

// T038: "una credencial vencida se descarta al leerla". Es lo unico que este
// modulo puede decidir solo — si sirve o no lo dice el servicio.
describe("una credencial vencida", () => {
  it("se descarta al leerla", () => {
    guardar({ credencial: "vieja", expiraEn: new Date(Date.now() - 1000).toISOString() });
    expect(leer()).toBeNull();
  });

  it("ademas se borra, para no repetir el trabajo en cada lectura", () => {
    guardar({ credencial: "vieja", expiraEn: new Date(Date.now() - 1000).toISOString() });
    leer();
    expect(almacen._datos.has(CLAVE)).toBe(false);
  });

  it("vence sola con el paso del tiempo, sin que nadie la toque", () => {
    // El control positivo de este bloque: la MISMA credencial sirve antes y no
    // sirve despues. Sin esto, un `leer()` que devolviera null siempre pasaria
    // las dos pruebas de arriba.
    vi.useFakeTimers();
    guardar({ credencial: "buena", expiraEn: enUnRato(60_000) });
    expect(leer()).not.toBeNull();

    vi.advanceTimersByTime(61_000);
    expect(leer()).toBeNull();
  });
});

// Un almacenamiento corrupto no puede romper la pantalla: no habria forma de
// salir salvo limpiar el navegador a mano, y nadie sabe hacer eso.
describe("contenido invalido", () => {
  it.each([
    ["no es JSON", "{{{"],
    ["JSON sin credencial", JSON.stringify({ expiraEn: enUnRato() })],
    ["credencial vacia", JSON.stringify({ credencial: "", expiraEn: enUnRato() })],
    ["sin vencimiento", JSON.stringify({ credencial: "x" })],
    ["vencimiento que no es fecha", JSON.stringify({ credencial: "x", expiraEn: "cuando sea" })],
  ])("%s: se descarta sin lanzar", (_caso, contenido) => {
    almacen.setItem(CLAVE, contenido);
    expect(() => leer()).not.toThrow();
    expect(leer()).toBeNull();
  });
});

// El sitio se prerenderiza en Node al compilar para Pages. Sin esta tolerancia,
// el build se rompe en cualquier pantalla que importe este modulo.
describe("sin almacenamiento", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", undefined);
  });

  it("leer devuelve null en vez de lanzar", () => {
    expect(() => leer()).not.toThrow();
    expect(leer()).toBeNull();
  });

  it("guardar y borrar no lanzan", () => {
    expect(() => guardar(SESION)).not.toThrow();
    expect(() => borrar()).not.toThrow();
  });
});

// T038: "cerrar sesion en una pestaña deja a la otra sin identidad".
describe("propagacion entre pestañas", () => {
  function conVentana() {
    const ventana = new EventTarget() as unknown as Window & typeof globalThis;
    vi.stubGlobal("window", ventana);
    return ventana;
  }

  /** El evento `storage` como lo emite el navegador en las OTRAS pestañas. */
  function eventoStorage(key: string | null, newValue: string | null) {
    return Object.assign(new Event("storage"), { key, newValue });
  }

  it("la otra pestaña se entera de que se cerro sesion", () => {
    const ventana = conVentana();
    guardar(SESION);

    const visto: Array<Sesion | null> = [];
    suscribirse((s) => visto.push(s));

    // La otra pestaña borro. En esta, el almacen ya cambio y llega el evento.
    almacen.removeItem(CLAVE);
    ventana.dispatchEvent(eventoStorage(CLAVE, null));

    expect(visto).toEqual([null]);
  });

  it("tambien se entera de que se entro", () => {
    // Control positivo: si el callback recibiera null siempre, la prueba de
    // arriba pasaria igual y no probaria nada.
    const ventana = conVentana();

    const visto: Array<Sesion | null> = [];
    suscribirse((s) => visto.push(s));

    guardar(SESION);
    ventana.dispatchEvent(eventoStorage(CLAVE, JSON.stringify(SESION)));

    expect(visto).toEqual([SESION]);
  });

  it("un localStorage.clear() ajeno tambien cuenta", () => {
    // El navegador manda `key: null` cuando se limpio todo. Filtrar solo por
    // nuestra clave dejaria pasar ese caso sin avisar a nadie.
    const ventana = conVentana();
    guardar(SESION);

    const visto: Array<Sesion | null> = [];
    suscribirse((s) => visto.push(s));

    almacen.clear();
    ventana.dispatchEvent(eventoStorage(null, null));

    expect(visto).toEqual([null]);
  });

  it("ignora los cambios de otras claves", () => {
    const ventana = conVentana();

    const visto: Array<Sesion | null> = [];
    suscribirse((s) => visto.push(s));

    ventana.dispatchEvent(eventoStorage("otra-cosa", "x"));

    expect(visto).toEqual([]);
  });

  it("desuscribirse deja de avisar", () => {
    const ventana = conVentana();

    const visto: Array<Sesion | null> = [];
    const cancelar = suscribirse((s) => visto.push(s));
    cancelar();

    ventana.dispatchEvent(eventoStorage(CLAVE, null));

    expect(visto).toEqual([]);
  });

  it("sin window, suscribirse no lanza y devuelve algo que se puede llamar", () => {
    // Es el caso del prerenderizado: el efecto de React no corre ahi, pero un
    // import de nivel de modulo si, y esto tiene que sobrevivirlo.
    vi.stubGlobal("window", undefined);
    const cancelar = suscribirse(() => {});
    expect(() => cancelar()).not.toThrow();
  });
});
