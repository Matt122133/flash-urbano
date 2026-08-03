"use client";

import { useState } from "react";
import { MapaZonasDinamico } from "./mapa-zonas-dinamico";
import type { EstadoMosaicos } from "./mapa-zonas";
import { ZONAS } from "@/lib/zonas";

/**
 * La seccion "Zona de entregas" de /sobre-nosotros.
 *
 * Vive en un componente cliente propio porque necesita estado para el aviso de
 * mosaicos caidos; la pagina sigue siendo Server Component y conserva su
 * `metadata`.
 *
 * Aca el mapa es informativo: si no carga, NO se bloquea nada. Es la diferencia
 * con el formulario de pedido, donde el mismo fallo impide cobrar y por lo tanto
 * impide el envio.
 */
export function MapaZonas() {
  const [estadoMosaicos, setEstadoMosaicos] =
    useState<EstadoMosaicos>("cargando");

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">
        Zona de entregas
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Cobertura por zonas dentro de Montevideo. El precio depende de la zona
        desde la que retiramos el paquete.
      </p>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
        <MapaZonasDinamico
          onEstadoMosaicos={setEstadoMosaicos}
          zoomExtra={1}
          className="h-[360px] w-full sm:h-[460px]"
        />
      </div>

      {estadoMosaicos === "no-disponible" && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No pudimos cargar el mapa en este momento. Los precios por zona son
          los de acá abajo.
        </p>
      )}

      {/*
        La leyenda es texto real y permanente, no un reemplazo para cuando algo
        falla. La imagen que habia antes describia las zonas y sus precios en su
        `alt`; un mapa es opaco para quien no lo ve, asi que sin esto el cambio
        seria una regresion de accesibilidad (FR-007).
      */}
      <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {ZONAS.map((zona) => (
          <div
            key={zona.id}
            className="flex items-center justify-between gap-3 border-b border-slate-100 py-2"
          >
            <dt className="flex items-center gap-2.5 text-sm text-slate-700">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: zona.color }}
              />
              {zona.nombre}
            </dt>
            <dd className="text-sm font-semibold text-slate-900">
              $ {zona.precio}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-xs text-slate-400">
        Los límites siguen avenidas: Ruta 102, Ruta 5, Aparicio Saravia, Garzón,
        Belloni, Camino Maldonado, Camino Carrasco y Avenida de las Américas.
        Cuando cargues un pedido vas a poder marcar tu dirección en el mapa y
        ver el precio exacto.
      </p>
    </section>
  );
}
