import { jsPDF } from "jspdf";
import { describe, expect, it } from "vitest";
import { etiquetaDelFormulario, etiquetaDelPedido, type Etiqueta } from "./etiqueta";
import {
  maquetar,
  PISO,
  RECORTE,
  UTIL,
  type Elemento,
  type Maqueta,
  type Medir,
} from "./etiqueta-maqueta";

// **Esta es la mitad de `028` que `020` no tenia.**
//
// `etiqueta.test.ts` prueba lo que la hoja DICE y dice de si mismo, textual, que
// "el aspecto es del quickstart: una hoja puede tener todos estos campos
// correctos y ser ilegible, y ninguna prueba de este archivo lo notaria".
//
// Al achicar la etiqueta de una A4 a 120 x 100 aparecieron requisitos que son
// GEOMETRICOS —que nada quede fuera del recorte, que entre en un solo
// rectangulo, que ningun cuerpo baje de su piso— y esos si se pueden afirmar,
// porque `etiqueta-maqueta.ts` devuelve la hoja como un dato en vez de como una
// secuencia de llamadas a jsPDF.
//
// Lo que sigue SIN estar probado aca es si la hoja sirve: si 26 pt se leen a un
// brazo, si el recorte da 12 x 10 en papel, si la silueta impresa en mono parece
// un camion. Eso es el quickstart, con impresora, tijera y regla.

// El medidor REAL, el mismo que usa `etiqueta-pdf.ts` para dibujar (research
// D5). Medir con una imitacion probaria la imitacion.
const doc = new jsPDF({ unit: "mm", format: "a4" });
const medir: Medir = (texto, pt, peso) => {
  doc.setFont("helvetica", peso);
  doc.setFontSize(pt);
  return doc.getTextWidth(texto);
};

// --- Casos ------------------------------------------------------------------

/** Un pedido de todos los dias. Es el caso al que la maqueta se calza (FR-005). */
const CORRIENTE: Etiqueta = {
  codigo: "FU-1234",
  entrega: {
    nombre: "Ana Pereira",
    telefono: "099 123 456",
    direccion: "Av. Giannattasio 890 esq. Calle 20",
    zona: "Zona 5",
  },
  retiro: {
    nombre: "Carlos Antunez",
    telefono: "098 765 432",
    direccion: "Bulevar España 2145 apto 302 esq. Br. Artigas",
  },
  fechaRetiro: "2026-09-21",
  cantidad: 2,
  comentario: "Tocar timbre del 3.",
};

/** Lo mas largo que el formulario deja escribir, en todos los campos a la vez. */
const EXTREMO: Etiqueta = {
  codigo: "FU-9999",
  entrega: {
    nombre: "María Fernanda Rodríguez Piñeyro",
    telefono: "099 123 456",
    direccion:
      "Avenida General Rivera 4521 bis apto 1204 esq. Doctor Luis Alberto de Herrera, cooperativa",
    zona: "Zona 3",
  },
  retiro: {
    nombre: "Juan Sebastián Etcheverría Olivera",
    telefono: "098 765 432",
    direccion:
      "Camino Carrasco 3890 apto 502 esq. Avenida Bolivia, cooperativa",
  },
  fechaRetiro: "2026-09-21",
  cantidad: 12,
  // 280 caracteres, el tope del formulario.
  comentario: "a".repeat(70) + " " + "b".repeat(70) + " " + "c".repeat(68) + " " + "d".repeat(69),
};

const conComentario = (base: Etiqueta, comentario: string): Etiqueta => ({ ...base, comentario });

const renglones = (n: number) =>
  Array.from({ length: n }, (_, i) => `Indicacion ${i + 1}`).join("\n");

// --- Los detectores, a parte, para poder probarlos ---------------------------
//
// Cada guarda de abajo afirma que algo NO pasa, y una guarda negativa que nunca
// se vio en rojo esta verde tambien cuando dejo de mirar donde cree que mira.
// Por eso los detectores son funciones sueltas: asi el control positivo les
// puede pasar un caso malo armado a mano y comprobar que lo marcan.

