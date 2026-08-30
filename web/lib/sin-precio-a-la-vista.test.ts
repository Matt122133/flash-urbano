import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// FR-020. **El precio no se muestra en ninguna pantalla de cara al cliente**, y
// esta es la unica guarda automatica de esa promesa.
//
// El riesgo de `013` no es tecnico: no hay algoritmo nuevo ni dato nuevo. Es de
// OMISION y de REGRESION. Once lugares mostraban o nombraban un monto; alcanza
// con que alguien reponga uno —copiando un componente viejo, reusando un
// resumen, "mejorando" un mensaje de error— para que el sitio vuelva a
// prometer lo que el cliente pidio sacar. Un diff no lo atrapa: nadie relee
// once archivos en cada commit.
//
// **El dato SIGUE EXISTIENDO**, y por eso esta prueba es necesaria en vez de
// imposible. `lib/zonas.ts` conserva `precio`, `lib/pedido.ts` lo sigue
// mandando y Postgres lo sigue guardando (FR-015, y
// docs/decisions/price-not-shown.md). O sea que reponer el monto en pantalla
// cuesta una linea. La frontera no es que el numero no exista: es que no cruce
// de `lib/` hacia `app/` y `components/`.
//
// Por eso se prohibe **nombrar** el precio y no solo leer la propiedad. Un
// `formatearPrecio()` puesto en `lib/` —que esta guarda no puede escanear,
// porque ahi el precio TIENE que seguir viviendo— y llamado desde un
// componente pasaria una guarda que solo mirara `.precio`. Lo encontro el
// analyze del 2026-08-30, antes de que se escribiera una linea.
//
// Los comentarios quedan FUERA del escaneo, a proposito: explicar por que el
// precio no esta es informacion util, y prohibirlo empujaria a borrar la
// explicacion junto con el codigo. Esto mismo es un comentario, y por eso puede
// decir "precio" tantas veces.

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..");

/** Lo que se mira: todo lo que la persona puede llegar a ver. */
const DIRECTORIOS = ["app", "components"];

const EXTENSIONES = [".ts", ".tsx"];

/**
 * Lo que no puede aparecer, ya sin comentarios.
 *
 * Cada uno con el nombre con el que se lee el fallo, porque el mensaje es la
 * mitad del valor de una guarda: quien la rompa dentro de seis meses no va a
 * tener este archivo en la cabeza.
 */
const PROHIBIDO: { nombre: string; patron: RegExp }[] = [
  {
    nombre: "el precio nombrado de cualquier forma (`precio`, `.precio`, `formatearPrecio`)",
    patron: /precio/i,
  },
  { nombre: "un monto en pesos (`$ 250`)", patron: /\$\s*\d/ },
  { nombre: "la palabra `costo`", patron: /costo/i },
  { nombre: "`cuánto sale`", patron: /cu[aá]nto\s+sale/i },
];

/**
 * El fuente sin comentarios, conservando el largo de lo que saca.
 *
 * **No alcanza un `replace` de `/\/\/.*$/`**: un `//` adentro de un string es
 * texto, no un comentario, y una URL en una cadena romperia el escaneo hacia el
 * lado inseguro —ocultaria el resto de la linea—. Asi que se recorre caracter
 * por caracter llevando el estado de en que se esta: codigo, comilla simple,
 * doble, plantilla, comentario de linea o de bloque.
 *
 * Los comentarios se reemplazan por espacios en vez de borrarse, para que
 * `precio` de un comentario no quede pegado al codigo de al lado y produzca una
 * coincidencia que no existia.
 */
