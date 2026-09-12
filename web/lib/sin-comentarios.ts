// Quitar los comentarios de un fuente TypeScript sin tocar lo demas.
//
// Vivia adentro de `sin-precio-a-la-vista.test.ts` y salio aca en `025`, SIN
// CAMBIARLE UNA LINEA, porque ahora lo usan dos guardas: esa, y la de
// `tablero.test.ts`, que escanea `lib/tablero.ts`. Importarlo del archivo de
// pruebas registraria todos sus casos una segunda vez.

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
