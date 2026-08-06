import { describe, expect, it } from "vitest";
import { ZONAS, type Zona, type ZonaId } from "./zonas";
import { resolverZona, resolverZonaEntre } from "./zona-lookup";

// Estos tests estan aca por un motivo concreto: esta funcion decide cuanto se le
// cobra a una persona. Un borde mal resuelto no se ve mirando la pantalla, se ve
// en la factura.
//
// Los puntos interiores se verificaron contra los poligonos generados antes de
// escribirlos; no son estimaciones a ojo.

describe("resolverZona", () => {
  const interiores: [string, number, number, number][] = [
    ["Zona 1 — La Blanqueada", -34.872, -56.16, 1],
    ["Zona 2 — Colon", -34.801, -56.205, 2],
    ["Zona 3 — Paso de la Arena", -34.833, -56.32, 3],
    ["Zona 4 — Punta de Rieles", -34.828, -56.06, 4],
    ["Zona 5 — Ciudad de la Costa", -34.8349, -55.9861, 5],
  ];

  it.each(interiores)("%s cae en la zona esperada", (_n, lat, lng, id) => {
    const zona = resolverZona(lat, lng);
    expect(zona).not.toBeNull();
    expect(zona?.id).toBe(id);
    expect(zona?.precio).toBe(ZONAS.find((z) => z.id === id)?.precio);
  });

  it("un punto en el Rio de la Plata queda fuera de cobertura", () => {
    expect(resolverZona(-34.96, -56.18)).toBeNull();
  });

  it("un punto en otro departamento queda fuera de cobertura", () => {
    // Colonia del Sacramento.
    expect(resolverZona(-34.47, -57.84)).toBeNull();
  });

  it("nunca devuelve la zona mas cercana: fuera es null, no un precio", () => {
    // Justo al este del limite de Zona 5, todavia dentro del bounding box
    // general. Si algun dia alguien mete un fallback "la mas cercana", esto lo
    // agarra: la respuesta correcta es que no hay cobertura (FR-023).
    expect(resolverZona(-34.83, -55.7)).toBeNull();
  });
});

// FR-020, FR-021, FR-022. Sobre un borde compartido hay dos zonas que reclaman
// el punto, y cual cobra lo contesto el cliente el 2026-08-06: la mas barata.
//
// Contra las cinco zonas reales esta regla NO se puede verificar, y esa es
// justamente la razon de ser de este bloque: `ZONAS` viene ordenada por id y sus
// precios resultan crecientes (150, 200, 250, 250, 350), asi que "la primera que
// contenga" y "la mas barata que contenga" dan el mismo resultado. Cualquiera de
// las dos implementaciones pasaria. Por eso los casos de abajo corren contra
// poligonos sinteticos, con el caro deliberadamente primero en la lista.
describe("resolverZonaEntre — la mas barata gana", () => {
  const cuadrado = (
    id: ZonaId,
    precio: number,
    [latMin, latMax]: [number, number],
    [lngMin, lngMax]: [number, number],
  ): Zona => ({
    id,
    nombre: `Sintetica ${id}`,
    precio,
    color: "#000000",
    anillo: [
      [latMin, lngMin],
      [latMin, lngMax],
      [latMax, lngMax],
      [latMax, lngMin],
      [latMin, lngMin],
    ],
  });

  // Dos cuadrados que se pisan entre lat -34.85..-34.80 y lng -56.25..-56.20.
  const caro = cuadrado(2, 350, [-34.9, -34.8], [-56.3, -56.2]);
  const barato = cuadrado(5, 150, [-34.85, -34.75], [-56.25, -56.15]);
  // Adentro de los dos.
  const LAT = -34.83;
  const LNG = -56.22;

  it("con el caro primero en la lista, igual gana el barato", () => {
    // El caso que importa. Si esto pasa con la implementacion vieja ("la primera
    // que contenga"), esta mal escrito.
    expect(resolverZonaEntre([caro, barato], LAT, LNG)?.id).toBe(5);
    expect(resolverZonaEntre([caro, barato], LAT, LNG)?.precio).toBe(150);
  });

  it("el resultado no depende del orden de la lista", () => {
    expect(resolverZonaEntre([barato, caro], LAT, LNG)?.id).toBe(5);
  });

  it("con precios empatados gana el id mas bajo, y es estable", () => {
    const alto = cuadrado(4, 250, [-34.9, -34.8], [-56.3, -56.2]);
    const bajo = cuadrado(3, 250, [-34.85, -34.75], [-56.25, -56.15]);
    // El de id mayor va primero: si ganara por posicion, daria 4.
    for (let i = 0; i < 20; i++) {
      expect(resolverZonaEntre([alto, bajo], LAT, LNG)?.id).toBe(3);
    }
  });

  it("con una sola zona que contiene el punto, devuelve esa aunque sea la cara", () => {
    // Fuera del cuadrado barato, adentro del caro.
    expect(resolverZonaEntre([caro, barato], -34.88, -56.28)?.id).toBe(2);
  });

  it("sin ninguna zona que contenga el punto, devuelve null", () => {
    expect(resolverZonaEntre([caro, barato], -34.5, -56.0)).toBeNull();
  });

  it("con la lista vacia devuelve null y no explota", () => {
    expect(resolverZonaEntre([], LAT, LNG)).toBeNull();
  });
});

