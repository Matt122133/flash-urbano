"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TarjetaPedido } from "@/components/pedido/tarjeta-pedido";
import { useLlamadaAutenticada, useSesion } from "@/components/sesion/proveedor-sesion";
import { ErrorApi, type PedidoGuardado } from "@/lib/api";
import {
  corteDesdeUrl,
  filtrarPedidos,
  hayFiltro,
  type CorteEstado,
} from "@/lib/filtrar-pedidos";

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
 * Los cuatro cortes, en el orden en que se muestran.
 *
 * "Todos" primero y a la izquierda: es el estado de partida, y tiene que ser el
 * mas facil de volver a tocar.
 */
const CORTES: readonly { id: CorteEstado; etiqueta: string }[] = [
  { id: "todos", etiqueta: "Todos" },
  { id: "pendientes", etiqueta: "Pendientes" },
  { id: "aceptados", etiqueta: "Aceptados" },
  { id: "entregados", etiqueta: "Entregados" },
];

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

  /**
   * El corte por estado **sale de la URL** (FR-016), no de un estado local.
   *
   * Asi recargar y el boton de atras lo conservan, y entrar de nuevo desde el
   * menu —que no lleva el parametro— da la lista completa. Es lo que evita que
   * alguien se encuentre dias despues con un filtro que no recuerda haber
   * puesto y crea que perdio pedidos.
   *
   * El limite de Suspense que `useSearchParams` exige ya existe en `/perfil`
   * desde `022`: sin el, el build estatico falla.
   */
  const parametros = useSearchParams();
  const ruta = usePathname();
  const router = useRouter();
  const corte = corteDesdeUrl(parametros.get("estado"));

  /**
   * El texto buscado vive **solo en memoria**, y esa es la mitad de FR-017.
   *
   * No va a la URL ni al almacenamiento porque puede contener el nombre de
   * quien recibe —un tercero que no consintio nada— y una URL se comparte, se
   * copia a un chat y queda en el historial del navegador. Es la misma regla por
   * la que `010` decidio que repetir un pedido viajara por un id y no por los
   * datos.
   *
   * El precio es que recargar lo pierde. Es el precio correcto.
   */
  const [texto, setTexto] = useState("");
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

  /**
   * Cambia el corte **preservando los parametros que no son suyos**.
   *
   * Es el patron que documenta esta version de Next para `useSearchParams`:
   * copiar los parametros actuales, tocar una sola clave, navegar con el
   * resultado. Escribir la URL a mano —`/perfil?estado=...`— borraria el `?ver=`
   * de `022` y devolveria a la persona a *Mis datos* al filtrar.
   *
   * `todos` no deja rastro en la URL: es el estado de partida, y un
   * `?estado=todos` colgado no dice nada que la ausencia no diga.
   *
   * `replace` y no `push`: cambiar de filtro no es navegar, y llenar el historial
   * obligaria a apretar "atras" cuatro veces para salir de la pantalla. Es la
   * misma decision que `022` tomo para alternar de vista.
   */
  const irAlCorte = useCallback(
    (id: CorteEstado) => {
      const siguientes = new URLSearchParams(parametros.toString());
      if (id === "todos") siguientes.delete("estado");
      else siguientes.set("estado", id);
      const qs = siguientes.toString();
      router.replace(qs ? `${ruta}?${qs}` : ruta, { scroll: false });
    },
    [parametros, router, ruta],
  );

  const filtro = useMemo(() => ({ estado: corte, texto }), [corte, texto]);
  const filtrando = hayFiltro(filtro);

  /**
   * **Se filtra ANTES de recortar, y el orden importa.**
   *
   * Al reves —recortar a cinco y filtrar eso— buscar un pedido de marzo no
   * encontraria nada, y filtrar por pendientes diria "no hay" teniendo tres mas
   * abajo. Seria un producto que miente con total naturalidad.
   */
  const visibles = useMemo(
    () => (pedidos ? filtrarPedidos(pedidos, filtro) : []),
    [pedidos, filtro],
  );

  // Con un filtro puesto no se recorta: quien filtro ya dijo que quiere ver ese
  // subconjunto entero, y volver a pedirle "Ver todos" es cobrarle dos veces.
  const enPantalla = todos || filtrando ? visibles : visibles.slice(0, VISIBLES_AL_PRINCIPIO);

  const limpiar = useCallback(() => {
    setTexto("");
    irAlCorte("todos");
  }, [irAlCorte]);

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
        // El vacio DE VERDAD: esta persona no hizo ningun envio todavia. Es el
        // unico lugar donde va este texto — ver el otro vacio mas abajo.
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
          {/* Los controles se dibujan SOLO con la lista en la mano (FR-011):
              arriba estan las ramas de error y de carga, y ofrecer filtrar algo
              que no llego es ruido encima de un aviso que si importa.

              `aria-pressed` y no el patron de pestañas de ARIA, por lo mismo que
              el conmutador de vistas de `/perfil`: ese patron promete navegacion
              con flechas, y prometerla sin implementarla es peor que no usarlo.

              `flex-wrap` y no scroll horizontal: en un telefono angosto los
              cuatro cortes bajan a dos filas, que se puede tocar; una fila que
              se desborda esconde el ultimo corte sin decirlo. */}
          <div className="mt-4 flex flex-wrap gap-2">
            {CORTES.map(({ id, etiqueta }) => (
              <button
                key={id}
                type="button"
                aria-pressed={corte === id}
                onClick={() => irAlCorte(id)}
                className={`min-h-12 rounded-lg border px-4 text-sm font-medium transition-colors ${
                  corte === id
                    ? // El naranja de marca marca CUAL esta puesto, y nada mas
                      // (decision de Mateo, 2026-09-06). Va tenido y no solido
                      // porque el naranja solido es la accion principal —el
                      // boton de *Crear pedido*—: si un filtro se pinta igual
                      // que el, el color mas fuerte de la pantalla pasa a
                      // significar dos cosas.
                      "border-accent bg-accent/10 text-accent"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {etiqueta}
              </button>
            ))}
          </div>

          {/* El texto NO viaja en la URL (FR-017): puede ser el nombre de quien
              recibe. Vive en memoria y se pierde al recargar, a proposito. */}
          <input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por código o destinatario"
            aria-label="Buscar entre tus pedidos por código o nombre de quien recibe"
            className="mt-3 min-h-12 w-full rounded-lg border border-slate-300 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent focus:outline-none"
          />

          {/* El conteo solo cuando hay algo puesto (FR-007). Sin el, "no hay" y
              "no se muestran" se ven igual, y la persona no tiene forma de saber
              cual de las dos le esta pasando. */}
          {filtrando && (
            <p className="mt-3 text-sm text-slate-500">
              {visibles.length === 0
                ? `Ninguno de tus ${pedidos.length} pedidos coincide`
                : `Mostrando ${visibles.length} de ${pedidos.length}`}
            </p>
          )}

          {visibles.length === 0 ? (
            // El OTRO vacio, y la distincion es el corazon de este feature: aca
            // la persona tiene pedidos, solo que ninguno coincide. Decirle
            // "todavia no hiciste ningun envio" seria decirle que los perdio.
            <div className="mt-3 text-sm text-slate-600">
              <p>No encontramos ningún pedido con eso.</p>
              <button
                type="button"
                onClick={limpiar}
                className="mt-1 font-medium text-brand hover:underline"
              >
                Ver todos mis pedidos
              </button>
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {enPantalla.map((p) => (
                <li key={p.id}>
                  <TarjetaPedido
                    pedido={p}
                    onBaja={() => setIntento((n) => n + 1)}
                  />
                </li>
              ))}
            </ul>
          )}

          {/* "Ver todos" es el recorte de pantalla de `010`, y solo tiene
              sentido sin filtro: con uno puesto ya se muestran todas las
              coincidencias. */}
          {!todos && !filtrando && pedidos.length > VISIBLES_AL_PRINCIPIO && (
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
