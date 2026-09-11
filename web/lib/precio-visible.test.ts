import { describe, expect, it } from "vitest";
import { precioVisible } from "./precio-visible";
import { ZONAS } from "./zonas";

// FR-001, FR-002, FR-013, FR-018. **La unica guarda automatica de que el monto
// no se ve sin sesion.**
//
// Nada de este repo renderiza React (`vitest.config.ts`: `environment: "node"`),
// asi que montar el componente y mirar si dibujo un numero no es una opcion. Por
// eso la regla vive en una funcion pura y por eso esta prueba existe: es lo unico
// que corre en cada commit y que se pone en rojo si alguien invierte la
// condicion.
//
// **La fila del monto no es decorativa, es el control positivo.** Las otras tres
// afirman que NO aparece un numero, y las tres pasan en verde con una
// implementacion que devuelve `null` siempre — o sea, con el feature sin
// construir. Sin la primera fila esta prueba no distingue "el precio esta bien
// escondido" de "el precio no existe". Ver
// docs/processes/harness.md y specs/024-precio-detras-del-login/quickstart.md,
// donde ademas se manda a romper la implementacion a proposito y ver el rojo.

const ZONA = ZONAS[0];

describe("precioVisible", () => {
  it("con zona y con sesion devuelve el monto de esa zona", () => {
    expect(precioVisible({ zona: ZONA, conSesion: true })).toBe(ZONA.precio);
  });

  it("con zona y SIN sesion no devuelve monto", () => {
    expect(precioVisible({ zona: ZONA, conSesion: false })).toBeNull();
  });

  it("sin zona y con sesion no devuelve monto", () => {
    expect(precioVisible({ zona: null, conSesion: true })).toBeNull();
  });

  it("sin zona y sin sesion no devuelve monto", () => {
    expect(precioVisible({ zona: null, conSesion: false })).toBeNull();
  });

  // El monto sale de la zona que se le pasa, no de una tabla propia ni de un
  // pedido guardado (FR-003). Se recorren las cinco para que agregar o mover una
  // zona no deje esta funcion devolviendo el precio de otra.
  it("devuelve el precio de CADA zona, y no el de una fija", () => {
    for (const zona of ZONAS) {
      expect(precioVisible({ zona, conSesion: true })).toBe(zona.precio);
    }
  });
});
