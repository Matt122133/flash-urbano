"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { TarjetaPedido } from "@/components/pedido/tarjeta-pedido";
import { useLlamadaAutenticada, useSesion } from "@/components/sesion/proveedor-sesion";
import { ErrorApi, type PedidoGuardado } from "@/lib/api";

/**
 * Cuantos se muestran antes de pedir "Ver todos".
 *
 * **No es paginado**: la respuesta ya vino entera. Es cuanto entra en una
 * pantalla de telefono sin volverla un rollo infinito. El paginado de verdad
 * queda sin construir a proposito (Principio III) y anotado como deuda con su
 * umbral — ver FR-024.
 */
const VISIBLES_AL_PRINCIPIO = 5;

/**
 * *Mis pedidos*, dentro de *Mi cuenta*.
 *
 * Es lo que `007` difirio por su nombre (FR-030) y la razon por la que hoy
 * alguien que cierra la pestaña pierde el codigo de su pedido para siempre.
 *
 * **Vive en `components/pedido/` y no en `components/sesion/`** aunque se monte
 * en `/perfil`: por ARCHITECTURE, esta es la capa de composicion con permiso de
 * importar `lib/api.ts`, y esto habla con el servicio. Que se muestre dentro de
 * la cuenta no lo vuelve del dominio de la cuenta.
 */
export function Historial() {
  const { usuario } = useSesion();
  const llamar = useLlamadaAutenticada();

  const [pedidos, setPedidos] = useState<PedidoGuardado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [todos, setTodos] = useState(false);
  // Cambia para forzar otro intento. Un contador y no un booleano: reintentar
  // dos veces seguidas tiene que volver a disparar el efecto.
  const [intento, setIntento] = useState(0);

  const hayUsuario = Boolean(usuario);

  useEffect(() => {
    // Sin sesion no se pide nada y no se muestra nada (FR-008). La pantalla que
    // monta esto ya decide lo mismo; esta guarda existe para que el componente
    // sea seguro donde sea que lo monten mañana.
    if (!hayUsuario) return;

    let vigente = true;

    // **El efecto no toca el estado de forma sincronica**, solo dentro de las
    // respuestas. Volver a "cargando" al reintentar lo hace `reintentar()`, que
    // es un manejador de evento. No es un capricho del linter
    // (`react-hooks/set-state-in-effect`): un `setState` al entrar al efecto
    // provoca un render extra antes de que se vea nada, y en este archivo eso
    // vale doble — un remonte de mas es la forma exacta del defecto que `007`
    // pago el 2026-08-14.
    llamar<{ pedidos: PedidoGuardado[] }>("/pedidos")
      .then((r) => {
        if (!vigente) return;
        // **El orden lo pone el servicio** (`creado_en DESC`). No se re-ordena:
        // FR-002 se rompe re-ordenando, no confiando.
        setPedidos(r.pedidos ?? []);
      })
      .catch((e: unknown) => {
        if (!vigente) return;
        // Un 401 ya lo convirtio el hook en el aviso de sesion vencida y en un
        // cierre de sesion; mostrarlo aca ademas seria decir dos veces lo mismo.
        if (e instanceof ErrorApi && e.sesionInvalida) return;
        // `ErrorApi` ya trae un mensaje escrito para una persona —el de red lo
        // arma `lib/api.ts`, el del servicio viene en el cuerpo—, asi que se
        // muestra tal cual en vez de taparlo con uno generico.
        setError(
          e instanceof ErrorApi ? e.message : "No pudimos cargar tus pedidos.",
        );
      });

    // Evita escribir sobre un componente que ya no esta —al salir de la
    // pantalla mientras la llamada viaja— y, mas importante, evita que una
    // respuesta vieja pise a una nueva al reintentar.
    return () => {
      vigente = false;
    };
  }, [hayUsuario, llamar, intento]);

  const reintentar = useCallback(() => {
    setError(null);
    setPedidos(null);
    setIntento((n) => n + 1);
  }, []);

  if (!hayUsuario) return null;

  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold text-slate-900">Mis pedidos</h2>

      {error ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p>{error}</p>
          <button
            type="button"
            onClick={reintentar}
            className="mt-2 font-medium underline underline-offset-2"
          >
            Reintentar
          </button>
        </div>
      ) : pedidos === null ? (
        <p className="mt-3 text-sm text-slate-500">Un momento…</p>
      ) : pedidos.length === 0 ? (
        <div className="mt-3 text-sm text-slate-600">
          <p>Todavía no hiciste ningún envío.</p>
          <Link
            href="/pedido"
            className="mt-1 inline-block font-medium text-brand hover:underline"
          >
            Crear el primero
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-3 space-y-3">
            {(todos ? pedidos : pedidos.slice(0, VISIBLES_AL_PRINCIPIO)).map((p) => (
              <li key={p.id}>
                <TarjetaPedido pedido={p} />
              </li>
            ))}
          </ul>
          {!todos && pedidos.length > VISIBLES_AL_PRINCIPIO && (
            <button
              type="button"
              onClick={() => setTodos(true)}
              className="mt-3 text-sm font-medium text-brand hover:underline"
            >
              Ver todos ({pedidos.length})
            </button>
          )}
        </>
      )}
    </section>
  );
}
