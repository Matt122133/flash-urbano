import { describe, expect, it } from "vitest";
import { COMENTARIO_LARGO_MAXIMO, comentarioParaMostrar } from "./comentario";

// FR-009: un pedido sin comentario se ve **exactamente como antes de este
// feature**. Lo que se prueba aca es la DECISION, no el dibujo — el repo no
// tiene pruebas de componentes y montarlas seria infraestructura de mas. Ver el
// comentario de cabecera de `comentario.ts`.

describe("comentarioParaMostrar", () => {
  it("devuelve el texto cuando hay comentario", () => {
    expect(comentarioParaMostrar("Tocar timbre del 2")).toBe("Tocar timbre del 2");
  });

  // Los tres son "no hay comentario" y tienen que dar lo mismo. `undefined` es
  // el caso real: el servicio OMITE la clave cuando no hay comentario, asi que
  // la pantalla recibe `undefined` y no `null`.
  it.each([
    ["undefined", undefined],
    ["null", null],
    ["cadena vacia", ""],
  ])("no muestra nada con %s", (_caso, entrada) => {
    expect(comentarioParaMostrar(entrada)).toBeNull();
  });

  // FR-004 del lado de la pantalla: un comentario de solo espacios es ninguno.
  // El servicio ya no deberia guardar esto, pero la pantalla tambien dibuja lo
  // que YA esta guardado, y un `""` de otro camino no puede pintar un bloque
  // vacio.
  it.each([["espacios", "   "], ["saltos", "\n\n"], ["tabs", "\t\t"], ["mezcla", " \n \t "]])(
    "no muestra nada con solo %s",
    (_caso, entrada) => {
      expect(comentarioParaMostrar(entrada)).toBeNull();
    },
  );

  it("recorta los extremos", () => {
    expect(comentarioParaMostrar("  Tocar timbre  ")).toBe("Tocar timbre");
  });

  // **La prueba que caza el defecto clasico del campo multilinea.** Aplanar los
  // renglones no cambia el tipo ni rompe la compilacion: una lista de tres
  // indicaciones se leeria como un parrafo pegado y nadie se enteraria.
  it("conserva los saltos de linea de adentro", () => {
    const tres = "Llamar antes\nPreguntar por la encargada\nRetirar por atras";
    const salida = comentarioParaMostrar(`\n  ${tres}  \n`);
    expect(salida).toBe(tres);
    expect(salida?.split("\n")).toHaveLength(3);
  });

  it("no toca las comillas, las enes ni las tildes", () => {
    const texto = 'Llamar antes: "el porton esta trabado". Preguntar por Ambar ñ';
    expect(comentarioParaMostrar(texto)).toBe(texto);
  });
});

// El tope tiene que ser el mismo numero en las tres capas: esta constante, la
// del servicio (`ComentarioLargoMaximo`) y el `CHECK` de la migracion `0009`.
// Si se separan, la pantalla dice que queda lugar y el pedido vuelve rechazado.
describe("COMENTARIO_LARGO_MAXIMO", () => {
  it("es 280", () => {
    expect(COMENTARIO_LARGO_MAXIMO).toBe(280);
  });
});