describe("resolverZona sobre un borde real", () => {
  // Un vertice que reclaman de verdad dos zonas reales (1 y 2). Se encontro
  // barriendo los anillos y una grilla de ~50 m sobre toda el area de servicio:
  // de 551.601 puntos, solo 16 tienen dos reclamantes, mas 10 vertices y 26
  // puntos medios de lado. El ray casting usa desigualdad estricta y eso manda
  // casi todo el borde a una sola zona, asi que el punto NO se puede elegir a
  // ojo — el que estaba antes aca lo reclamaba una sola zona, y el test decia
  // estar probando un borde compartido sin estarlo.
  //
  // El valor esperado no se escribe a mano: se deriva de ZONAS, para que el test
  // siga siendo correcto si el cliente repricea una zona. Lo que se afirma es la
  // REGLA, no el numero.
  const LAT = -34.838349;
  const LNG = -56.1386762;

  const reclaman = ZONAS.filter(
    (z) => resolverZonaEntre([z], LAT, LNG) !== null,
  );

  it("el punto elegido es realmente un borde compartido", () => {
    // Si esto falla, el test de abajo dejo de probar lo que dice probar y hay
    // que buscar otro punto — no relajar la afirmacion.
    expect(reclaman.length).toBeGreaterThan(1);
  });

  it("paga la mas barata de las zonas que lo reclaman", () => {
    const masBarata = Math.min(...reclaman.map((z) => z.precio));
    expect(resolverZona(LAT, LNG)?.precio).toBe(masBarata);
  });

  it("y lo hace de forma estable", () => {
    const primera = resolverZona(LAT, LNG);
    for (let i = 0; i < 20; i++) {
      expect(resolverZona(LAT, LNG)?.id).toBe(primera?.id);
    }
  });
});

describe("ZONAS (dato generado)", () => {
  it("tiene las cinco zonas, sin repetidos y ordenadas por id", () => {
    expect(ZONAS.map((z) => z.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it("tiene los precios que definio el cliente", () => {
    expect(ZONAS.map((z) => z.precio)).toEqual([150, 200, 250, 250, 350]);
  });

  it("tiene los nombres normalizados, sin espacios duros ni repetidos", () => {
    // El KML entrega "Zona  4"; si la normalizacion se rompe, esto lo agarra.
    expect(ZONAS.map((z) => z.nombre)).toEqual([
      "Zona 1",
      "Zona 2",
      "Zona 3",
      "Zona 4",
      "Zona 5",
    ]);
  });

  // Protege al generador: si build-zonas.js emitiera un anillo abierto, el
  // ray casting daria resultados silenciosamente erroneos cerca de ese hueco.
  it("cierra todos los anillos", () => {
    for (const z of ZONAS) {
      expect(z.anillo.length).toBeGreaterThan(3);
      expect(z.anillo[0]).toEqual(z.anillo[z.anillo.length - 1]);
    }
  });
});
