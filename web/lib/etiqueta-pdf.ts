// Dibuja la etiqueta en una hoja A4. Lo que DICE la hoja ya viene resuelto en
// `etiqueta.ts`; aca solo se decide como se ve.
//
// **Este modulo se importa de forma DINAMICA**, al tocar el boton, porque
// arrastra jsPDF: 108 KB comprimidos, medidos (research D1). Un import estatico
// se los cobraria a todo el que abre /pedido o /perfil, imprima o no (FR-014).
//
// El diseño manda una sola idea: **esto se lee pegado a una caja, parado, con
// una mano ocupada** — no sentado. De ahi que el codigo ocupe un tercio de la
// hoja y que la entrega pese mas que el retiro. Un resumen se hojea; una
// etiqueta se lee de un vistazo o no sirve.
import { jsPDF } from "jspdf";

import type { Etiqueta } from "./etiqueta";
import { SILUETA_CAMION, SILUETA_PROPORCION } from "./silueta-camion";

// A4 en milimetros. Todo el modulo trabaja en mm: es la unidad en la que uno
// piensa una hoja, y evita convertir en cada linea.
const ANCHO = 210;
const ALTO = 297;
const MARGEN = 18;
const UTIL = ANCHO - MARGEN * 2;

// Escala de grises, no colores. La hoja se imprime en blanco y negro (por eso la
// marca va como silueta), asi que la jerarquia se hace con tamaño y peso, no con
// color: un gris de acento impreso en mono es indistinguible de otro gris.
const NEGRO = 17;
const GRIS = 105;

/** Alto de linea comodo para un tamaño de fuente dado, en mm. */
const interlineado = (pt: number) => (pt * 0.3528) * 1.25;

export function dibujarEtiqueta(e: Etiqueta): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Helvetica de las 14 estandar del formato: **no se embebe ninguna fuente**.
  // Los caracteres del español entran en WinAnsi, comprobado leyendo los bytes
  // de un PDF real (research D2). Embeber una tipografia sumaria entre 100 y
  // 300 KB **a cada etiqueta**, para una hoja que se imprime en mono.
  doc.setFont("helvetica", "normal");

  let y = MARGEN;

  y = encabezado(doc, y);
  y = bloqueCodigo(doc, e.codigo, y);
  y = bloqueDireccion(doc, "ENTREGAR A", e.entrega, y, true);
  y = bloqueDireccion(doc, "RETIRAR DE", e.retiro, y, false);
  // **Sin comentario no se dibuja NADA**, ni el titulo ni el espacio: la hoja
  // sale identica a como salia antes de `026` (FR-009). Por eso la clave viene
  // ausente y no vacia desde `etiqueta.ts`.
  bloqueComentario(doc, e, y);
  pie(doc, e);

  return doc;
}

