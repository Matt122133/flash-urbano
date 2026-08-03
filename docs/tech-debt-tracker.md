---
owner: flash-urbano
status: living
last_reviewed: 2026-08-02
update_trigger: on-debt-added-or-resolved
---

# Tech debt tracker

Running ledger of known hazards, work-in-progress shortcuts, and deferred
improvements. Maintained per the harness steering loop (see
[`processes/harness.md`](processes/harness.md)).

## How this works

Each row is one item. New items go at the top of the relevant section.

- **Severity.** `High` (active hazard or correctness risk), `Medium` (hurts
  velocity or clarity), `Low` (cosmetic or speculative).
- **Status.** `Open`, `In progress`, `Resolved`, `Dropped`.
- **Description.** What the debt is, in one sentence.
- **Resolution.** How it was paid, with a commit/plan/ADR reference where
  useful. Empty while `Open`.

## Open

| Date identified | Severity | Description |
|---|---|---|
| 2026-08-02 | Medium | **Se pide la misma información dos veces en el formulario de pedido**: calle + número + esquina escritos, y además marcar el punto en el mapa. Son el mismo dato, y eso choca con el Principio IV (mínimo tipeo). Lo detectó el dueño del repo probando el MVP. La solución que quiere es geocodificación en ambos sentidos (dirección → punto para el precio; punto → calle y número aproximado para el timbre). Va a `specs/003-*` con ADR propio, porque **reversa** la decisión de `002` de no depender de servicios externos. Alternativa a evaluar que evitaría el servicio externo: **cruce de calles** — el formulario ya pide calle y esquina, y con la geometría de calles servida desde el propio sitio se puede calcular la intersección con precisión de cuadra, que alcanza porque los límites de zona son avenidas. Lo que ninguna de las dos vías da con precisión es el número de puerta. |
| 2026-08-02 | Low | `web/vitest.config.ts` dispara un warning de Vite: usa sintaxis ESM en un archivo que se carga como CommonJS. Es un aviso sobre un default **futuro** de Vite, no un error, y `npm test` funciona. El arreglo documentado es renombrar a `.mts` o poner `"type": "module"` en `package.json`. No se hizo en `002` porque `.mts` caía fuera del `covers:` de ese plan y el warning es cosmético. Resolver la próxima vez que se toque el toolchain. |
| 2026-08-02 | Medium | En `web/components/pedido-form.tsx`, el mensaje de error del nombre de quien recibe **nunca se muestra**: `validate()` escribe la clave `recieverName` (con la `i` traspuesta) y el render lee `errors.receiverName`. El campo sí bloquea el envío, así que no se cuela un pedido incompleto, pero el usuario no ve por qué. Detectado al planificar `specs/002-mapa-zonas-precio/`; **no se arregló ahí** porque queda fuera de los pasos de ese plan (`AGENTS.md`: nada de limpieza oportunista). Arreglo: unificar la clave en las dos puntas. |
| 2026-08-01 | Low | `web/package.json` usa `overrides` para forzar `sharp@^0.35.3` y `postcss@^8.5.25` por encima de lo que declara `next@16.2.12` (`sharp ^0.34.5`, `postcss` pineado en `8.4.31`), que arrastraban advisories de libvips y de PostCSS. `npm audit` queda en 0. Revisar y **quitar los overrides** cuando Next publique una versión que ya traiga esas deps parcheadas — mantenerlos de más nos deja resolviendo versiones que Next no testeó. Verificar con `npm audit` + `npm run build` + una request a `/_next/image` (es lo que ejercita sharp). |

## Resolved

| Date identified | Severity | Description | Resolution |
|---|---|---|---|
| 2026-08-02 | High | El sensor de cobertura del harness crasheaba con `exit 1` en Windows, o sea que **rechazaba todo commit**: `subprocess.run(text=True)` sin `encoding` decodifica con el codec del sistema (cp1252), y cualquier plan con acentos lo hacía explotar. Los artefactos de este repo están en español, así que afectaba a todos. | Arreglado en `scripts/harness/check_plan_coverage.py`: se fuerza `encoding="utf-8", errors="replace"` en las tres llamadas a `subprocess.run`. `--selftest` pasa sus 8 casos. Detectado al intentar el primer commit de `002`. **Es un bug del scaffold `init-harness-speckit`, no solo de este clone** — conviene reportarlo aguas arriba. |
| 2026-08-01 | Medium | Los límites de zona del mapa de `/sobre-nosotros` son una **interpretación**, no un dato validado: las líneas que trazó el cliente son polilíneas abiertas, y para pintar las zonas hubo que cerrar los extremos (ver `web/design-source/README.md`). Las zonas 3 y 5 se cortan en el borde de la captura. Como cada zona define un precio, **pedirle al cliente que confirme los límites** antes de que el mapa se use como referencia de cobro. Regenerable con `node design-source/build-map.js`. | Retirada por `specs/002-mapa-zonas-precio/`: el cliente definió los límites por nombre de calle, los validó, y las zonas pasaron a ser geometría real en `web/lib/zonas.ts`. Los límites ya no son una interpretación. |
| 2026-08-01 | Low | La base del mapa de zonas es una captura de Google Maps modificada y publicada sin atribución en un sitio comercial, lo que no cumple los términos de Google. Sirve para el MVP; si el mapa queda a largo plazo, rehacerlo sobre tiles de OpenStreetMap (permiten uso comercial citando la fuente). | Retirada por `specs/002-mapa-zonas-precio/`: el mapa se rehizo sobre mosaicos de OpenStreetMap con la atribución visible. Precisión que quedó documentada en `research.md` D2: ODbL cubre los *datos*; los *servidores* de mosaicos tienen su propia política de uso, orientada a volumen bajo. |
