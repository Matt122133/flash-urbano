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
 * La regla de seleccion, con la lista de zonas por parametro.
 *
 * Existe separada de `resolverZona` por una sola razon, y es de prueba: para
 * verificar que la regla NO depende del orden de la lista hace falta un caso
 * donde la zona mas barata no sea la primera, y con las cinco zonas reales eso
 * es imposible — estan ordenadas por id y sus precios resultan crecientes
 * (150, 200, 250, 250, 350). Probando solo contra ellas, una implementacion que
 * devolviera "la primera que contenga" pasaria igual. Ver research R2 de 004.
 */
export function resolverZonaEntre(
  zonas: readonly Zona[],
  lat: number,
  lng: number,
): Zona | null {
  let elegida: Zona | null = null;

  for (const zona of zonas) {
    if (!contiene(lat, lng, zona.anillo)) continue;
    if (
      elegida === null ||
      zona.precio < elegida.precio ||
      // Desempate por id cuando dos zonas comparten precio. Hoy pasa: las zonas
      // 3 y 4 salen las dos $250, y la regla del cliente no las distingue.
      (zona.precio === elegida.precio && zona.id < elegida.id)
    ) {
      elegida = zona;
    }
  }

  return elegida;
}

/**
 * Devuelve la zona que le corresponde al punto, o `null` si cae fuera de las
 * cinco.
 *
 * `null` significa **fuera de cobertura**: no es un error ni un "todavia no se".
 * Nunca se devuelve la zona mas cercana (FR-023 de 004) — adivinar una zona es
 * adivinar un precio, y el precio es en firme.
 *
 * **Cuando mas de una zona contiene el punto, gana la de menor precio**
 * (FR-020). Los poligonos comparten bordes y los limites los definio el cliente
 * por nombre de avenida, asi que sobre Bulevar Artigas, Avenida Italia o
 * 8 de Octubre hay puntos que dos zonas reclaman a la vez.
 *
 * Cuantos: **pocos**. Medido sobre una grilla de ~50 m en toda el area de
 * servicio, 16 puntos de 551.601 son reclamados por dos zonas — el ray casting
 * de abajo usa desigualdad estricta y eso manda casi todo el borde a una sola
 * zona. No es la franja ancha que se supuso al abrir el caso. Sigue importando
 * igual, por dos motivos: cada uno de esos puntos es una direccion que alguien
 * puede cargar, y la regla es lo que impide que un cambio de precios mueva el
 * resultado sin que nadie se entere.
 *
 * Cual de las dos cobra **es una respuesta del negocio, no una convencion de
 * este archivo**: el cliente contesto "la zona de menor costo" el 2026-08-06.
 * Antes de eso ganaba la primera de la lista, que daba el mismo resultado por
 * casualidad — los precios venian crecientes por id. No cambiar esto sin
 * preguntarle al cliente.
 *
 * Con precios empatados gana el id mas bajo (FR-022): la regla del cliente no
 * distingue entre dos zonas del mismo precio, y lo exigible entonces es que el
 * mismo punto devuelva siempre lo mismo.
 *
 * Funcion pura: sin estado, sin red, sin `window`. Corre igual en el navegador
 * que en Node bajo Vitest.
 */
export function resolverZona(lat: number, lng: number): Zona | null {
  return resolverZonaEntre(ZONAS, lat, lng);
}
