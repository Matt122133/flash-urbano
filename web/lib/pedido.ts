// Arma el cuerpo de POST /pedidos a partir de lo que el formulario junto.
//
// **Este modulo es PURO y no puede dejar de serlo.** No importa `lib/api.ts` ni
// `lib/sesion.ts`, y por eso puede vivir en `lib/` sin poner en rojo la guarda
// de `cotizar-abierto.test.ts`. Si alguna vez hace falta que hable con el
// servicio, la funcion nueva va en otro archivo.
//
// Lo que aca importa de verdad es FR-019: **la zona y el precio se derivan del
// PUNTO en el momento de cerrar el pedido**, no se arrastran de un estado que
// pueda haber quedado viejo. El formulario ya sigue esa disciplina —los
// recalcula en cada render en vez de guardarlos— y este modulo es el ultimo
// lugar donde podria romperse, porque es donde el valor deja de recalcularse y
// se congela.

import type { Direccion } from "./direccion";
import { resolverZona } from "./zona-lookup";

/** Los tamanos de paquete, los mismos desde `001`. */
export type TamanoPaquete = "chico" | "mediano" | "grande";

/**
 * Lo que el formulario junto, ya sin el andamiaje del autocompletado.
 *
 * Se define con los tipos de `lib/` y no con el `FormState` del componente a
 * proposito: deja este modulo probable sin montar React, y evita que `lib/`
 * dependa de `components/`.
 */
export type DatosDelPedido = {
  nombre: string;
  telefono: string;
  retiro: Direccion;
  entrega: Direccion;
  tamano: TamanoPaquete;
  cantidad: string;
  fecha: string;
  hora: string;
  destinatarioNombre: string;
  destinatarioTelefono: string;
};

/** El cuerpo que espera POST /pedidos. Ver specs/007/contracts/pedidos.md. */
export type CuerpoPedido = {
  remitente: { nombre: string; telefono: string };
  retiro: {
    calle: string;
    esquina: string;
    numero: string;
    apto: string;
    cooperativa: boolean;
    punto: { lat: number; lng: number };
  };
  // Sin `punto`, y no es un olvido: la entrega no lleva punto desde `003`, y el
  // servicio rechaza el campo con un 400 en vez de descartarlo callado.
  entrega: {
    calle: string;
    esquina: string;
    numero: string;
    apto: string;
    cooperativa: boolean;
  };
  paquete: { tamano: TamanoPaquete; cantidad: number };
  retiroCuando: { fecha: string; hora: string };
  destinatario: { nombre: string; telefono: string };
  cobro: { zonaId: number; precio: number };
};

/**
 * Por que no se pudo armar el cuerpo.
 *
 * Se devuelve un motivo en vez de lanzar: los dos casos son estados normales
 * del formulario —todavia no marco el punto, o el punto cayo fuera de las
 * zonas— y no excepciones.
 */
export type MotivoInvalido = "sin-punto" | "fuera-de-zona";

export type ArmadoDelCuerpo =
  | { ok: true; cuerpo: CuerpoPedido }
  | { ok: false; motivo: MotivoInvalido };

/**
 * Convierte los datos del formulario en el cuerpo del pedido.
 *
 * **La zona y el precio salen de `resolverZona(punto)` aca y ahora.** No se
 * reciben por parametro y no se leen de ningun estado: recibirlos abriria la
 * puerta a que el precio que viaja no sea el que el punto produce, que es
 * exactamente el defecto que FR-019 cierra.
 *
 * Sin zona no hay precio, y sin precio no hay pedido (FR-020): un punto fuera
 * de cobertura devuelve `fuera-de-zona` y el flujo termina en contacto directo,
 * no en un pedido con precio inventado.
 */
export function armarCuerpoPedido(datos: DatosDelPedido): ArmadoDelCuerpo {
  const punto = datos.retiro.punto;
  if (!punto) {
    return { ok: false, motivo: "sin-punto" };
  }

  const zona = resolverZona(punto.lat, punto.lng);
  if (!zona) {
    return { ok: false, motivo: "fuera-de-zona" };
  }

  // La cantidad viaja como texto en el formulario (es un <input>). Un valor no
  // numerico cae a 1 en vez de mandar NaN, que el servicio rechazaria con un
  // mensaje sobre JSON en vez de sobre la cantidad.
  const cantidad = Number.parseInt(datos.cantidad, 10);

  return {
    ok: true,
    cuerpo: {
      remitente: {
        nombre: datos.nombre.trim(),
        telefono: datos.telefono.trim(),
      },
      retiro: {
        calle: datos.retiro.calle.trim(),
        esquina: datos.retiro.esquina.trim(),
        numero: datos.retiro.numero.trim(),
        apto: datos.retiro.apto.trim(),
        cooperativa: datos.retiro.cooperativa,
        punto: { lat: punto.lat, lng: punto.lng },
      },
      entrega: {
        calle: datos.entrega.calle.trim(),
        esquina: datos.entrega.esquina.trim(),
        numero: datos.entrega.numero.trim(),
        apto: datos.entrega.apto.trim(),
        cooperativa: datos.entrega.cooperativa,
      },
      paquete: {
        tamano: datos.tamano,
        cantidad: Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1,
      },
      retiroCuando: { fecha: datos.fecha, hora: datos.hora },
      destinatario: {
        nombre: datos.destinatarioNombre.trim(),
        telefono: datos.destinatarioTelefono.trim(),
      },
      cobro: { zonaId: zona.id, precio: zona.precio },
    },
  };
}
