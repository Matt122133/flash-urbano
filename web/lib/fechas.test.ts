import { describe, expect, it } from "vitest";
import { MARGEN_MINIMO_MINUTOS, hoy, problemaDeFechas } from "./fechas";

// El "hoy" entra por parametro en todos los casos: un test que dependa del
// reloj de la maquina pasa hoy y falla el mes que viene.
const HOY = "2026-08-04";

const caso = (
  fechaRetiro: string,
  horaRetiro: string,
  fechaEntrega: string,
  horaEntrega: string,
) =>
  problemaDeFechas(
    { fechaRetiro, horaRetiro, fechaEntrega, horaEntrega },
    HOY,
  );

describe("problemaDeFechas", () => {
  it("acepta la entrega despues del retiro, otro dia", () => {
    expect(caso("2026-08-05", "10:00", "2026-08-06", "09:00")).toBeNull();
  });

  it("acepta el mismo dia con margen de sobra", () => {
    expect(caso("2026-08-05", "10:00", "2026-08-05", "16:30")).toBeNull();
  });

  it("rechaza el mismo dia con la entrega mas temprano", () => {
    expect(caso("2026-08-05", "16:30", "2026-08-05", "10:00")).toBe(
      "entrega-antes-del-retiro",
    );
  });

  it("rechaza la entrega en un dia anterior aunque la hora sea mayor", () => {
    // El bug clasico de comparar solo la hora.
    expect(caso("2026-08-10", "08:00", "2026-08-09", "23:00")).toBe(
      "entrega-antes-del-retiro",
    );
  });

  it("rechaza el mismo instante exacto", () => {
    expect(caso("2026-08-05", "10:00", "2026-08-05", "10:00")).toBe(
      "margen-insuficiente",
    );
  });

  it("rechaza un minuto de diferencia: no es un envio", () => {
    expect(caso("2026-08-05", "10:00", "2026-08-05", "10:01")).toBe(
      "margen-insuficiente",
    );
  });

  it("rechaza justo por debajo del margen minimo", () => {
    expect(caso("2026-08-05", "10:00", "2026-08-05", "11:59")).toBe(
      "margen-insuficiente",
    );
  });

  it("acepta exactamente el margen minimo", () => {
    expect(caso("2026-08-05", "10:00", "2026-08-05", "12:00")).toBeNull();
    expect(MARGEN_MINIMO_MINUTOS).toBe(120);
  });

  it("el margen cuenta aunque se cruce la medianoche", () => {
    // 23:00 a 00:30 del dia siguiente son 90 minutos: no alcanza.
    expect(caso("2026-08-05", "23:00", "2026-08-06", "00:30")).toBe(
      "margen-insuficiente",
    );
    expect(caso("2026-08-05", "23:00", "2026-08-06", "01:00")).toBeNull();
  });

  it("rechaza el retiro en un dia que ya paso", () => {
    expect(caso("2026-08-03", "10:00", "2026-08-06", "10:00")).toBe(
      "retiro-en-el-pasado",
    );
  });

  it("acepta el retiro hoy mismo", () => {
    expect(caso(HOY, "10:00", HOY, "18:00")).toBeNull();
  });

  it("el margen tambien vale cruzando fin de mes", () => {
    expect(caso("2026-08-31", "23:30", "2026-09-01", "00:30")).toBe(
      "margen-insuficiente",
    );
  });

  it("cruza fin de mes sin confundirse", () => {
    expect(caso("2026-08-31", "20:00", "2026-09-01", "09:00")).toBeNull();
    expect(caso("2026-09-01", "09:00", "2026-08-31", "20:00")).toBe(
      "entrega-antes-del-retiro",
    );
  });

  it("no opina si faltan las fechas", () => {
    expect(caso("", "", "", "")).toBeNull();
    expect(caso("2026-08-05", "10:00", "", "")).toBeNull();
  });

  it("con fechas pero sin horas compara solo los dias", () => {
    expect(caso("2026-08-05", "", "2026-08-06", "")).toBeNull();
    expect(caso("2026-08-06", "", "2026-08-05", "")).toBe(
      "entrega-antes-del-retiro",
    );
    // Mismo dia sin horas no alcanza para afirmar que esta mal.
    expect(caso("2026-08-05", "", "2026-08-05", "")).toBeNull();
  });
});

describe("hoy", () => {
  it("formatea como lo espera un input de tipo date", () => {
    expect(hoy(new Date(2026, 7, 4))).toBe("2026-08-04");
    // Con un dígito, que es donde se rompe si falta el relleno con cero.
    expect(hoy(new Date(2026, 0, 9))).toBe("2026-01-09");
  });
});
