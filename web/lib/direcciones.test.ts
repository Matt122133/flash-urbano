import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  acercarALaRegion,
  buscarCalle,
  buscarEsquina,
  buscarEsquinaDe,
  callePorNombre,
  canonizar,
  contiene,
  normalizar,
  prepararIndice,
  regionPermitida,
  type Indice,
  type IndiceCrudo,
} from "./direcciones";

// Estos tests estan aca por el mismo motivo que los de zona-lookup: de este
// modulo sale donde hay que ir a buscar un paquete, y de ahi el precio. Una
// esquina mal resuelta no se ve mirando la pantalla.
//
// El indice real se lee del archivo generado, no de un mock: lo que hay que
// verificar es el dato que se le sirve al cliente, no una imitacion comoda.

const indice: Indice = prepararIndice(
  JSON.parse(
    readFileSync(join(__dirname, "..", "public", "calles-mvd.json"), "utf8"),
  ) as IndiceCrudo,
);

const buscarUna = (texto: string) => {
  const r = buscarCalle(indice, texto);
  expect(r.length).toBeGreaterThan(0);
  return r;
};

describe("normalizacion de nombres", () => {
  it("saca tildes, baja a minusculas y colapsa espacios", () => {
    expect(normalizar("  Avenida   18 de Julio ")).toBe("avenida 18 de julio");
    expect(normalizar("Garzón")).toBe("garzon");
    expect(normalizar("Zapicán")).toBe("zapican");
  });

  it("el canonico saca el prefijo de tipo de via, y solo eso", () => {
    expect(canonizar("avenida 18 de julio")).toBe("18 de julio");
    expect(canonizar("bulevar general artigas")).toBe("general artigas");
    expect(canonizar("ejido")).toBe("ejido");
    // No es un prefijo de via: no se toca.
    expect(canonizar("avenidas unidas")).toBe("avenidas unidas");
  });
});

describe("buscarCalle", () => {
  it("no sugiere nada con menos de tres letras", () => {
    expect(buscarCalle(indice, "")).toEqual([]);
    expect(buscarCalle(indice, "18")).toEqual([]);
  });

  it("encuentra la misma calle escrita de distintas formas (FR-003)", () => {
    const nombres = (t: string) => buscarUna(t).map((c) => c.nombre);
    for (const variante of ["18 de julio", "18 de Julio", "Avenida 18 de Julio"]) {
      expect(nombres(variante)).toContain("Avenida 18 de Julio");
    }
  });

  it("encuentra con y sin tilde", () => {
    const con = buscarUna("Garzón").map((c) => c.nombre);
    const sin = buscarUna("Garzon").map((c) => c.nombre);
    expect(con).toEqual(sin);
  });

  it("prefiere la calle que empieza con lo tipeado", () => {
    const r = buscarUna("ejido");
    expect(normalizar(r[0].nombre).startsWith("ejido")).toBe(true);
  });

  it("no devuelve una lista interminable", () => {
    expect(buscarCalle(indice, "cal").length).toBeLessThanOrEqual(8);
  });

  it("nunca ofrece tramos rotulados con la clasificacion vial (FR-004)", () => {
    // La comparacion es exacta a proposito: "Sendero Vehicular 1" es el nombre
    // propio de una calle y tiene que quedar; lo que se descarta es el tramo
    // rotulado literalmente "Vehicular/ Peatonal", que no nombra nada.
    const etiquetas = new Set([
      "vehicular/ peatonal",
      "vehicular / peatonal",
      "vehicular",
      "peatonal",
      "camino vecinal",
      "sin nombre",
    ]);
    for (const calle of indice.calles) {
      expect(etiquetas.has(calle.busqueda)).toBe(false);
    }
  });
});

describe("buscarEsquinaDe", () => {
  const calle = () => {
    const c = callePorNombre(indice, "Avenida 18 de Julio");
    expect(c).not.toBeNull();
    return c!;
  };

  it("solo ofrece calles con las que existe una esquina (FR-009)", () => {
    const cruzadas = buscarEsquinaDe(indice, calle(), "");
    expect(cruzadas.length).toBeGreaterThan(0);
    for (const otra of cruzadas) {
      expect(buscarEsquina(indice, calle(), otra).length).toBeGreaterThan(0);
    }
  });

  it("nunca se ofrece a si misma", () => {
    for (const otra of buscarEsquinaDe(indice, calle(), "")) {
      expect(otra.id).not.toBe(calle().id);
    }
  });

  it("no ofrece una calle que no la cruza", () => {
    // Ciudad de la Costa no cruza 18 de Julio, esten donde esten.
    const lejana = buscarEsquinaDe(indice, calle(), "giannattasio");
    expect(lejana).toEqual([]);
  });
});

