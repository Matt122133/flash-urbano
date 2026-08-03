# Quickstart — validar el feature

**Feature**: `specs/002-mapa-zonas-precio` | **Date**: 2026-08-02

Cómo comprobar que el feature quedó bien. Los pasos automáticos son el `verify:`
del plan; el resto es manual porque toca cosas que ningún test barato cubre —
en particular que los límites caigan sobre las calles correctas, de lo que
depende cuánto se le cobra a una persona.

## Prerrequisitos

- Node ≥20, dependencias instaladas (`cd web && npm install`).
- El KML del cliente en `web/design-source/zonas-flash-urbano.kml`.

## Regenerar el dato de zona

```bash
cd web
node design-source/build-zonas.js \
  design-source/zonas-flash-urbano.kml \
  lib/zonas.ts
```

Esperado: escribe `web/lib/zonas.ts` con las cinco zonas, nombres normalizados
(sin el espacio duro de "Zona&nbsp;&nbsp;4") y los precios 150/200/250/250/350.
Ante un anillo abierto o una zona faltante **tiene que fallar**, no emitir a
medias.

Solo hace falta correrlo si cambió el KML; el archivo generado se commitea.

## Automático — el `verify:` del plan

```bash
cd web && npm run lint && npm test && npm run build
```

Los tres tienen que quedar verdes. `npm test` corre `web/lib/zona-lookup.test.ts`,
que cubre lo listado en [contracts/zonas.md](contracts/zonas.md) § 2 — un punto
interior por zona, dos casos fuera de cobertura, el determinismo sobre un borde
compartido, los precios y el cierre de todos los anillos.

## Manual — mirar el sitio

```bash
cd web && npm run dev
```

### `/sobre-nosotros` — US2

1. El mapa reemplaza al JPEG: se ven las cinco zonas sobre calles reales, cada
   una diferenciada, con leyenda de precios **en texto real, fuera del mapa y
   siempre visible** (FR-007). Sin eso el cambio sería una regresión de
   accesibilidad: la imagen que se borra describía las zonas en su `alt`.
2. Zoom y desplazamiento andan, y las zonas siguen alineadas con las calles.
3. **La atribución de OpenStreetMap está visible.** No es cosmético: es
   condición de la licencia (FR-008).

### `/pedido` — US1, US3, US4

4. El bloque de dirección dice claramente que es el **de retiro**, y hay un
   segundo bloque para el **destino** (US4).
5. Tocar un punto dentro de una zona muestra la zona y su precio. Mover el
   marcador los actualiza. **Cronometrar acá SC-001**: desde llegar al mapa
   hasta ver el precio, en celular y sin ayuda, tienen que ser menos de 15
   segundos medidos.
6. Marcar un punto fuera de las cinco zonas: aparece el aviso de fuera de
   cobertura, **ningún precio**, y el envío queda bloqueado con vía de contacto
   a mano.
7. Intentar enviar sin marcar punto: se señala como campo obligatorio faltante,
   igual que cualquier otro (FR-011).
8. "Usar mi ubicación" con el permiso concedido centra y marca. **Negándolo**,
   el sitio lo informa sin romperse y el marcado manual sigue disponible
   (US3).
9. Enviar un pedido válido: la confirmación muestra zona y precio junto al
   resto, y los dos domicilios por separado.

### Mosaicos caídos — FR-020, SC-005

10. Con DevTools, bloquear las requests a `tile.openstreetmap.org` y recargar
    `/pedido`. Esperado: aviso explicando qué pasó y cómo contactar; **el
    pedido no se puede enviar**; en ningún momento un mapa vacío en silencio ni
    un precio sin punto marcado.
11. Lo mismo en `/sobre-nosotros`: **no** bloquea nada, explica que el mapa no
    cargó, y las zonas y precios siguen legibles porque la leyenda de texto es
    permanente, no un fallback.

### Mobile — FR-019, SC-006

12. Emular 375px. Colocar el marcador con el pulgar: se puede desplazar, hacer
    zoom y marcar sin que el gesto secuestre el scroll de la página.
13. Repetir en ≥1280px.

## Manual — que los límites caigan donde deben (SC-004)

El más importante y el que ningún test cubre. Con el mapa a la vista, recorrer
los tramos contra `spec.md` § Límites de zona y confirmar que cada uno corre
sobre su calle:

| Arteria | Separa |
|---|---|
| Ruta 102 | norte de Zona 2 y Zona 4 |
| Ruta 5 | oeste de Zona 2 / Zona 3 |
| Cno. Ramírez / La Teja | suroeste, Zona 3 contra Zona 1 |
| Av. Aparicio Saravia | Zona 2 de Zona 1 |
| Av. Garzón | oeste de Zona 1 |
| Av. José Belloni | este de Zona 1 |
| Irigoyen | continuación sur del este de Zona 1 |
| Cno. Maldonado | oeste de Zona 4 |
| Cno. Carrasco | sur, Zona 1 con Zona 4 |
| Av. de las Américas / Ruta 101 | Zona 4 de Zona 5 |

**Empezar por Zona 5**: es la más cara, así que un tramo corrido ahí es el error
más caro.

Si un tramo no coincide, el defecto está en el polígono, no en la calle — la
calle es la definición. Se corrige reexportando el KML y regenerando; no se
toca código.

## Export estático — el mismo modo que producción

```bash
cd web && GITHUB_PAGES=true npm run build && npx serve out
```

Sirve el sitio bajo `basePath` `/flash-urbano`. Confirmar que el mapa carga y
que **el marcador se ve** — es la falla que evita usar `divIcon` en vez del
icono por defecto de Leaflet (research D5), y solo se manifiesta en este modo,
no en `npm run dev`.
