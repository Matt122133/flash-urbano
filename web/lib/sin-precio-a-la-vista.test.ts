import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { sinComentarios } from "./sin-comentarios";

// **REDEFINIDA POR `024` EL 2026-09-10. Leer esto antes que nada.**
//
// Esta guarda nacio en `013` afirmando que el precio no se muestra en NINGUNA
// pantalla. Desde la constitucion 6.0.0 eso ya no es cierto, y el cambio es
// deliberado: el cliente identificado ve el monto de su zona en el bloque de
// cobertura del formulario. Lo que el cliente NUNCA quiso es que lo viera un
// visitante anonimo, y **esa mitad es la que este archivo sigue custodiando**.
//
// Por eso se redefinio en vez de borrarse (FR-017 de `024`). Borrarla habria
// dejado sin ninguna proteccion automatica justo la mitad que el cliente pidio
// de verdad — que es la mitad que un agente futuro, leyendo solo "mostrar el
// precio", rompe sin enterarse.
//
// La frontera nueva es de un archivo de ancho: `EXCEPTUADOS`, mas abajo. Todo lo
// demas de `app/` y `components/` sigue sin poder nombrar un monto, **tambien
// para un usuario con sesion**: la puerta abre el formulario, no el sitio.
// Ver docs/decisions/price-behind-the-login.md y specs/024-precio-detras-del-login/.
//
// ---
//
// FR-020 de `013`, en su forma vigente: **el precio no se muestra en ninguna
// pantalla de cara al cliente salvo en el unico archivo exceptuado**, y esta es
// la unica guarda automatica de esa promesa.
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
 * Lo unico que puede nombrar un monto, y es por RUTA EXACTA (`024`, FR-017).
 *
 * **Por archivo y no por region** a proposito. Exceptuar `pedido-form.tsx`
 * entero —mil lineas— habria autorizado de paso un total, un resumen previo o
 * una linea de precio suelta, que es justo lo que FR-007a prohibe. Un archivo de
 * cuarenta lineas se puede leer entero cada vez que alguien lo toca.
 *
 * **El escaneo mira tambien los strings, y eso obligo a renombrar el
 * componente.** Se iba a llamar `PrecioDeZona` en `precio-de-zona.tsx`; con ese
 * nombre, el `import` desde `pedido-form.tsx` ponia esta prueba en rojo por el
 * identificador y por la ruta. La excepcion por archivo no alcanza cuando el
 * archivo que lo USA tambien lo nombra. Resulto una propiedad util: fuera de su
 * propio archivo, el precio es innombrable.
 *
 * Agregar una ruta aca es una decision de producto, no de codigo: hoy la
 * constitucion autoriza el monto en UN lugar, junto al nombre de la zona.
 */
const EXCEPTUADOS = ["components/pedido/monto-de-zona.tsx"];

/** Quien puede importar lo exceptuado. Ver el caso C2, mas abajo. */
const IMPORTADORES_ESPERADOS = 1;

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