/** Devuelve los elementos que se salen del recorte. Vacio = todo adentro. */
function fueraDelRecorte(m: Pick<Maqueta, "recorte" | "elementos">): Elemento[] {
  const { x, y, ancho, alto } = m.recorte;
  return m.elementos.filter(
    (e) => e.x < x || e.y < y || e.x + e.ancho > x + ancho || e.y + e.alto > y + alto,
  );
}

/** Devuelve los textos que quedaron por debajo del piso de su rol. */
function bajoElPiso(m: Pick<Maqueta, "elementos">): Elemento[] {
  return m.elementos.filter(
    (e) => e.tipo === "texto" && e.rol !== undefined && (e.pt ?? 0) < PISO[e.rol],
  );
}

const textos = (m: Maqueta, bloque: Elemento["bloque"]) =>
  m.elementos.filter((e) => e.tipo === "texto" && e.bloque === bloque).map((e) => e.texto ?? "");

// ---------------------------------------------------------------------------

describe("el recorte (FR-003)", () => {
  it("la etiqueta mide 12 x 10 y cae donde dice research D2", () => {
    expect(RECORTE).toEqual({ x: 15, y: 15, ancho: 120, alto: 100 });
    // Lo util, que es el presupuesto con el que se maqueto.
    expect(UTIL).toEqual({ ancho: 110, alto: 90 });
  });

  it.each([
    ["un pedido corriente", CORRIENTE],
    ["el tope de contenido", EXTREMO],
    ["sin comentario", { ...CORRIENTE, comentario: undefined }],
    ["sin zona de entrega", { ...CORRIENTE, entrega: { ...CORRIENTE.entrega, zona: undefined } }],
    ["un comentario de ocho renglones", conComentario(CORRIENTE, renglones(8))],
    ["un comentario de veinte renglones", conComentario(CORRIENTE, renglones(20))],
  ])("ningun elemento se sale del recorte: %s", (_caso, etiqueta) => {
    const m = maquetar(etiqueta as Etiqueta, medir);
    expect(fueraDelRecorte(m).map((e) => `${e.rol}: ${e.texto}`)).toEqual([]);
  });

  it("EL CONTROL POSITIVO: el detector encuentra un elemento que se salio", () => {
    // Si esto no marcara, todos los casos de arriba estarian verdes por no saber
    // mirar. El caso malo se arma a mano: un texto que asoma por abajo.
    const bueno = maquetar(CORRIENTE, medir);
    const malo = {
      recorte: bueno.recorte,
      elementos: [
        ...bueno.elementos,
        { ...bueno.elementos[0], y: RECORTE.y + RECORTE.alto - 0.1, alto: 5 },
      ],
    };
    expect(fueraDelRecorte(malo)).toHaveLength(1);
  });
});

describe("ninguna regla tacha un texto (FR-013)", () => {
  // **Esta guarda nacio de un defecto de verdad, el 2026-09-19.** La regla del
  // encabezado caia en y=26.7 y la linea base de "LOGISTICA Y TRANSPORTE" en
  // 26.94: la linea tachaba el texto. Compilaba, las pruebas de geometria
  // estaban verdes —no se salia del recorte, no bajaba del piso— y se habria
  // visto recien en papel.
  //
  // El recuadro del codigo queda afuera de esta regla a proposito: contiene
  // texto por diseño, que es lo contrario de pisarlo.
  function tachados(m: Maqueta): string[] {
    const reglas = m.elementos.filter((e) => e.tipo === "regla");
    const cruces: string[] = [];
    for (const r of reglas) {
      for (const t of m.elementos) {
        if (t.tipo !== "texto") continue;
        const cruzaVertical = r.y > t.y && r.y < t.y + t.alto;
        const cruzaHorizontal = r.x < t.x + t.ancho && r.x + r.ancho > t.x;
        if (cruzaVertical && cruzaHorizontal) cruces.push(`${r.y.toFixed(1)} sobre "${t.texto}"`);
      }
    }
    return cruces;
  }

  it.each([
    ["un pedido corriente", CORRIENTE],
    ["el tope de contenido", EXTREMO],
    ["sin comentario", { ...CORRIENTE, comentario: undefined }],
    ["un comentario de veinte renglones", conComentario(CORRIENTE, renglones(20))],
  ])("ninguna linea cae encima de un texto: %s", (_caso, etiqueta) => {
    expect(tachados(maquetar(etiqueta as Etiqueta, medir))).toEqual([]);
  });

  it("EL CONTROL POSITIVO: el detector ve una regla encima de un texto", () => {
    const m = maquetar(CORRIENTE, medir);
    const texto = m.elementos.find((e) => e.rol === "marcaBajada")!;
    const malo: Maqueta = {
      ...m,
      elementos: [
        ...m.elementos,
        { ...texto, tipo: "regla", y: texto.y + texto.alto / 2, x: 20, ancho: 110 },
      ],
    };
    expect(tachados(malo)).toHaveLength(1);
  });
});

