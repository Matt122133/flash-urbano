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
 * con el formulario de pedido, donde el mismo fallo impide saber si llegamos a
 * la direccion y por lo tanto impide el envio.
 *
 * **Desde `013` esta seccion cambio de sentido, no de contenido.** Era una
 * tabla de tarifas dibujada sobre un mapa; ahora es una declaracion de
 * cobertura: estas son las areas donde se trabaja, y no son todas la misma. El
 * cliente pidio explicitamente que las zonas se siguieran viendo distintas
 * entre si. Por que se fueron los montos:
 * docs/decisions/price-not-shown.md.
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
        Estas son las zonas de Montevideo en las que trabajamos. Cuando cargues
        un pedido vas a poder marcar la dirección de entrega en el mapa y ver si
        entra.
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
          No pudimos cargar el mapa en este momento. Las zonas están listadas
          acá abajo.
        </p>
      )}

      {/*
        La leyenda es texto real y permanente, no un reemplazo para cuando algo
        falla. La imagen que habia antes describia las zonas en su `alt`; un mapa
        es opaco para quien no lo ve, asi que sin esto el cambio seria una
        regresion de accesibilidad (FR-007 de `002`, FR-010 de `013`).

        **Color y nombre, y nada mas.** Se evaluo agregarle a cada zona que
        calles la limitan, ahora que el numero solo no le dice nada a nadie, y
        se descarto: es texto que hay que mantener cada vez que se mueve un
        trazado, el cliente no lo pidio, y el pie de la seccion ya nombra las
        avenidas.
      */}
      <ul className="mt-4 grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {ZONAS.map((zona) => (
          <li
            key={zona.id}
            className="flex items-center gap-2.5 border-b border-slate-100 py-2 text-sm text-slate-700"
          >
            <span
              aria-hidden="true"
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: zona.color }}
            />
            {zona.nombre}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-slate-400">
        Los límites siguen avenidas: Ruta 102, Ruta 5, Aparicio Saravia, Garzón,
        Belloni, Camino Maldonado, Camino Carrasco y Avenida de las Américas.
        Si tu dirección queda fuera de estas zonas, escribinos igual y vemos cómo
        darte una mano.
      </p>
    </section>
  );
}
