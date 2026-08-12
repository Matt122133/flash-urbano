"use client";

// Compone el formulario de pedido con lo que necesita para llegar al servicio.
//
// **Este archivo existe para poder importar `lib/api.ts`.** El formulario no
// puede: `components/pedido-form.tsx` es una de las ENTRADAS de
// `lib/cotizar-abierto.test.ts`, la guarda que verifica que cotizar no dependa
// del servicio (FR-001, FR-002, FR-004). Un import del cliente del API alla
// pondria esa guarda en rojo, con razon.
//
// Asi que la dependencia se invierte: el formulario declara que necesita
// (`onConfirmar`) y esto decide como se cumple. El formulario queda probable sin
// red y sin sesion, y la pieza que habla con el servicio queda aislada en un
// archivo cuyo trabajo es exactamente ese. Ver research D1.
//
// La guarda tiene un control positivo que afirma que ESTE archivo si alcanza
// `lib/api.ts`. Sin el, borrar el envio entero dejaria la prueba en verde.

import { useCallback, useRef } from "react";

import {
  PedidoForm,
  type FormState,
  type ResultadoConfirmacion,
} from "@/components/pedido-form";
import { ErrorApi, crearPedido } from "@/lib/api";
import { armarCuerpoPedido, type DatosDelPedido } from "@/lib/pedido";
import { credencial } from "@/lib/sesion";

/** Traduce lo que junto el formulario a lo que el mapeo puro espera. */
function aDatos(form: FormState): DatosDelPedido {
  return {
    nombre: form.name,
    telefono: form.phone,
    retiro: form.retiro.direccion,
    entrega: form.entrega.direccion,
    // El formulario impide enviar sin tamano; el `|| "chico"` es solo para que
    // el tipo cierre, no una decision de negocio.
    tamano: form.packageSize || "chico",
    cantidad: form.quantity,
    fecha: form.pickupDate,
    hora: form.pickupTime,
    destinatarioNombre: form.receiverName,
    destinatarioTelefono: form.receiverPhone,
  };
}

export function CrearPedido() {
  /**
   * La clave del INTENTO de envio en curso.
   *
   * Un `useRef` y no un estado: cambiarla no tiene que redibujar nada. Se genera
   * al primer intento y **se conserva entre reintentos**, que es lo que hace que
   * un doble toque o una reanudacion despues del ingreso lleguen al mismo pedido
   * en vez de crear dos (FR-016).
   *
   * Se descarta recien cuando un pedido se creo: a partir de ahi, el proximo
   * envio es un pedido nuevo y merece una clave nueva.
   */
  const claveDelIntento = useRef<string | null>(null);

  const onConfirmar = useCallback(
    async (form: FormState): Promise<ResultadoConfirmacion> => {
      const armado = armarCuerpoPedido(aDatos(form));
      if (!armado.ok) {
        // Los dos motivos deberian estar filtrados por la validacion del
        // formulario. Que igual se traduzcan a un mensaje —en vez de a un
        // throw— es lo que evita una pantalla rota si alguna vez no lo estan.
        return {
          estado: "error",
          mensaje:
            armado.motivo === "fuera-de-zona"
              ? "Ese punto queda fuera de nuestra zona de cobertura. Escribinos y vemos como darte una mano."
              : "Marcá el punto de retiro antes de confirmar.",
        };
      }

      if (!claveDelIntento.current) {
        claveDelIntento.current = crypto.randomUUID();
      }

      try {
        const pedido = await crearPedido(
          armado.cuerpo,
          claveDelIntento.current,
          credencial(),
        );
        // Creado: el proximo envio es otro pedido y necesita otra clave.
        claveDelIntento.current = null;
        return { estado: "creado", codigo: pedido.codigo };
      } catch (e) {
        if (e instanceof ErrorApi && e.sinRespuesta) {
          // SC-013: se dice la verdad —el pedido NO se creo— y lo cargado sigue
          // en pantalla. La clave se conserva: si reintenta cuando el servicio
          // vuelva, es el mismo intento.
          return {
            estado: "error",
            mensaje:
              "No pudimos crear el pedido: el servicio no responde. Lo que cargaste sigue acá, probá de nuevo en un momento.",
          };
        }
        if (e instanceof ErrorApi) {
          return { estado: "error", mensaje: e.message };
        }
        return {
          estado: "error",
          mensaje: "No pudimos crear el pedido. Probá de nuevo.",
        };
      }
    },
    [],
  );

  return <PedidoForm onConfirmar={onConfirmar} />;
}
