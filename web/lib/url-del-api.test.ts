import { describe, expect, it } from "vitest";

import {
  ApiCruzadoError,
  URL_DEL_API_DE_PRODUCCION,
  resolverUrlDelApi,
} from "./url-del-api";

/**
 * La guarda del cruce de cables (027, FR-008/FR-009).
 *
 * **Las dos mitades, y la segunda es la que importa.** Una prueba que solo
 * afirma que hoy esta bien no distingue "esta bien" de "no esta mirando", y una
 * guarda escrita con la comparacion al reves pasaria esa prueba sin proteger
 * nada. Por eso hay tantos casos de rechazo como de aceptacion.
 *
 * El caso que mas facil se olvida es el tercero: **fuera de la publicacion,
 * cualquier URL vale**. Apuntar la web local a staging es el uso normal de
 * tener un ambiente de staging (FR-008a); una guarda que lo rompiera haria
 * inutil la feature que vino a proteger.
 */
describe("resolverUrlDelApi", () => {
  const DE_STAGING = "https://ejemplo-que-no-es-produccion.up.railway.app";

  describe("publicando el sitio de produccion", () => {
    it("deja pasar la URL de produccion", () => {
      expect(resolverUrlDelApi(URL_DEL_API_DE_PRODUCCION, true)).toBe(
        URL_DEL_API_DE_PRODUCCION,
      );
    });

    it("rechaza cualquier otra URL", () => {
      expect(() => resolverUrlDelApi(DE_STAGING, true)).toThrow(ApiCruzadoError);
    });

    it("rechaza la variable vacia, que es como se ve si nadie la definio", () => {
      expect(() => resolverUrlDelApi("", true)).toThrow(ApiCruzadoError);
      expect(() => resolverUrlDelApi(undefined, true)).toThrow(ApiCruzadoError);
    });

    it("nombra las dos URLs en el error, porque el mensaje es el arreglo", () => {
      // Un "build failed" sin decir contra que se compilo obliga a adivinar.
      try {
        resolverUrlDelApi(DE_STAGING, true);
        expect.unreachable("tenia que fallar");
      } catch (error) {
        const mensaje = (error as Error).message;
        expect(mensaje).toContain(DE_STAGING);
        expect(mensaje).toContain(URL_DEL_API_DE_PRODUCCION);
      }
    });

    it("no se deja enganar por la barra final", () => {
      // La misma URL con barra es la misma URL. Sin normalizar, una barra de mas
      // en la variable de repositorio cortaria una publicacion legitima.
      expect(resolverUrlDelApi(`${URL_DEL_API_DE_PRODUCCION}/`, true)).toBe(
        URL_DEL_API_DE_PRODUCCION,
      );
    });
  });

  describe("fuera de la publicacion", () => {
    it("deja pasar la URL de staging, que es el uso normal (FR-008a)", () => {
      expect(resolverUrlDelApi(DE_STAGING, false)).toBe(DE_STAGING);
    });

    it("deja pasar un backend local", () => {
      expect(resolverUrlDelApi("http://localhost:8080", false)).toBe(
        "http://localhost:8080",
      );
    });

    it("deja pasar la variable vacia sin fallar", () => {
      // El sitio compila igual sin la variable; `lib/api.ts` ya trata la cadena
      // vacia. Que la guarda opine de eso fuera de la publicacion seria cambiar
      // un comportamiento que no vino a tocar.
      expect(resolverUrlDelApi(undefined, false)).toBe("");
    });
  });
});
