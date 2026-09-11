import type { Zona } from "./zonas";

// **La decision de mostrar o no el precio, fuera de React a proposito.**
//
// `web/` corre vitest con `environment: "node"` e `include: ["lib/**/*.test.ts"]`,
// y nada de este repo renderiza React. O sea que si esta regla viviera adentro
// del componente, la mitad del feature que el cliente pidio de verdad —que el
// monto NO se vea sin sesion— se quedaria sin una sola prueba automatica, para
// siempre. Aca si la tiene. Ver specs/024-precio-detras-del-login/research.md D3.
//
// El componente no decide nada: dibuja lo que esta funcion le dio.

export type EntradaPrecioVisible = {
  /** La zona resuelta desde el punto de ENTREGA. `null` si no hay punto, o si cae fuera de las cinco. */
  zona: Zona | null;
  /**
   * Si hay sesion CONFIRMADA.
   *
   * El estado indeterminado —la ventana en que la credencial se rehidrata al
   * cargar la pagina— entra aca como `false` (FR-005a). Lo decide quien llama,
   * no esta funcion: fallar hacia "sin precio" es la unica de las dos
   * direcciones cuyo error es inofensivo.
   */
  conSesion: boolean;
};

/**
 * El monto a mostrar, o `null` si no se muestra ninguno.
 *
 * Hay monto **si y solo si** hay zona y hay sesion (FR-001, FR-002, FR-013).
 *
 * El numero sale de la zona, recalculado en el momento: **nunca** de la columna
 * `precio` de un pedido guardado, que registra lo que la regla del dia habria
 * cobrado y que antes del 2026-08-22 salia de la zona de RETIRO. Esa columna
 * sigue prohibida por el Principio V, y 6.0.0 no levanto una palabra de esa
 * prohibicion (FR-003, FR-015).
 */
export function precioVisible({ zona, conSesion }: EntradaPrecioVisible): number | null {
  if (!zona) return null;
  if (!conSesion) return null;
  return zona.precio;
}