describe("la hoja no lleva nada mas (FR-002b)", () => {
  const m = maquetar(CORRIENTE, medir);

  it("las marcas de corte viven AFUERA del recorte", () => {
    // Estan afuera a proposito: son la guia de la tijera, no parte de la
    // etiqueta. Por eso se excluyen de la guarda de FR-003.
    expect(m.marcas).toHaveLength(8);
    for (const s of m.marcas) {
      const dentro = (x: number, y: number) =>
        x > RECORTE.x &&
        x < RECORTE.x + RECORTE.ancho &&
        y > RECORTE.y &&
        y < RECORTE.y + RECORTE.alto;
      expect(dentro(s.x1, s.y1)).toBe(false);
      expect(dentro(s.x2, s.y2)).toBe(false);
    }
  });

  it("las marcas quedan dentro del area imprimible de una A4 comun", () => {
    // El peor caso publicado de area no imprimible es 6.35 mm. Con 10 mm de
    // separacion al borde queda margen, y sin esto el corte se come un renglon
    // en la impresora de alguien.
    for (const s of m.marcas) {
      for (const [x, y] of [
        [s.x1, s.y1],
        [s.x2, s.y2],
      ]) {
        expect(x).toBeGreaterThanOrEqual(8);
        expect(y).toBeGreaterThanOrEqual(8);
        expect(x).toBeLessThanOrEqual(210 - 8);
        expect(y).toBeLessThanOrEqual(297 - 8);
      }
    }
  });

  it("no hay recuadro de corte: la etiqueta recortada no tiene marco", () => {
    // FR-002 eligio escuadras contra recuadro entero. Un recuadro seria un
    // elemento del tamaño exacto del recorte; no tiene que existir.
    const marco = m.elementos.find(
      (e) => e.tipo === "recuadro" && e.ancho >= RECORTE.ancho && e.alto >= RECORTE.alto,
    );
    expect(marco).toBeUndefined();
  });

  it("fuera del recorte no hay NADA salvo las marcas", () => {
    // Se evaluo imprimir "imprimir al 100 %, recortar por las marcas" y se
    // descarto el 2026-09-19: la hoja va limpia.
    expect(fueraDelRecorte(m)).toEqual([]);
  });
});

describe("el pedido de todos los dias no se achica (FR-005)", () => {
  it("un pedido corriente sale con los cuerpos corrientes, sin ajuste", () => {
    const m = maquetar(CORRIENTE, medir);
    expect(m.ajuste).toBe(0);
    expect(m.comentarioCortado).toBe(false);
  });

  it("el codigo sale a 34 pt, que es lo que se lee de lejos", () => {
    const m = maquetar(CORRIENTE, medir);
    const numero = m.elementos.find((e) => e.rol === "codigoNumero");
    expect(numero?.texto).toBe("FU-1234");
    expect(numero?.pt).toBe(34);
  });

  it("la entrega pesa mas que el retiro", () => {
    const m = maquetar(CORRIENTE, medir);
    const entrega = m.elementos.find((e) => e.rol === "entregaNombre");
    const retiro = m.elementos.find((e) => e.rol === "retiroNombre");
    expect(entrega!.pt!).toBeGreaterThan(retiro!.pt!);
  });
});

