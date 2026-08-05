import type { Zona } from "./zonas";

export type Punto = { lat: number; lng: number };

/**
 * Una direccion tal como la arma el formulario.
 *
 * Es la forma que el dia que exista persistencia se guarda por pedido, asi que
 * se define una sola vez y la usan los dos bloques (FR-025). Ver
 * specs/003-direccion-por-esquina/data-model.md.
 *
 * `punto`, `zona` y `precio` son opcionales **por diseno**: los tiene el
 * retiro, no la entrega. La entrega quedo como texto libre (FR-007a) pero entra
 * en el mismo molde para que no convivan dos formas de direccion.
 */
export type Direccion = {
  /** Nombre de calle como se muestra. */
  calle: string;
  /** Nombre de la calle que la cruza. */
  esquina: string;
  /** Numero de puerta. Texto libre, informativo para el repartidor: no ubica. */
  numero: string;
  apto: string;
  cooperativa: boolean;
  /** Solo retiro. Resuelto del cruce y ajustable dentro de la cuadra. */
  punto?: Punto | null;
};

export const DIRECCION_VACIA: Direccion = {
  calle: "",
  esquina: "",
  numero: "",
  apto: "",
  cooperativa: false,
  punto: null,
};

/**
 * Una direccion con lo que se le cobra, congelado.
 *
 * `zona` y `precio` NO viven en `Direccion` a proposito: mientras el pedido se
 * esta armando se derivan del punto en cada render, para que no puedan quedar
 * desincronizados — es la disciplina que ya sigue el formulario. Este tipo es
 * para el momento en que el pedido se cierra: ahi hay que congelarlos, o un
 * cambio futuro de limites reescribiria lo ya cobrado.
 */
export type DireccionCobrada = Direccion & {
  punto: Punto;
  zona: Zona;
  precio: number;
};

/** Arma el texto de una direccion para mostrarla o mandarla. */
export function componerDireccion(d: Direccion): string {
  return [
    [d.calle, d.numero].filter(Boolean).join(" "),
    d.apto && `apto ${d.apto}`,
    d.esquina && `esq. ${d.esquina}`,
    d.cooperativa && "cooperativa",
  ]
    .filter(Boolean)
    .join(", ");
}
