# Contrato — módulo de zonas y componente de mapa

**Feature**: `specs/002-mapa-zonas-precio` | **Date**: 2026-08-02

El proyecto no expone API HTTP. Las interfaces que sí tiene, y que otro código
del repo consume, son dos: el módulo de resolución de zona y el componente de
mapa. Este documento fija su forma para que `/speckit-tasks` y la
implementación no la reinventen.

---

## 1. `web/lib/zonas.ts` — dato generado

```ts
export type ZonaId = 1 | 2 | 3 | 4 | 5;

export type Zona = {
  id: ZonaId;
  nombre: string;              // "Zona 1" — normalizado (FR-003)
  precio: number;              // pesos, entero
  color: string;               // hex, para mapa y leyenda
  anillo: [number, number][];  // [lat, lng], cerrado
};

/** Ordenadas por id ascendente. Ese orden ES la regla de desempate (FR-018). */
export const ZONAS: readonly Zona[];
```

**Reglas**:

- Archivo **generado** por `web/design-source/build-zonas.js`. No se edita a
  mano. Lleva un encabezado que lo diga y nombre el comando que lo regenera.
- El orden del array es normativo, no cosmético: `resolverZona` lo recorre tal
  cual y devuelve el primer match.
- Regenerarlo tras una corrección de límites no debe requerir tocar
  `zona-lookup.ts` ni sus tests.

---

## 2. `web/lib/zona-lookup.ts` — lógica

```ts
import type { Zona } from "./zonas";

/**
 * Devuelve la zona que contiene el punto, o null si cae fuera de las cinco.
 *
 * null significa "fuera de cobertura" — NO es un error ni un "no sé".
 * Nunca devuelve la zona más cercana (FR-012).
 *
 * Determinismo (FR-018): evalúa las zonas en orden de id 1→5 y devuelve la
 * primera que contenga el punto. Sobre un borde compartido no hay respuesta
 * correcta; hay que garantizar que sea siempre la misma.
 */
export function resolverZona(lat: number, lng: number): Zona | null;
```

**Reglas**:

- Función pura. Sin estado, sin acceso a red, sin `window`. Tiene que poder
  correr en Node bajo Vitest sin nada montado.
- No redondea ni ajusta las coordenadas de entrada.
- Trabaja en lat/lng crudos, sin proyectar (D8).

**Cobertura de tests exigida** (`web/lib/zona-lookup.test.ts`):

| Caso | Espera |
|---|---|
| Un punto interior conocido de cada zona (5 casos) | Devuelve esa zona, con su precio |
| Punto en el Río de la Plata, fuera de todo polígono | `null` |
| Punto lejos de Montevideo (p. ej. otro departamento) | `null` |
| Mismo punto sobre un borde compartido, dos llamadas | Idéntico resultado en ambas |
| Los precios de `ZONAS` | 150 / 200 / 250 / 250 / 350 en las zonas 1–5 |
| Todos los anillos de `ZONAS` | Cierran: primer vértice = último |

El último caso protege el generador: si `build-zonas.js` emite un anillo
abierto, el test lo agarra antes que un cliente.

---

## 3. `web/components/mapa-zonas.tsx` — componente

```tsx
export type EstadoMosaicos = "cargando" | "ok" | "no-disponible";

export type MapaZonasProps = {
  /** Solo lectura (Sobre Nosotros) o permite marcar punto (formulario). */
  interactivo: boolean;
  /** Punto marcado, si hay. Componente controlado por el consumidor. */
  punto?: { lat: number; lng: number } | null;
  /** Se dispara al tocar el mapa o soltar el marcador. Solo si interactivo. */
  onPunto?: (p: { lat: number; lng: number }) => void;
  /** Reporta la disponibilidad de los mosaicos; el consumidor decide qué hacer. */
  onEstadoMosaicos?: (estado: EstadoMosaicos) => void;
  /** Alto del contenedor. Mobile-first: generoso por defecto. */
  className?: string;
};
```

**Reglas**:

- Lleva `"use client"`. Se consume a través de
  `web/components/mapa-zonas-dinamico.tsx`, que también es cliente y hace el
  `dynamic(..., { ssr: false })` (D4).
- Dibuja siempre las cinco zonas desde `ZONAS`, en los dos modos.
- Muestra la atribución de OpenStreetMap (FR-008). No es opcional ni
  configurable: es condición de la licencia.
- **No decide** qué pasa si los mosaicos fallan. Reporta por
  `onEstadoMosaicos` y listo (D7).
- **No resuelve la zona ni calcula precio.** Solo emite el punto. Quien
  necesita el precio llama a `resolverZona`. Mantiene el mapa como capa de
  presentación y la plata en una función pura testeada.
- Marcador con `L.divIcon`, nunca `L.Icon.Default` (D5).
- `scrollWheelZoom: false` (D6).

---

## 4. `web/design-source/build-zonas.js` — generador

```bash
cd web
node design-source/build-zonas.js \
  design-source/zonas-flash-urbano.kml \
  lib/zonas.ts
```

**Reglas**:

- Sin dependencias fuera de lo que ya trae el proyecto.
- Normaliza los nombres: colapsa espacios duros (`\xa0`) y repetidos (FR-003).
- Falla ruidosamente si un anillo no cierra, si no encuentra las cinco zonas, o
  si un nombre no mapea a un precio conocido. Un archivo generado a medias es
  peor que ninguno cuando de él depende un cobro.
- Emite el mapeo de precios desde una tabla explícita en el propio script, y
  esa tabla es el único lugar donde vive un precio (FR-005).
- Se documenta en `web/design-source/README.md`, donde en el mismo cambio se
  retira la sección de `build-map.js`.