describe("los pisos de legibilidad (FR-007)", () => {
  it.each([
    ["un pedido corriente", CORRIENTE],
    ["el tope de contenido", EXTREMO],
    ["un comentario de veinte renglones", conComentario(CORRIENTE, renglones(20))],
  ])("ningun cuerpo baja de su piso: %s", (_caso, etiqueta) => {
    const m = maquetar(etiqueta as Etiqueta, medir);
    expect(bajoElPiso(m).map((e) => `${e.rol}: ${e.pt}`)).toEqual([]);
  });

  it("EL CONTROL POSITIVO: el detector encuentra un cuerpo por debajo del piso", () => {
    const bueno = maquetar(CORRIENTE, medir);
    const malo = {
      elementos: bueno.elementos.map((e) =>
        e.rol === "entregaNombre" ? { ...e, pt: PISO.entregaNombre - 0.5 } : e,
      ),
    };
    expect(bajoElPiso(malo)).toHaveLength(1);
  });

  it("cada bloque viaja hacia SU piso, no todos por el mismo factor", () => {
    // El analyze del 2026-09-19: un multiplicador global se frena en el rol mas
    // apretado y desperdicia el aire de los demas. Con la interpolacion por
    // bloque, al llegar a ajuste 1 **todos** estan exactamente en su piso.
    const m = maquetar(conComentario(CORRIENTE, renglones(30)), medir);
    expect(m.ajuste).toBe(1);
    const numero = m.elementos.find((e) => e.rol === "codigoNumero");
    const nombre = m.elementos.find((e) => e.rol === "entregaNombre");
    expect(numero?.pt).toBeCloseTo(PISO.codigoNumero, 6);
    expect(nombre?.pt).toBeCloseTo(PISO.entregaNombre, 6);
  });
});

describe("el caso extremo (FR-006, FR-008)", () => {
  it("el tope de contenido entra, achicado pero entero", () => {
    const m = maquetar(EXTREMO, medir);
    expect(fueraDelRecorte(m)).toEqual([]);
    expect(m.ajuste).toBeGreaterThan(0);
  });

  it("un comentario de 280 caracteres corridos NO se corta", () => {
    // El analyze lo midio antes de escribir una linea: llevar los bloques a sus
    // pisos libera ~9 mm y el comentario de 280 necesita ~0.9 mm mas de lo
    // presupuestado. Si esta prueba se pone roja, el achique no esta
    // recuperando lo que puede y FR-008 esta cortando de mas.
    const m = maquetar(EXTREMO, medir);
    expect(m.comentarioCortado).toBe(false);
  });

  it("cinco renglones puestos a mano todavia entran", () => {
    const m = maquetar(conComentario(CORRIENTE, renglones(5)), medir);
    expect(m.comentarioCortado).toBe(false);
    expect(fueraDelRecorte(m)).toEqual([]);
  });

  it("con muchos renglones se corta el comentario, y se ve que se corto", () => {
    const m = maquetar(conComentario(CORRIENTE, renglones(30)), medir);
    expect(m.comentarioCortado).toBe(true);
    const ultimo = textos(m, "comentario").at(-1);
    expect(ultimo).toMatch(/…$/);
  });

  it("solo se corta con TODO en su piso: nunca mientras quede aire", () => {
    const m = maquetar(conComentario(CORRIENTE, renglones(30)), medir);
    expect(m.ajuste).toBe(1);
    expect(bajoElPiso(m)).toEqual([]);
  });

  it("cuando se corta el comentario, las direcciones siguen ENTERAS", () => {
    // Lo que cede es el comentario y nada mas. Nunca una direccion, nunca un
    // telefono: es lo que el repartidor necesita para llegar a una puerta.
    const m = maquetar(conComentario(EXTREMO, renglones(40)), medir);
    expect(m.comentarioCortado).toBe(true);

    const entrega = textos(m, "entrega").join(" ");
    const retiro = textos(m, "retiro").join(" ");
    for (const trozo of ["Piñeyro", "Herrera", "099 123 456"]) {
      expect(entrega).toContain(trozo);
    }
    for (const trozo of ["Etcheverría", "Bolivia", "098 765 432"]) {
      expect(retiro).toContain(trozo);
    }
    expect(entrega).not.toMatch(/…/);
    expect(retiro).not.toMatch(/…/);
  });
});

