import { existsSync, readFileSync } from "node:fs";
import { dirname, join, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ZONAS } from "./zonas";
import { resolverZona } from "./zona-lookup";

// FR-001 y FR-002: cotizar no puede depender del servicio. Un desconocido tiene
// que poder cargar una direccion y ver el precio con el backend caido, apagado o
// todavia sin desplegar.
//
// Esta es la unica guarda AUTOMATICA de esa promesa. Todo lo demas que la
// protege es verificacion manual, y la verificacion manual no corre en cada
// commit. Lo que se rompe sin esto no se rompe de golpe: alguien agrega un
// `import` conveniente en una pantalla del formulario, nadie lo nota porque en
// desarrollo el servicio esta arriba, y el dia que el servicio se cae deja de
// venderse.
//
// Se prueba en dos planos, porque uno solo no alcanza:
//
//   1. Estatico — el grafo de imports del camino de cotizar no llega a
//      `lib/api.ts` ni a `lib/sesion.ts`, ni directa ni transitivamente.
//   2. Dinamico — el precio sale sin que exista `fetch`.
//
// El plano estatico es el que importa: atrapa la dependencia el dia que se
// escribe, no el dia que alguien acierta a probar con el servicio apagado.
//
// LIMITE CONOCIDO, agregado el 2026-08-10 con T040. `app/layout.tsx` monta el
// proveedor de sesion arriba de TODO, incluido /pedido, y ese proveedor si
// importa `lib/api.ts`. El layout NO figura entre las ENTRADAS de abajo, asi
// que este archivo no lo mira — y es deliberado, porque mirarlo pondria la
// prueba en rojo por un import que tiene que existir.
//
// Lo que sostiene FR-001 en ese camino es una propiedad de COMPORTAMIENTO y no
// del grafo: sin credencial guardada, el proveedor no hace una sola llamada de
// red. Vive en un `if` de `components/sesion/proveedor-sesion.tsx` y **no tiene
// prueba automatica**: probarla necesita renderizar React, y el entorno de
// vitest de este repo es `node` sin DOM. Hoy la cubre T025, que es manual.
// Anotado en docs/tech-debt-tracker.md.

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..");

/** Lo que arranca el camino de cotizar. */
const ENTRADAS = [
  // El formulario entero: es "lo que importa el formulario" de la tarea.
  "components/pedido-form.tsx",
  "lib/zonas.ts",
  "lib/zona-lookup.ts",
  "lib/direcciones.ts",
];

/** Lo que ese camino no puede tocar. */
const PROHIBIDOS = ["lib/api.ts", "lib/sesion.ts"];

// Modulos que el recorrido DEBE alcanzar, y ninguno es una entrada: se llega a
// ellos solo siguiendo imports. Sin esto la prueba pasa de arriba cuando el
// resolvedor deja de resolver —un alias que cambia, una extension nueva—,
// porque un grafo vacio tampoco contiene lo prohibido.
//
// Cada uno cubre una forma distinta de import, que es el punto:
const ALCANZABLES = [
  "lib/direccion.ts", // alias "@/lib/...", desde el formulario
  "lib/asset.ts", // relativo "./...", a dos saltos
  "components/campo-autocompletado.tsx", // .tsx entre componentes
  "components/mapa-zonas.tsx", // import() dinamico de next/dynamic
];

const EXTENSIONES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

// `from "x"`, `import "x"` e `import("x")`. Puede tomar de mas —una ruta dentro
// de un comentario o de un string— y esta bien: de mas es hacia el lado seguro.
const ESPECIFICADOR = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;

/** La ruta que un especificador pretende alcanzar, exista el archivo o no. */
function destino(archivo: string, especificador: string): string | null {
  if (especificador.startsWith("@/")) return especificador.slice(2);
  if (especificador.startsWith(".")) {
    const absoluto = resolve(RAIZ, dirname(archivo), especificador);
    return relative(RAIZ, absoluto).split(sep).join(posix.sep);
  }
  // Paquete de node_modules: no puede volver a nuestro codigo.
  return null;
}

/**
 * La misma ruta escrita siempre igual, sin extension ni `/index`.
 *
 * Hace falta porque los dos lados de la comparacion vienen con formas
 * distintas: un import dice `./api` y el archivo se llama `lib/api.ts`. Sin
 * normalizar, la comprobacion de lo prohibido no compara nada y pasa siempre
 * — que es exactamente el defecto que encontro el caso de control.
 */
function canonico(ruta: string): string {
  return ruta.replace(/\.tsx?$/, "").replace(/\/index$/, "");
}

/** El archivo real detras de un destino, probando las extensiones de Next. */
function resolverArchivo(destino: string): string | null {
  if (destino.endsWith(".css")) return null;
  for (const ext of EXTENSIONES) {
    const candidato = `${destino}${ext}`;
    if (existsSync(join(RAIZ, candidato))) return candidato;
  }
  return null;
}

