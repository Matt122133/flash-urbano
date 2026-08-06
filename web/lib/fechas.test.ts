import { describe, expect, it } from "vitest";
import { hoy, retiroEnElPasado } from "./fechas";

// El "hoy" entra por parametro en todos los casos: un test que dependa del
// reloj de la maquina pasa hoy y falla el mes que viene.
const HOY = "2026-08-04";

// Esta suite tenia diecisiete casos. Trece se borraron en `004` —margen minimo
// entre retiro y entrega, orden entre los dos, mismo instante, cruce de
// medianoche— porque su sujeto dejo de existir: ya no hay fecha de entrega que
// comparar. No se apagaron con `it.skip`, se borraron. Un test apagado es uno
// que alguien va a intentar revivir en seis meses sin saber por que estaba
// apagado.

describe("retiroEnElPasado", () => {
  it("rechaza un dia que ya paso", () => {
    expect(retiroEnElPasado("2026-08-03", HOY)).toBe(true);
  });

  it("acepta hoy mismo", () => {
    expect(retiroEnElPasado(HOY, HOY)).toBe(false);
  });

  it("acepta un dia futuro", () => {
    expect(retiroEnElPasado("2026-08-05", HOY)).toBe(false);
  });

  it("no opina si falta la fecha", () => {
    // Que el campo este completo lo valida el formulario aparte.
    expect(retiroEnElPasado("", HOY)).toBe(false);
  });

  it("cruza fin de mes sin confundirse", () => {
    // El 31 de agosto es pasado respecto del 1 de septiembre, aunque 31 > 01.
    expect(retiroEnElPasado("2026-08-31", "2026-09-01")).toBe(true);
    expect(retiroEnElPasado("2026-09-01", "2026-08-31")).toBe(false);
  });

  it("cruza fin de anio sin confundirse", () => {
    expect(retiroEnElPasado("2026-12-31", "2027-01-01")).toBe(true);
    expect(retiroEnElPasado("2027-01-01", "2026-12-31")).toBe(false);
  });

  it("compara por dia y no por instante", () => {
    // Deliberado: retirar "hoy" siempre vale, sin importar la hora que sea.
    // Rechazarlo por minutos molestaria mas de lo que ayuda.
    expect(retiroEnElPasado("2026-08-04", "2026-08-04")).toBe(false);
  });

  it("usa el dia de hoy real cuando no se le pasa uno", () => {
    // Que el parametro por defecto este enchufado a hoy(), no a una constante.
    expect(retiroEnElPasado("1999-01-01")).toBe(true);
    expect(retiroEnElPasado("2999-01-01")).toBe(false);
  });
});

describe("hoy", () => {
  it("formatea como lo espera un input de tipo date", () => {
    expect(hoy(new Date(2026, 7, 4))).toBe("2026-08-04");
    // Con un dígito, que es donde se rompe si falta el relleno con cero.
    expect(hoy(new Date(2026, 0, 9))).toBe("2026-01-09");
  });

  it("rellena con cero tambien el dia, no solo el mes", () => {
    // El relleno del dia es lo que hace valida la comparacion de strings de
    // retiroEnElPasado: sin el, "2026-08-9" > "2026-08-10".
    expect(hoy(new Date(2026, 10, 3))).toBe("2026-11-03");
  });
});