describe("buscarEsquina", () => {
  // Coordenadas de referencia: ver el bloque de fixture mas abajo. Estas dos se
  // usan aca solo para comprobar la forma de la respuesta, no la precision.
  it("un par que no se cruza devuelve lista vacia, no un error", () => {
    const a = callePorNombre(indice, "Avenida 18 de Julio")!;
    const b = buscarUna("giannattasio")[0];
    expect(buscarEsquina(indice, a, b)).toEqual([]);
  });

  it("devuelve siempre una lista, aun cuando hay una sola esquina (FR-021)", () => {
    const a = callePorNombre(indice, "Avenida 18 de Julio")!;
    const b = callePorNombre(indice, "Ejido")!;
    const r = buscarEsquina(indice, a, b);
    expect(Array.isArray(r)).toBe(true);
    expect(r.length).toBe(1);
  });

  it("las calzadas dobles no producen la misma esquina cuatro veces (FR-005)", () => {
    const a = callePorNombre(indice, "Avenida Italia")!;
    const b = callePorNombre(indice, "Bulevar General Artigas")!;
    expect(buscarEsquina(indice, a, b).length).toBe(1);
  });

  it("el colapso de 60 m no fusiona dos esquinas consecutivas de la misma calle", () => {
    // 18 de Julio con Ejido y con Yaguaron son cuadras contiguas del Centro.
    // Si el colapso las hubiera juntado, una de las dos no existiria.
    const ejido = callePorNombre(indice, "Ejido")!;
    const yaguaron = callePorNombre(indice, "Yaguarón")!;
    const julio = callePorNombre(indice, "Avenida 18 de Julio")!;
    const conEjido = buscarEsquina(indice, julio, ejido);
    const conYaguaron = buscarEsquina(indice, julio, yaguaron);
    expect(conEjido.length).toBe(1);
    expect(conYaguaron.length).toBe(1);
    expect(conEjido[0].punto.lng).not.toBeCloseTo(conYaguaron[0].punto.lng, 4);
  });
});

describe("region permitida y clampeo", () => {
  // Region sintetica: una cuadra recta de unos 200 m sobre el meridiano, para
  // que las cuentas sean verificables a mano y no dependan del dato.
  const esquinaFalsa = {
    calleA: indice.calles[0],
    calleB: indice.calles[1],
    punto: { lat: -34.9, lng: -56.18 },
    antesA: { lat: -34.9009, lng: -56.18 },
    despuesA: { lat: -34.8991, lng: -56.18 },
    antesB: { lat: -34.9, lng: -56.181 },
    despuesB: { lat: -34.9, lng: -56.179 },
  };

  it("un punto sobre la cuadra esta adentro", () => {
    const region = regionPermitida(esquinaFalsa, "A");
    expect(contiene(region, { lat: -34.9004, lng: -56.18 })).toBe(true);
  });

  it("un punto a menos del margen lateral esta adentro", () => {
    const region = regionPermitida(esquinaFalsa, "A");
    // ~30 m al costado.
    expect(contiene(region, { lat: -34.9, lng: -56.17967 })).toBe(true);
  });

  it("un punto lejos queda afuera", () => {
    const region = regionPermitida(esquinaFalsa, "A");
    expect(contiene(region, { lat: -34.9, lng: -56.17 })).toBe(false);
  });

  it("un punto de adentro no se mueve al clampear", () => {
    const region = regionPermitida(esquinaFalsa, "A");
    const p = { lat: -34.9004, lng: -56.18 };
    expect(acercarALaRegion(region, p)).toEqual(p);
  });

  it("un punto de afuera vuelve al borde, y el borde esta adentro (FR-015)", () => {
    const region = regionPermitida(esquinaFalsa, "A");
    const afuera = { lat: -34.9, lng: -56.17 };
    const clampeado = acercarALaRegion(region, afuera);
    expect(clampeado).not.toEqual(afuera);
    expect(contiene(region, clampeado)).toBe(true);
  });

  it("el clampeo no pega el punto al eje de la calle", () => {
    const region = regionPermitida(esquinaFalsa, "A");
    const clampeado = acercarALaRegion(region, { lat: -34.9, lng: -56.17 });
    // Si se hubiera proyectado sobre el eje, la longitud seria exactamente la
    // del eje. Tiene que quedar al costado, a la distancia del margen.
    expect(clampeado.lng).not.toBeCloseTo(-56.18, 5);
  });

  it("una esquina sin contiguas degenera en un disco usable, no en un punto", () => {
    const sinCuadra = {
      ...esquinaFalsa,
      antesA: esquinaFalsa.punto,
      despuesA: esquinaFalsa.punto,
    };
    const region = regionPermitida(sinCuadra, "A");
    expect(contiene(region, { lat: -34.9, lng: -56.17967 })).toBe(true);
    expect(contiene(region, { lat: -34.9, lng: -56.17 })).toBe(false);
  });

  it("la region se toma sobre la calle declarada, no sobre la esquina", () => {
    const sobreA = regionPermitida(esquinaFalsa, "A");
    const sobreB = regionPermitida(esquinaFalsa, "B");
    // Un punto a lo largo de B no puede estar en la region de A.
    const alEsteDeB = { lat: -34.9, lng: -56.1792 };
    expect(contiene(sobreB, alEsteDeB)).toBe(true);
    expect(contiene(sobreA, alEsteDeB)).toBe(false);
  });
});
