import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { sinComentarios } from "./sin-comentarios";
import * as tablero from "./tablero";
import { fechaEnMontevideo, periodoDe, registrados, resumir, type Carga } from "./tablero";

// **El proceso de esta prueba cree estar en Tokio (UTC+9), a proposito.**
//
// La maquina donde corre `verify:` esta en Montevideo. Una implementacion rota
// que usara la zona del proceso —`getDate()` en vez de `Intl` con la zona
// escrita— daria ahi la respuesta correcta de pura casualidad, y la prueba de
// SC-006 pasaria sin proteger nada (analyze T1 de `025`). En Tokio, esa misma
// implementacion rota se equivoca, y la prueba se pone en rojo.
//
// Node aplica un cambio de `TZ` en caliente, y Vitest 4 corre cada archivo en su
// propio proceso. Se restaura al terminar por si el proceso se reusa. **Que el
// cambio tomo efecto lo afirma una prueba de abajo**: si la herramienta dejara de
// respetarlo, esa falla en voz alta en vez de dejar pasar SC-006 por casualidad.
const TZ_ORIGINAL = process.env.TZ;
process.env.TZ = "Asia/Tokyo";
afterAll(() => {
  if (TZ_ORIGINAL === undefined) delete process.env.TZ;
  else process.env.TZ = TZ_ORIGINAL;
});

// El tablero de Diego (`025`). Las invariantes de
// specs/025-dashboard-de-diego/data-model.md, mas las dos guardas que viven en
// `lib/`: la palabra prohibida en el copy (FR-004a) y la plata en el calculo
// (FR-014).

const AQUI = dirname(fileURLToPath(import.meta.url));

/** Una carga de ejemplo. Cada prueba cambia solo lo que le importa. */
function carga(creadoEn: string, cantidad = 1, clienteId = "ana"): Carga {
  return { creadoEn, cantidad, clienteId };
}

// ---------------------------------------------------------------------------
// FR-004a: el rotulo no promete que el numero no puede bajar
// ---------------------------------------------------------------------------

const HISTORICO = /hist[oó]ric/i;

/**
 * Todos los textos que exporta el modulo, recorridos y no listados a mano: una
 * lista escrita aca se desactualiza el dia que alguien agrega un texto nuevo,
 * que es justo el texto que no se revisa.
 */
function textosExportados(): [string, string][] {
  return Object.entries(tablero).filter(
    (entrada): entrada is [string, string] => typeof entrada[1] === "string",
  );
}

describe("ningún texto del tablero dice «histórico» (FR-004a)", () => {
  it("hay textos que mirar", () => {
    // Contra el falso verde: si los textos dejaran de exportarse, el caso de
    // abajo no miraria nada.
    expect(textosExportados().map(([nombre]) => nombre)).toContain("TEXTO_TOTAL");
  });

  it.each(textosExportados())("%s", (_nombre, texto) => {
    expect(texto).not.toMatch(HISTORICO);
  });

  it("el detector ve la palabra cuando está (control positivo)", () => {
    expect("Pedidos históricos").toMatch(HISTORICO);
    expect("TOTAL HISTORICO").toMatch(HISTORICO);
  });

  it("la bajada del total dice que el número puede bajar", () => {
    // La mitad de FR-004 que vive en la pantalla: sin esto, un pedido dado de
    // baja hace bajar el total y la pantalla parece rota (SC-002b).
    expect(tablero.BAJADA_TOTAL).toMatch(/baja/i);
  });
});

// ---------------------------------------------------------------------------
// FR-014 en `lib/`: el calculo no nombra la plata
//
// La guarda de `013` (`sin-precio-a-la-vista.test.ts`) no mira `lib/`, porque
// ahi el dato tiene que seguir existiendo. Pero un total facturado sumado en
// este modulo llegaria a la pantalla del tablero sin que esa guarda lo vea: el
// componente solo llamaria a una funcion con otro nombre.
// ---------------------------------------------------------------------------

const PLATA = [/precio/i, /monto/i, /importe/i, /costo/i, /\$\s*\d/];

function nombraPlata(fuente: string): boolean {
  const limpio = sinComentarios(fuente);
  return PLATA.some((patron) => patron.test(limpio));
}

