import { ZONAS, type Zona } from "./zonas";

/**
 * Punto en poligono por ray casting: se traza un rayo horizontal desde el punto
 * y se cuentan los cruces con los lados. Impar = adentro.
 *
 * Se trabaja en lat/lng crudos, sin proyectar. A la escala de Montevideo la
 * distorsion es irrelevante para decidir de que lado de una avenida cae un
 * punto, y proyectar agregaria una fuente de error propia.
 */
function contiene(lat: number, lng: number, anillo: [number, number][]): boolean {
  let adentro = false;
  for (let i = 0; i < anillo.length - 1; i++) {
    const [lat0, lng0] = anillo[i];
    const [lat1, lng1] = anillo[i + 1];
    // Solo cuentan los lados que cruzan la latitud del punto.
    if (lat0 > lat !== lat1 > lat) {
      const cruce = ((lng1 - lng0) * (lat - lat0)) / (lat1 - lat0) + lng0;
      if (lng < cruce) adentro = !adentro;
    }
  }
  return adentro;
}

/**
 * Devuelve la zona que contiene el punto, o `null` si cae fuera de las cinco.
 *
 * `null` significa **fuera de cobertura**: no es un error ni un "todavia no se".
 * Nunca se devuelve la zona mas cercana (FR-012) — adivinar una zona es adivinar
 * un precio, y el precio es en firme.
 *
 * Determinismo (FR-018): las zonas se recorren en el orden de `ZONAS` (id 1→5) y
 * gana la primera que contenga el punto. Los poligonos comparten bordes, asi que
 * un punto sobre un limite puede satisfacer a dos; sobre un borde compartido no
 * existe una respuesta correcta, lo exigible es que sea siempre la misma.
 *
 * Funcion pura: sin estado, sin red, sin `window`. Corre igual en el navegador
 * que en Node bajo Vitest.
 */
export function resolverZona(lat: number, lng: number): Zona | null {
  for (const zona of ZONAS) {
    if (contiene(lat, lng, zona.anillo)) return zona;
  }
  return null;
}
