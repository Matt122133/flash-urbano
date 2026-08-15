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

/**
 * Un identificador para el INTENTO de envio, que sirva de clave de idempotencia.
 *
 * Existe como funcion propia —y aca, donde hay pruebas— por un defecto concreto
 * del 2026-08-14: `crear-pedido.tsx` llamaba a `crypto.randomUUID()` directo, y
 * **esa funcion solo existe en contexto seguro**. `https://` y `localhost` lo
 * son; `http://192.168.1.4:3000`, que es como se prueba el sitio desde un
 * telefono en la red local, NO. Ahi `crypto.randomUUID` es `undefined`, la
 * llamada tira, y el sintoma fue el peor posible: **el boton de confirmar no
 * hacia absolutamente nada**.
 *
 * En produccion siempre hay contexto seguro, asi que esto no arregla un bug de
 * los clientes. Arregla algo mas caro: que la unica forma de probar el flujo en
 * un telefono de verdad —que es donde el producto se usa— fuera imposible.
 *
 * `crypto.getRandomValues` **si** esta disponible sin contexto seguro, asi que
 * el respaldo arma el mismo UUID v4 con el. El servicio no exige formato —solo
 * que no venga vacia— pero se mantiene el mismo para que un pedido no se
 * distinga de otro por como se probo.
 */
export function claveDeIntento(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Los dos campos que hacen que sea un UUID v4 y no dieciseis bytes al azar:
  // la version en el nibble alto del byte 6, y la variante en el del byte 8.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}
