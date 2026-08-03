"use client";

import dynamic from "next/dynamic";
import type { MapaZonasProps } from "./mapa-zonas";

// Leaflet toca `window` al evaluarse el modulo, asi que no puede prerenderizarse.
//
// Este wrapper tiene que ser Client Component: la doc de Next 16 en el repo
// (node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md) dice que
// `ssr: false` solo aplica dentro de componentes cliente. Por eso las paginas
// que son Server Component —como /sobre-nosotros, que exporta `metadata`—
// importan ESTE archivo y no llaman a `dynamic` ellas mismas.
const MapaZonas = dynamic(() => import("./mapa-zonas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
      Cargando el mapa…
    </div>
  ),
});

export function MapaZonasDinamico(props: MapaZonasProps) {
  return <MapaZonas {...props} />;
}