describe("lo que la hoja muestra y lo que no", () => {
  it("sin comentario no dibuja ni el rotulo ni un hueco (FR-011)", () => {
    const m = maquetar({ ...CORRIENTE, comentario: undefined }, medir);
    expect(m.elementos.filter((e) => e.bloque === "comentario")).toEqual([]);
  });

  it("sin punto de entrega no dibuja el bloque de zona (FR-016)", () => {
    // Un pedido anterior a `011`. Ni hueco ni leyenda; y la zona NUNCA se deduce
    // de la direccion escrita.
    const m = maquetar(
      { ...CORRIENTE, entrega: { ...CORRIENTE.entrega, zona: undefined } },
      medir,
    );
    expect(m.elementos.find((e) => e.rol === "entregaZona")).toBeUndefined();
  });

  it("con punto de entrega dibuja la zona como NOMBRE, no como tarifa", () => {
    const m = maquetar(CORRIENTE, medir);
    const zona = m.elementos.find((e) => e.rol === "entregaZona");
    expect(zona?.texto).toBe("ZONA 5");
  });

  it("no existe la pagina dos (FR-004)", () => {
    // No se prueba con un caso porque **no se puede expresar**: la estructura no
    // tiene donde poner una segunda pagina. Se deja escrito para que la ausencia
    // sea deliberada y no un olvido.
    const m = maquetar(EXTREMO, medir);
    expect(Object.keys(m).sort()).toEqual(
      ["ajuste", "comentarioCortado", "elementos", "marcas", "recorte"].sort(),
    );
  });

  it("respeta los renglones que puso la persona a proposito", () => {
    const m = maquetar(conComentario(CORRIENTE, "Timbre 3\nDejar en porteria"), medir);
    const lineas = textos(m, "comentario");
    expect(lineas).toContain("Timbre 3");
    expect(lineas).toContain("Dejar en porteria");
  });
});

describe("las dos pantallas no divergen (FR-019)", () => {
  // `020` hizo converger la confirmacion y Mis pedidos en `Etiqueta`. Esto
  // comprueba que de ahi para adelante tampoco se bifurcan: un re-maquetado es
  // exactamente donde se bifurcarian.
  const PUNTO = { lat: -34.8349, lng: -55.9861 };

  const desdeFormulario = etiquetaDelFormulario({
    codigo: "FU-4321",
    nombre: "Carlos Antunez",
    telefono: "098 765 432",
    retiro: {
      calle: "Bulevar España",
      esquina: "Br. Artigas",
      numero: "2145",
      apto: "302",
      cooperativa: false,
      punto: null,
    },
    entrega: {
      calle: "Av. Giannattasio",
      esquina: "Calle 20",
      numero: "890",
      apto: "",
      cooperativa: true,
      punto: PUNTO,
    },
    destinatarioNombre: "Ana Pereira",
    destinatarioTelefono: "099 123 456",
    fechaRetiro: "2026-09-21",
    cantidad: "2",
    comentario: "Tocar timbre del 3.",
  });

  const desdeServicio = etiquetaDelPedido({
    codigo: "FU-4321",
    remitenteNombre: "Carlos Antunez",
    remitenteTelefono: "098 765 432",
    destinatarioNombre: "Ana Pereira",
    destinatarioTelefono: "099 123 456",
    retiro: {
      calle: "Bulevar España",
      esquina: "Br. Artigas",
      numero: "2145",
      apto: "302",
      cooperativa: false,
      punto: null,
    },
    entrega: {
      calle: "Av. Giannattasio",
      esquina: "Calle 20",
      numero: "890",
      apto: null,
      cooperativa: true,
      punto: PUNTO,
    },
    retiroFecha: "2026-09-21",
    cantidad: 2,
    comentario: "Tocar timbre del 3.",
  });

  it("el mismo pedido produce la MISMA maqueta por los dos caminos", () => {
    expect(maquetar(desdeFormulario, medir)).toEqual(maquetar(desdeServicio, medir));
  });

  it("EL CONTROL POSITIVO: la comparacion nota una diferencia real", () => {
    // Si `toEqual` sobre esta estructura no distinguiera dos hojas distintas, el
    // caso de arriba pasaria sin probar nada.
    const otra = maquetar({ ...desdeServicio, codigo: "FU-0000" }, medir);
    expect(maquetar(desdeFormulario, medir)).not.toEqual(otra);
  });
});