describe("lib/tablero.ts no nombra la plata de un pedido (FR-014)", () => {
  it("el fuente del módulo está limpio", () => {
    const fuente = readFileSync(join(AQUI, "tablero.ts"), "utf8");
    expect(fuente.length).toBeGreaterThan(0);
    expect(nombraPlata(fuente)).toBe(false);
  });

  it("el detector ve un campo de plata (control positivo)", () => {
    expect(nombraPlata("const x = zona.precio;")).toBe(true);
    expect(nombraPlata('const t = "Sale $ 250";')).toBe(true);
  });

  it("el detector no cuenta un comentario (control positivo)", () => {
    expect(nombraPlata("// el precio no se lee\nconst x = 1;")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// El total
// ---------------------------------------------------------------------------

describe("registrados", () => {
  it("sin cargas es cero", () => {
    expect(registrados([])).toBe(0);
  });

  it("cuenta pedidos, no paquetes", () => {
    // Un pedido de tres paquetes es UN pedido registrado. Los paquetes son la
    // otra columna del corte, no el total.
    expect(registrados([carga("2026-09-10T12:00:00Z", 3)])).toBe(1);
    expect(
      registrados([carga("2026-09-10T12:00:00Z", 3), carga("2026-09-11T12:00:00Z", 1)]),
    ).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// La zona horaria (SC-006, FR-007)
// ---------------------------------------------------------------------------

describe("el día empieza en Montevideo (SC-006)", () => {
  // 22:30 del 10 en Montevideo; 01:30 del 11 en UTC; 10:30 del 11 en Tokio.
  const LAS_22_30 = "2026-09-11T01:30:00Z";

  it("el proceso de esta prueba está de verdad en otra zona (control positivo)", () => {
    // Si esto falla, el `process.env.TZ` de arriba no tomó efecto y la prueba
    // de abajo estaría midiendo la zona de la máquina, no el código.
    expect(new Date(LAS_22_30).getDate()).toBe(11);
  });

  it("un pedido de las 22:30 de Montevideo cuenta ese día, no el siguiente", () => {
    expect(fechaEnMontevideo(LAS_22_30)).toBe("2026-09-10");
  });

  it("la medianoche de Montevideo ya es el día nuevo", () => {
    expect(fechaEnMontevideo("2026-09-11T03:00:00Z")).toBe("2026-09-11");
    expect(fechaEnMontevideo("2026-09-11T02:59:59Z")).toBe("2026-09-10");
  });
});

// ---------------------------------------------------------------------------
// Los períodos (research D4)
// ---------------------------------------------------------------------------

describe("periodoDe", () => {
  it("día: la fecha, con su nombre", () => {
    expect(periodoDe("2026-09-10", "dia")).toEqual({ clave: "2026-09-10", rotulo: "jue 10 sep 2026" });
  });

  it("semana: empieza el lunes y nombra los dos extremos", () => {
    expect(periodoDe("2026-09-10", "semana")).toEqual({
      clave: "2026-09-07",
      rotulo: "lun 7 sep – dom 13 sep 2026",
    });
  });

  it("un domingo es de la semana del lunes anterior, no de la siguiente", () => {
    expect(periodoDe("2026-09-13", "semana").clave).toBe("2026-09-07");
    expect(periodoDe("2026-09-14", "semana").clave).toBe("2026-09-14");
  });

  it("una semana que cruza de año lleva los dos años", () => {
    expect(periodoDe("2026-01-01", "semana")).toEqual({
      clave: "2025-12-29",
      rotulo: "lun 29 dic 2025 – dom 4 ene 2026",
    });
  });

  it("mes: el nombre entero y el año", () => {
    expect(periodoDe("2026-09-10", "mes")).toEqual({ clave: "2026-09", rotulo: "septiembre 2026" });
  });
});

// ---------------------------------------------------------------------------
// El resumen (data-model.md, invariantes 1 a 5, 7 y 8)
// ---------------------------------------------------------------------------

/** Cargas repartidas en tres meses, con un mes vacío en el medio. */
const CARGAS: Carga[] = [
  carga("2026-07-15T15:00:00Z", 2),
  carga("2026-09-01T15:00:00Z", 3),
  carga("2026-09-01T16:00:00Z", 1),
  carga("2026-09-11T01:30:00Z", 1), // 22:30 del 10 en Montevideo
];
const HOY = "2026-09-11";

describe("resumir", () => {
  it.each(["dia", "semana", "mes"] as const)(
    "en el corte por %s, las filas suman el total",
    (corte) => {
      const { registrados: total, filas } = resumir(CARGAS, { corte, hoy: HOY });
      expect(total).toBe(4);
      expect(filas.reduce((suma, f) => suma + f.pedidos, 0)).toBe(total);
      expect(filas.reduce((suma, f) => suma + f.paquetes, 0)).toBe(7);
    },
  );

  it("paquetes no es pedidos: un período con uno de 3 y uno de 1 da 2 y 4 (SC-002a)", () => {
    const { filas } = resumir(CARGAS, { corte: "dia", hoy: HOY });
    const primeroDeSetiembre = filas.find((f) => f.periodo.clave === "2026-09-01")!;
    expect(primeroDeSetiembre).toMatchObject({ pedidos: 2, paquetes: 4 });
  });

  it("del más nuevo al más viejo, con el período de hoy primero", () => {
    const { filas } = resumir(CARGAS, { corte: "mes", hoy: HOY });
    expect(filas.map((f) => f.periodo.clave)).toEqual(["2026-09", "2026-08", "2026-07"]);
  });

  it("un mes sin pedidos entre dos con pedidos aparece en cero", () => {
    const { filas } = resumir(CARGAS, { corte: "mes", hoy: HOY });
    expect(filas.find((f) => f.periodo.clave === "2026-08")).toMatchObject({ pedidos: 0, paquetes: 0 });
  });

  it("sin huecos en el corte por día: un período por día, del primero a hoy", () => {
    const { filas } = resumir(CARGAS, { corte: "dia", hoy: HOY });
    // Del 15 de julio al 11 de setiembre inclusive: 17 + 31 + 11 días.
    expect(filas).toHaveLength(59);
    expect(new Set(filas.map((f) => f.periodo.clave)).size).toBe(59);
    expect(filas[0].periodo.clave).toBe(HOY);
    expect(filas.at(-1)!.periodo.clave).toBe("2026-07-15");
  });

  it("el pedido de las 22:30 cae el 10 y el 11 queda en cero", () => {
    const { filas } = resumir(CARGAS, { corte: "dia", hoy: HOY });
    expect(filas.find((f) => f.periodo.clave === "2026-09-10")).toMatchObject({ pedidos: 1 });
    expect(filas.find((f) => f.periodo.clave === "2026-09-11")).toMatchObject({ pedidos: 0 });
  });

  it("sin ningún pedido: una sola fila, la de hoy, en cero (FR-015)", () => {
    const { registrados: total, filas } = resumir([], { corte: "semana", hoy: HOY });
    expect(total).toBe(0);
    expect(filas).toEqual([
      { periodo: periodoDe(HOY, "semana"), pedidos: 0, paquetes: 0 },
    ]);
  });

  it("no mira el reloj: el mismo día de hoy da el mismo resultado", () => {
    expect(resumir(CARGAS, { corte: "mes", hoy: HOY })).toEqual(
      resumir(CARGAS, { corte: "mes", hoy: HOY }),
    );
  });

  it("la aclaración del corte dice que es por fecha de carga (FR-006a)", () => {
    expect(tablero.TEXTO_CORTE).toMatch(/carg/i);
  });
});

// ---------------------------------------------------------------------------
// El filtro por cliente (US3, data-model.md invariante 6)
// ---------------------------------------------------------------------------

describe("resumir con un cliente elegido", () => {
  const MEZCLA: Carga[] = [
    carga("2026-07-15T15:00:00Z", 2, "ana"),
    carga("2026-09-01T15:00:00Z", 3, "beto"),
    carga("2026-09-05T15:00:00Z", 1, "ana"),
  ];

  it("solo cuentan los pedidos de esa cuenta", () => {
    const { registrados: total, filas } = resumir(MEZCLA, { corte: "mes", hoy: HOY, clienteId: "ana" });
    expect(total).toBe(2);
    expect(filas.find((f) => f.periodo.clave === "2026-09")).toMatchObject({ pedidos: 1, paquetes: 1 });
    expect(filas.reduce((suma, f) => suma + f.pedidos, 0)).toBe(total);
  });

  it("sin cliente, el total es mayor: el filtro de verdad filtra (control positivo)", () => {
    // Si `clienteId` se ignorara, el caso de arriba podría pasar igual con otro
    // juego de datos. Este lo ata: con y sin filtro NO dan lo mismo.
    const conFiltro = resumir(MEZCLA, { corte: "mes", hoy: HOY, clienteId: "ana" });
    const sinFiltro = resumir(MEZCLA, { corte: "mes", hoy: HOY });
    expect(sinFiltro.registrados).toBe(3);
    expect(sinFiltro.registrados).toBeGreaterThan(conFiltro.registrados);
  });

  it("el rango de períodos es el mismo con y sin filtro (D5)", () => {
    // Beto no tiene pedidos en julio; la fila de julio tiene que seguir ahí.
    const claves = (clienteId?: string) =>
      resumir(MEZCLA, { corte: "mes", hoy: HOY, clienteId }).filas.map((f) => f.periodo.clave);
    expect(claves("beto")).toEqual(claves());
  });

  it("un cliente sin pedidos da cero y todas las filas en cero (FR-011)", () => {
    const { registrados: total, filas } = resumir(MEZCLA, { corte: "mes", hoy: HOY, clienteId: "nadie" });
    expect(total).toBe(0);
    expect(filas.length).toBeGreaterThan(0);
    expect(filas.every((f) => f.pedidos === 0 && f.paquetes === 0)).toBe(true);
  });
});

describe("rotuloCliente", () => {
  it("dos clientes con el mismo nombre se distinguen por el mail (US3-4)", () => {
    const uno = tablero.rotuloCliente({ id: "1", nombre: "Ana Pérez", email: "ana@example.com" });
    const otro = tablero.rotuloCliente({ id: "2", nombre: "Ana Pérez", email: "ana.perez@example.com" });
    expect(uno).not.toBe(otro);
    expect(uno).toBe("Ana Pérez — ana@example.com");
  });

  it("sin nombre, solo el mail", () => {
    expect(tablero.rotuloCliente({ id: "3", nombre: null, email: "a.medias@example.com" })).toBe(
      "a.medias@example.com",
    );
  });
});
