# Quickstart: Repartidores

Lo que el `verify:` no prueba: que se usa. Se corre **en staging** antes del PR a
`master` (`docs/processes/staging.md`), y la parte de la app **en el emulador**
con `adb -s` (el APK de debug pisa el de produccion en el telefono).

## Preparacion

- Staging con `REPARTIDOR_EMAILS` = una cuenta de prueba de Mateo (no va al
  repo). `ADMIN_EMAILS` de staging es la cuenta de Mateo.
- Dos sesiones de la app: el telefono de Mateo (admin) y el emulador con Play
  Store (repartidor, recibe push de verdad).
- Al menos tres pedidos de prueba creados desde la web de staging.

## Escenarios

| # | Paso | Esperado | Cubre |
|---|---|---|---|
| Q1 | Admin abre la app | Esta en **Mios**, ve los tres pedidos | US1-1, US1-5, SC-007 |
| Q2 | Admin asigna uno al repartidor | Sale de Mios, sigue en Todos con el nombre | US1-2 |
| Q3 | En el emulador, con la app cerrada | Llega "Nuevo paquete asignado" con el codigo | US3-1, SC-004 |
| Q4 | Repartidor abre la app | Ve ese pedido y ningun otro; no hay chips ni "Asignar" | US2-1, US2-3 |
| Q5 | Repartidor lo toma y lo entrega con nombre | Admin lo ve entregado en Todos | US2-2 |
| Q6 | Admin intenta reasignar el entregado | No se ofrece / 409 con texto legible | US4-4, FR-010b |
| Q7 | Repartidor deshace la entrega y lo devuelve | Vuelve a Mios del admin | US2-6, D3 |
| Q8 | Con `curl` y la credencial del repartidor, `PATCH` de un pedido ajeno | 404, mismo texto que un id inventado | US2-5, SC-003 |
| Q9 | Admin desasigna un pedido del repartidor | Desaparece de su lista al recargar, sin aviso | US1-6, FR-017a |
| Q10 | Tablero web → Repartidores, elegir al repartidor, mes actual | Cuenta solo lo entregado por el; descarga sin importes | US4-1, US4-3, US4-5 |
| Q11 | Sacar el mail de `REPARTIDOR_EMAILS` y redeploy | Sus no entregados vuelven a Mios; en el tablero sigue elegible y su mes baja completo | FR-011, US4-7 |
| Q12 | Cuenta que no es ni admin ni repartidor entra a la app | Rechazo como hoy | US2-4 |
| Q13 | App **vieja** (`v0.5.0`) contra el servicio nuevo | Lista completa, sin errores | research D5 |
| Q14 | Textos de la tarjeta a 360 dp, con la fuente grande | Ningun boton cortado | lo que el `verify:` no ve |

Q11 se hace al final: deja staging sin repartidor.
