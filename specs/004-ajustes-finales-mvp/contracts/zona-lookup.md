# Contrato — `web/lib/zona-lookup.ts`

El módulo que decide cuánto se cobra. Su firma pública **no cambia** en este
feature; cambia la garantía que da, y la garantía es lo que hay que escribir,
porque es lo único que distingue "cobra bien" de "cobra bien por ahora".

## Firma

```ts
resolverZona(lat: number, lng: number): Zona | null
```

Función pura: sin estado, sin red, sin `window`. Corre igual en el navegador que
en Node bajo Vitest.

## Garantías

1. **Fuera de las cinco zonas devuelve `null`.** `null` significa *fuera de
   cobertura*: no es un error ni un "todavía no sé". Nunca se devuelve la zona
   más cercana — adivinar una zona es adivinar un precio, y el precio es en
   firme. *(FR-023, Principio V.)*
2. **Si una sola zona contiene el punto, devuelve esa.**
3. **Si más de una zona contiene el punto, devuelve la de menor `precio`.**
   *(FR-020.)* Esta es la respuesta del cliente a la pregunta de qué zona paga
   una dirección que cae sobre la avenida que separa dos zonas: **la de menor
   costo**. No es una convención del código.
4. **El resultado no depende del orden de la lista de zonas.** *(FR-021.)*
5. **Si dos zonas que contienen el punto tienen el mismo `precio`, devuelve la
   de menor `id`.** *(FR-022.)* Existe porque hoy hay dos zonas a $250 y la
   regla del cliente no las distingue; lo exigible entonces es que el mismo
   punto dé siempre el mismo precio.
6. **Es determinista.** El mismo par `(lat, lng)` devuelve siempre la misma
   zona, en la misma corrida y entre corridas.

## Lo que la garantía 4 exige de la implementación

La regla tiene que poder probarse contra una lista de zonas **donde la más
barata no sea la primera**. Con las cinco zonas reales eso es imposible: están
ordenadas por id y sus precios resultan crecientes (150, 200, 250, 250, 350).
Probar solo contra ellas no verificaría nada — pasaría igual una implementación
que devolviera "la primera que contenga".

Por eso la lógica de selección debe aceptar la lista de zonas **por parámetro**,
con `resolverZona()` como envoltorio delgado sobre la constante `ZONAS`. Es la
diferencia entre una prueba y una tautología. Ver research R2.

## Anti-garantías

Cosas que el módulo **no** promete, escritas para que nadie las asuma:

- No promete que el punto esté dentro de la cuadra declarada. Eso lo acota
  `direcciones.ts` y lo revalida el formulario.
- No promete que exista precio para toda dirección de Montevideo. El área de
  cobertura son cinco polígonos y afuera no hay pedido.
- No promete nada sobre la dirección de **entrega**. El precio sale del retiro y
  de ningún otro lado.

## Cambio respecto del estado anterior

El comentario actual del módulo dice que sobre un borde compartido "no existe
una respuesta correcta, lo exigible es que sea siempre la misma". **Eso dejó de
ser cierto**: el cliente dio la respuesta correcta el 2026-08-06. El comentario
tiene que reescribirse, no solo el código — un comentario que dice "esto es
arbitrario" sobre una regla de negocio invita a cambiarla sin preguntar.