export function sinComentarios(fuente: string): string {
  let salida = "";
  let i = 0;
  type Estado = "codigo" | "'" | '"' | "`" | "linea" | "bloque";
  let estado: Estado = "codigo";

  while (i < fuente.length) {
    const c = fuente[i];
    const siguiente = fuente[i + 1];

    if (estado === "codigo") {
      if (c === "/" && siguiente === "/") {
        estado = "linea";
        salida += "  ";
        i += 2;
        continue;
      }
      if (c === "/" && siguiente === "*") {
        estado = "bloque";
        salida += "  ";
        i += 2;
        continue;
      }
      if (c === "'" || c === '"' || c === "`") estado = c;
      salida += c;
      i += 1;
      continue;
    }

    if (estado === "linea") {
      if (c === "\n") {
        estado = "codigo";
        salida += c;
      } else {
        salida += " ";
      }
      i += 1;
      continue;
    }

    if (estado === "bloque") {
      if (c === "*" && siguiente === "/") {
        estado = "codigo";
        salida += "  ";
        i += 2;
      } else {
        salida += c === "\n" ? c : " ";
        i += 1;
      }
      continue;
    }

    // Dentro de un string o una plantilla.
    if (c === "\\") {
      salida += fuente.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (c === estado) estado = "codigo";
    salida += c;
    i += 1;
  }

  return salida;
}

/** Lo prohibido que aparece en un fuente, ya sin comentarios. */
export function hallazgos(fuente: string): string[] {
  const limpio = sinComentarios(fuente);
  return PROHIBIDO.filter(({ patron }) => patron.test(limpio)).map(
    ({ nombre }) => nombre,
  );
}

function archivos(directorio: string): string[] {
  const encontrados: string[] = [];
  const pendientes = [join(RAIZ, directorio)];

  while (pendientes.length > 0) {
    const actual = pendientes.pop()!;
    for (const entrada of readdirSync(actual)) {
      const camino = join(actual, entrada);
      if (statSync(camino).isDirectory()) {
        pendientes.push(camino);
      } else if (EXTENSIONES.some((ext) => entrada.endsWith(ext))) {
        encontrados.push(relative(RAIZ, camino).split(sep).join(posix.sep));
      }
    }
  }

  return encontrados;
}

describe("ningún monto llega a una pantalla de cara al cliente (FR-020)", () => {
  const mirados = DIRECTORIOS.flatMap(archivos);

  it("hay archivos que mirar", () => {
    // Guarda contra el falso verde. Si el recorrido deja de encontrar archivos
    // —una carpeta que se renombra, una extension nueva— los casos de abajo
    // pasan de arriba sin haber leido nada.
    expect(mirados.length).toBeGreaterThan(15);
    expect(mirados).toContain("components/pedido-form.tsx");
    expect(mirados).toContain("app/sobre-nosotros/page.tsx");
  });

  it.each(mirados)("%s no muestra ni nombra un monto", (archivo) => {
    const encontrado = hallazgos(readFileSync(join(RAIZ, archivo), "utf8"));
    expect(
      encontrado,
      encontrado.length > 0
        ? `${archivo} volvió a traer: ${encontrado.join("; ")}.\n` +
            "El precio salió de todas las pantallas el 2026-08-30 por decisión del cliente:\n" +
            "él lo acuerda por su cuenta. El dato sigue existiendo en lib/ y en la base;\n" +
            "lo que no puede es cruzar a app/ ni a components/.\n" +
            "Ver docs/decisions/price-not-shown.md y el Principio V, versión 5.0.0."
        : "",
    ).toEqual([]);
  });
});

// EL CONTROL POSITIVO. Una prueba que afirma que algo NO pasa vale lo que valga
// su demostracion de que sabria detectarlo: sin esto, la guarda queda verde el
// dia que `sinComentarios` devuelva vacio o que el recorrido deje de leer, y
// nadie se entera hasta que el monto ya esta publicado.
describe("el detector sabe detectar", () => {
  it("marca el monto renderizado que este feature saco", () => {
    expect(hallazgos("const x = <p>$ {zona.precio}</p>;")).not.toEqual([]);
  });

  it("marca un helper importado, aunque no toque la propiedad", () => {
    // La puerta que encontro el analyze: el calculo se muda a `lib/`, que esta
    // guarda no puede mirar, y el componente solo llama a la funcion.
    expect(hallazgos('import { formatearPrecio } from "@/lib/plata";')).not.toEqual(
      [],
    );
  });

  it("marca un monto escrito a mano, sin variable de por medio", () => {
    expect(hallazgos("const x = <p>Sale $ 250</p>;")).not.toEqual([]);
  });

  it("marca un texto que habla de costo", () => {
    expect(hallazgos('const t = "Consultá el costo antes de pedir";')).not.toEqual(
      [],
    );
  });

  // La otra mitad: que NO marque de mas. Una guarda que tambien prohibiera
  // explicar el cambio empujaria a borrar la explicacion junto con el codigo, y
  // el proximo agente reintroduciria el monto sin saber por que no estaba.
  it("no marca un comentario que explica por qué el precio no está", () => {
    expect(
      hallazgos("// Acá iba el precio: salió el 2026-08-30. Sale $ 250 era esto.\nconst x = 1;"),
    ).toEqual([]);
  });

  it("no marca un comentario de bloque ni uno de JSX", () => {
    expect(hallazgos("/* el precio y su monto $ 250 */\nconst x = 1;")).toEqual([]);
    expect(hallazgos("const x = <div>{/* sin precio */}</div>;")).toEqual([]);
  });

  it("no confunde un `//` que vive adentro de un string", () => {
    // Si `sinComentarios` tratara esto como comentario, borraria el resto de la
    // linea y esconderia lo que viene despues — un falso verde silencioso.
    expect(hallazgos('const u = "https://flashurbano.uy"; const p = zona.precio;')).not.toEqual(
      [],
    );
  });
});