type Grafo = {
  /** Archivo alcanzado -> quien lo importo primero. */
  padre: Map<string, string | null>;
  /**
   * Destino pretendido, en forma canonica -> quien lo importo. Se llena
   * resuelva o no a un archivo existente.
   */
  pretendidos: Map<string, string>;
};

function recorrer(entradas: string[]): Grafo {
  const padre = new Map<string, string | null>();
  const pretendidos = new Map<string, string>();
  const pendientes: string[] = [];

  for (const entrada of entradas) {
    const archivo = resolverArchivo(entrada);
    // Una entrada que no existe es un error de esta prueba, no del codigo.
    expect(archivo, `no existe la entrada ${entrada}`).not.toBeNull();
    if (archivo && !padre.has(archivo)) {
      padre.set(archivo, null);
      pendientes.push(archivo);
    }
  }

  while (pendientes.length > 0) {
    const actual = pendientes.pop()!;
    const fuente = readFileSync(join(RAIZ, actual), "utf8");

    for (const coincidencia of fuente.matchAll(ESPECIFICADOR)) {
      const pretendido = destino(actual, coincidencia[1]);
      if (!pretendido) continue;
      const clave = canonico(pretendido);
      if (!pretendidos.has(clave)) pretendidos.set(clave, actual);

      const archivo = resolverArchivo(pretendido);
      if (!archivo || padre.has(archivo)) continue;
      padre.set(archivo, actual);
      pendientes.push(archivo);
    }
  }

  return { padre, pretendidos };
}

/** La cadena de imports que llega hasta un archivo, para que el fallo se lea. */
function cadena(grafo: Grafo, archivo: string): string {
  const pasos = [archivo];
  let actual = grafo.padre.get(archivo) ?? null;
  while (actual) {
    pasos.unshift(actual);
    actual = grafo.padre.get(actual) ?? null;
  }
  return pasos.join(" -> ");
}

describe("el camino de cotizar no depende del servicio (FR-001, FR-002)", () => {
  const grafo = recorrer(ENTRADAS);

  it.each(ALCANZABLES)("el recorrido llega a %s siguiendo imports", (modulo) => {
    // Guarda contra el falso verde: si esto falla, el resolvedor se rompio y
    // los casos de abajo no estan probando nada.
    //
    // Se exige un padre, no solo estar en el grafo: una entrada esta siempre,
    // asi que comprobarla no demuestra que el recorrido ande.
    expect(grafo.padre.get(modulo), `${modulo} no fue alcanzado`).toBeTruthy();
  });

  it("el detector encuentra lo prohibido cuando esta", () => {
    // La otra mitad de la guarda contra el falso verde. Arriba se comprueba que
    // el recorrido llega a donde tiene que llegar; aca, que reconoce un import
    // prohibido cuando existe de verdad. Se usa `lib/api.test.ts`, que importa
    // `./api` a proposito, en vez de ensuciar un archivo de produccion.
    const control = recorrer(["lib/api.test.ts"]);
    expect(control.pretendidos.has(canonico("lib/api.ts"))).toBe(true);
  });

  it.each(PROHIBIDOS)("no llega a %s por ningun camino", (prohibido) => {
    // Se mira el destino PRETENDIDO, no el archivo resuelto: `lib/sesion.ts`
    // todavia no existe, y un import hacia el tiene que fallar esta prueba
    // igual el dia que se escriba, no recien cuando el archivo aparezca.
    const quien = grafo.pretendidos.get(canonico(prohibido));
    expect(
      quien,
      quien ? `${prohibido} entra por: ${cadena(grafo, quien)}` : "",
    ).toBeUndefined();
  });
});

describe("el precio se resuelve sin red", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("cotiza con fetch roto", () => {
    // No se quita `fetch`: se lo reemplaza por algo que explota. Un modulo que
    // se apoyara en la red fallaria; uno que no la toca ni se entera.
    const espia = vi.fn(() => {
      throw new Error("el camino de cotizar toco la red");
    });
    vi.stubGlobal("fetch", espia);

    // La Blanqueada, el mismo punto interior que verifica zona-lookup.test.ts.
    const zona = resolverZona(-34.872, -56.16);

    expect(zona?.id).toBe(1);
    expect(zona?.precio).toBe(ZONAS.find((z) => z.id === 1)?.precio);
    expect(zona?.precio).toBeGreaterThan(0);
    expect(espia).not.toHaveBeenCalled();
  });

  it("fuera de cobertura tampoco consulta a nadie", () => {
    // El caso sin precio es donde mas tienta preguntarle a un servidor.
    const espia = vi.fn(() => {
      throw new Error("el camino de cotizar toco la red");
    });
    vi.stubGlobal("fetch", espia);

    expect(resolverZona(-34.96, -56.18)).toBeNull();
    expect(espia).not.toHaveBeenCalled();
  });
});
