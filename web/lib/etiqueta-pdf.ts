// Pinta la etiqueta. **Donde va cada cosa ya viene resuelto en
// `etiqueta-maqueta.ts`; que dice la hoja, en `etiqueta.ts`.** Aca no se decide
// nada: se recorre una lista de elementos ya ubicados y se llama a jsPDF.
//
// Ese reparto es de `028` y es lo que hace verificable el feature. Hasta `026`
// este archivo hacia las dos cosas —calcular posiciones y dibujar— y por eso
// "nada se sale de la hoja" era una promesa y no una prueba: afirmarlo sobre un
// PDF ya dibujado es raspar bytes de un archivo comprimido. Con la maqueta como
// dato, la guarda de FR-003 es un `for` y un `expect`, y vive en
// `etiqueta-maqueta.test.ts`.
//
// **La hoja sigue siendo A4 y la etiqueta es un rectangulo de 120 x 100 adentro**
// (FR-001), con marcas de corte en las esquinas. El tamaño de pagina NO se toca:
// cuando a jsPDF se le pasa un `format` de dos numeros, cual termina siendo el
// ancho depende de `orientation`, y ese es justo el tipo de detalle que compila,
// se ve bien en pantalla y sale mal del papel.
//
// **Este modulo se importa de forma DINAMICA**, al tocar el boton, porque
// arrastra jsPDF: 108 KB comprimidos, medidos. Un import estatico se los
// cobraria a todo el que abre /pedido o /perfil, imprima o no.
import { jsPDF } from "jspdf";

import type { Etiqueta } from "./etiqueta";
import { lineaBase, maquetar, type Elemento, type Medir } from "./etiqueta-maqueta";
import { SILUETA_CAMION } from "./silueta-camion";

/** Grosor del recuadro del codigo. Es lo unico que el dibujo decide por su cuenta. */
const GROSOR_RECUADRO = 0.8;

export function dibujarEtiqueta(e: Etiqueta): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Helvetica de las 14 estandar del formato: **no se embebe ninguna fuente**.
  // Los caracteres del español entran en WinAnsi, comprobado en `020` leyendo
  // los bytes de un PDF real. Embeber una tipografia sumaria entre 100 y 300 KB
  // a cada etiqueta, para una hoja que se imprime en mono.
  doc.setFont("helvetica", "normal");

  // El medidor que la maqueta usa para cortar textos en renglones sale **de
  // este mismo documento**, no de uno de descarte: si midiera contra otro
  // estado de fuente, la maqueta calcularia con una tipografia y se dibujaria
  // con otra, y el sintoma seria texto que se pasa por poquito.
  const medir: Medir = (texto, pt, peso) => {
    doc.setFont("helvetica", peso);
    doc.setFontSize(pt);
    return doc.getTextWidth(texto);
  };

  const maqueta = maquetar(e, medir);

  // Las escuadras de corte, afuera del rectangulo. **Sin recuadro entero**: la
  // etiqueta recortada queda sin marco y un corte torcido no deja medio renglon
  // de linea en el borde.
  doc.setDrawColor(17);
  for (const s of maqueta.marcas) {
    doc.setLineWidth(s.grosor);
    doc.line(s.x1, s.y1, s.x2, s.y2);
  }

  for (const elemento of maqueta.elementos) dibujar(doc, elemento);

  return doc;
}

function dibujar(doc: jsPDF, e: Elemento): void {
  switch (e.tipo) {
    case "imagen":
      // La marca va como silueta negra, nunca el logo a color: la tipografia
      // original vive dentro de un PNG hecho para fondo azul, donde "FLASH" es
      // blanco y sobre papel desaparece.
      doc.addImage(SILUETA_CAMION, "PNG", e.x, e.y, e.ancho, e.alto);
      return;

    case "recuadro":
      doc.setDrawColor(e.gris);
      doc.setLineWidth(GROSOR_RECUADRO);
      doc.roundedRect(e.x, e.y, e.ancho, e.alto, 2, 2);
      return;

    case "regla":
      doc.setDrawColor(e.gris);
      doc.setLineWidth(e.alto);
      doc.line(e.x, e.y, e.x + e.ancho, e.y);
      return;

    case "texto":
      doc.setFont("helvetica", e.peso ?? "normal");
      doc.setFontSize(e.pt ?? 10);
      // Escala de grises, no colores. La hoja se imprime en blanco y negro, asi
      // que la jerarquia se hace con tamaño y peso: un gris de acento impreso en
      // mono es indistinguible de otro gris.
      doc.setTextColor(e.gris);
      // **Siempre desde el borde izquierdo de la caja, sin pasarle `align` a
      // jsPDF.** La maqueta ya resolvio el centrado midiendo el texto, y es esa
      // caja —la que la guarda de FR-003 comprueba— la que tiene que coincidir
      // con lo que se pinta. Delegar la alineacion seria dibujar segun una
      // cuenta distinta de la que se probo.
      doc.text(e.texto ?? "", e.x, lineaBase(e));
      return;
  }
}
