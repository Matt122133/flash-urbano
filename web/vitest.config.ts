import { defineConfig } from "vitest/config";

// Los tests cubren solo la resolucion de zona (lib/zona-lookup.ts), que es una
// funcion pura: sin red, sin window, sin React. Por eso el entorno es node y no
// jsdom — montar un DOM para esto seria infraestructura de mas.
//
// No se testea UI en este plan; ver specs/002-mapa-zonas-precio/plan.md.
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