/** La marca: la silueta y el nombre como texto. Nunca el logo a color (FR-019). */
function encabezado(doc: jsPDF, y: number): number {
  const ALTO_CAMION = 13;
  const anchoCamion = ALTO_CAMION * SILUETA_PROPORCION;

  doc.addImage(SILUETA_CAMION, "PNG", MARGEN, y, anchoCamion, ALTO_CAMION);

  // El nombre va COMPUESTO, no copiado del logo: la tipografia original vive
  // dentro de un PNG hecho para fondo azul, donde "FLASH" es blanco y sobre
  // papel desaparece. Ver research D3.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(NEGRO);
  doc.text("FLASH URBANO", MARGEN + anchoCamion + 5, y + ALTO_CAMION - 3.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(GRIS);
  doc.text("LOGISTICA Y TRANSPORTE", MARGEN + anchoCamion + 5.5, y + ALTO_CAMION + 1.5);

  const linea = y + ALTO_CAMION + 6;
  doc.setDrawColor(NEGRO);
  doc.setLineWidth(0.6);
  doc.line(MARGEN, linea, ANCHO - MARGEN, linea);

  return linea + 12;
}

/**
 * El codigo, que es lo unico que tiene que leerse de lejos (FR-004).
 *
 * Va enmarcado y centrado, a 46 pt: a un brazo de distancia se lee sin
 * acercarse, que es la prueba del quickstart. Es tambien lo unico que vincula
 * el bulto con el pedido en la app.
 */
function bloqueCodigo(doc: jsPDF, codigo: string, y: number): number {
  const ALTO_CAJA = 34;

  doc.setDrawColor(NEGRO);
  doc.setLineWidth(1);
  doc.roundedRect(MARGEN, y, UTIL, ALTO_CAJA, 3, 3);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(GRIS);
  doc.text("CODIGO DEL PEDIDO", ANCHO / 2, y + 8, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(46);
  doc.setTextColor(NEGRO);
  doc.text(codigo, ANCHO / 2, y + 26, { align: "center" });

  return y + ALTO_CAJA + 12;
}

/**
 * Un extremo del viaje.
 *
 * `destacado` engorda la entrega: es la que el repartidor lee para llegar a una
 * puerta. El retiro esta para poder devolver el paquete si no se puede entregar,
 * que es el caso raro.
 */
function bloqueDireccion(
  doc: jsPDF,
  titulo: string,
  b: Etiqueta["entrega"],
  y: number,
  destacado: boolean,
): number {
  const ptNombre = destacado ? 17 : 13;
  const ptTexto = destacado ? 13 : 11;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(GRIS);
  doc.text(titulo, MARGEN, y);

  // La zona, a la derecha del titulo y en la misma linea. **Solo aparece si
  // esta**: un pedido anterior a `011` no tiene punto de entrega, y entonces el
  // renglon no existe — ni hueco ni leyenda (FR-018).
  if (b.zona) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(NEGRO);
    doc.text(b.zona.toUpperCase(), ANCHO - MARGEN, y, { align: "right" });
  }

  doc.setDrawColor(GRIS);
  doc.setLineWidth(0.2);
  doc.line(MARGEN, y + 2, ANCHO - MARGEN, y + 2);

  let cursor = y + 2 + interlineado(ptNombre);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(ptNombre);
  doc.setTextColor(NEGRO);
  cursor = escribirEnvuelto(doc, b.nombre, MARGEN, cursor, UTIL, ptNombre);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(ptTexto);
  cursor += 1;
  cursor = escribirEnvuelto(doc, b.direccion, MARGEN, cursor, UTIL, ptTexto);

  doc.setTextColor(GRIS);
  cursor = escribirEnvuelto(doc, `Tel. ${b.telefono}`, MARGEN, cursor, UTIL, ptTexto);

  return cursor + 10;
}

/**
 * Escribe texto cortandolo en varias lineas cuando no entra (FR-012).
 *
 * El corte lo decide **el medidor de ancho de la libreria**, no un conteo de
 * caracteres: "Piñeyro" y "MMMMMMM" tienen las mismas siete letras y ocupan
 * anchos muy distintos. Contar caracteres es como se desborda una etiqueta.
 */
function escribirEnvuelto(
  doc: jsPDF,
  texto: string,
  x: number,
  y: number,
  ancho: number,
  pt: number,
): number {
  const lineas: string[] = doc.splitTextToSize(texto, ancho);
  let cursor = y;
  for (const linea of lineas) {
    doc.text(linea, x, cursor);
    cursor += interlineado(pt);
  }
  return cursor;
}

/**
 * El comentario del cliente, debajo de las dos direcciones (026).
 *
 * **Va despues de las direcciones y no antes**: lo primero que Diego busca en
 * la hoja es adonde va el paquete. El comentario es lo que lee *ademas*, y
 * ponerlo arriba empujaria las direcciones hacia abajo en la unica parte de la
 * hoja que se mira de lejos.
 *
 * Se envuelve con `escribirEnvuelto`, que ya parte por ancho util, **y ademas
 * se respetan los renglones que escribio la persona**: un texto de tres
 * indicaciones se imprime en tres bloques, no en un parrafo corrido. Los 280
 * caracteres de tope acotan esto a unas pocas lineas.
 */
function bloqueComentario(doc: jsPDF, e: Etiqueta, y: number): void {
  if (!e.comentario) return;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(GRIS);
  doc.text("COMENTARIO", MARGEN, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(NEGRO);

  let cursor = y + 2 + interlineado(8);
  for (const renglon of e.comentario.split("\n")) {
    // Un renglon vacio es una separacion que la persona puso a proposito: se
    // respeta como espacio, sin llamar a `escribirEnvuelto` con texto vacio.
    if (renglon.trim() === "") {
      cursor += interlineado(11);
      continue;
    }
    cursor = escribirEnvuelto(doc, renglon, MARGEN, cursor, UTIL, 11);
  }
}

/** Fecha de retiro y cantidad, abajo (FR-006). */
function pie(doc: jsPDF, e: Etiqueta): void {
  const y = ALTO - MARGEN - 16;

  doc.setDrawColor(NEGRO);
  doc.setLineWidth(0.6);
  doc.line(MARGEN, y, ANCHO - MARGEN, y);

  const celda = (titulo: string, valor: string, x: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(GRIS);
    doc.text(titulo, x, y + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(NEGRO);
    doc.text(valor, x, y + 13);
  };

  celda("FECHA DE RETIRO", e.fechaRetiro, MARGEN);
  celda(
    "PAQUETES",
    `${e.cantidad} ${e.cantidad === 1 ? "paquete" : "paquetes"}`,
    MARGEN + UTIL / 2,
  );

  // NADA de plata en ninguna parte de la hoja (FR-007, Principio V). Este pie es
  // donde un total aparece solo por costumbre de formulario; no hay ni el dato
  // ni el lugar. La prohibicion esta probada sobre la estructura en
  // `etiqueta.test.ts`, que es donde se puede afirmar de verdad.
}