// `sinComentarios` vive en `./sin-comentarios` desde `025`: lo comparte con la
// guarda del tablero. Ver ese archivo.

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
  const todos = DIRECTORIOS.flatMap(archivos);
  const mirados = todos.filter((archivo) => !EXCEPTUADOS.includes(archivo));

  it("hay archivos que mirar", () => {
    // Guarda contra el falso verde. Si el recorrido deja de encontrar archivos
    // —una carpeta que se renombra, una extension nueva— los casos de abajo
    // pasan de arriba sin haber leido nada.
    expect(mirados.length).toBeGreaterThan(15);
    expect(mirados).toContain("components/pedido-form.tsx");
    expect(mirados).toContain("app/sobre-nosotros/page.tsx");
  });

  // **Agregado por `025`: el tablero de Diego es la pantalla con MAS riesgo de
  // traer plata**, porque "dashboard" es donde un total facturado parece natural.
  // Esta guarda lo cubre sin cambios —mira todo `app/` y `components/`—, y este
  // caso es lo que lo sostiene: si el tablero se mudara a una carpeta que el
  // recorrido no mira, la guarda quedaria en verde sin haberlo leido nunca. Ver
  // specs/025-dashboard-de-diego/research.md D9.
  it("el tablero de 025 está entre lo que se mira", () => {
    expect(mirados).toContain("app/tablero/page.tsx");
    expect(mirados).toContain("components/tablero/tablero.tsx");
  });

  // Sin esto, un dia alguien renombra o borra el archivo exceptuado, la ruta de
  // `EXCEPTUADOS` deja de corresponder a nada, y la guarda sigue en verde
  // exceptuando el vacio. El feature se puede haber ido entero sin que nada
  // avise.
  it("cada ruta exceptuada existe de verdad", () => {
    for (const exceptuado of EXCEPTUADOS) {
      expect(todos, `${exceptuado} no existe: la excepción no exceptúa nada`).toContain(
        exceptuado,
      );
    }
  });

  it.each(mirados)("%s no muestra ni nombra un monto", (archivo) => {
    const encontrado = hallazgos(readFileSync(join(RAIZ, archivo), "utf8"));
    expect(
      encontrado,
      encontrado.length > 0
        ? `${archivo} volvió a traer: ${encontrado.join("; ")}.\n` +
            "Desde la constitución 6.0.0 el monto se muestra en UN solo lugar:\n" +
            `${EXCEPTUADOS.join(", ")}, junto al nombre de la zona y solo con sesión.\n` +
            "En cualquier otro archivo de app/ o components/ sigue prohibido, también\n" +
            "para un usuario con sesión: la puerta abre el formulario, no el sitio.\n" +
            "Ver docs/decisions/price-behind-the-login.md y el Principio V, versión 6.0.0."
        : "",
    ).toEqual([]);
  });
});

// C2 del contrato (specs/024-precio-detras-del-login/contracts/bloque-de-zona.md).
//
// La excepcion de arriba autoriza un ARCHIVO. Sin este caso, ese archivo se
// puede colgar despues de cualquier pantalla —el resumen previo, la tarjeta de
// Mis pedidos, la etiqueta— y el monto se escapa del bloque de la zona **sin que
// nada se ponga en rojo**, porque el archivo que lo importa nunca nombra un
// precio: nombra un componente. FR-007a se perderia en silencio.
describe("lo exceptuado se usa en un solo lugar (C2)", () => {
  const todos = DIRECTORIOS.flatMap(archivos);

  it.each(EXCEPTUADOS)("%s es importado por exactamente un archivo", (exceptuado) => {
    // El especificador tal como se escribe en un import, sin extension.
    const modulo = `@/${exceptuado.replace(/\.tsx?$/, "")}`;

    const importadores = todos
      .filter((archivo) => archivo !== exceptuado)
      .filter((archivo) =>
        sinComentarios(readFileSync(join(RAIZ, archivo), "utf8")).includes(modulo),
      );

    expect(
      importadores,
      `${exceptuado} lo importan ${importadores.length} archivos: ${importadores.join(", ") || "ninguno"}.\n` +
        "El monto vive junto al nombre de la zona y en ningún otro lado (FR-007a).\n" +
        "Colgar este componente de otra pantalla es sacar el precio de detrás de\n" +
        "su única puerta. Si el cambio es deliberado, es una decisión de producto:\n" +
        "pasa por la constitución antes que por acá.",
    ).toHaveLength(IMPORTADORES_ESPERADOS);
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

  // **El control positivo de la EXCEPCION, agregado por `024`.**
  //
  // Los casos de arriba prueban que el detector detecta. Este prueba que la
  // excepcion hace falta: si el archivo exceptuado no tuviera un monto adentro,
  // exceptuarlo no costaria nada y nadie notaria que la lista quedo apuntando a
  // un archivo que ya no muestra el precio — o sea, que el feature se fue.
  it.each(EXCEPTUADOS)("%s SI trae un monto, o la excepción sobra", (exceptuado) => {
    expect(
      hallazgos(readFileSync(join(RAIZ, exceptuado), "utf8")),
      `${exceptuado} está exceptuado pero no muestra ningún monto.\n` +
        "O el feature se fue de ahí, o la excepción quedó de más. Las dos cosas\n" +
        "importan: mientras esa línea siga en EXCEPTUADOS, ese archivo puede\n" +
        "mostrar un precio sin que nadie mire.",
    ).not.toEqual([]);
  });
});
