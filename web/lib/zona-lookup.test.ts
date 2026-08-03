import { describe, expect, it } from "vitest";
import { ZONAS } from "./zonas";
import { resolverZona } from "./zona-lookup";

// Estos son los unicos tests del repo, y estan aca por un motivo concreto: esta
// funcion decide cuanto se le cobra a una persona. Un borde mal resuelto no se
// ve mirando la pantalla, se ve en la factura.
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
    // agarra: la respuesta correcta es que no hay cobertura (FR-012).
    expect(resolverZona(-34.83, -55.7)).toBeNull();
  });

  // FR-018. Sobre un borde compartido no hay respuesta correcta —las dos zonas
  // lo reclaman— asi que lo unico exigible es que sea SIEMPRE la misma. El punto
  // de abajo es un vertice que comparten las zonas 1, 2 y 3.
  it("resuelve un borde compartido de forma determinista", () => {
    const lat = -34.8708445;
    const lng = -56.2417988;
    const primera = resolverZona(lat, lng);
    for (let i = 0; i < 20; i++) {
      expect(resolverZona(lat, lng)?.id).toBe(primera?.id);
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
    // El KML entrega "Zona  4"; si la normalizacion se rompe, esto lo agarra.
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
