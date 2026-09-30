# Quickstart: comprobar que el color por cliente funciona

**Que compile no prueba nada de la tarjeta** (AGENTS.md). Las dos cosas que
importan, que la franja se vea y que no agrande la tarjeta, se miran en un
emulador o en el teléfono.

## 0. Antes

- Docker Desktop levantado y `TEST_DATABASE_URL` definida, o las pruebas de
  base **se saltean solas**. Mirar el conteo de `SKIP` en `go test -v`, no sólo
  que termine en verde (`backend/README.md`).
- Para mirar la app, **emulador y `adb -s`**, no el teléfono de Diego:
  `installDebug` pisa la app de producción.

## 1. Pruebas automáticas (el `verify:`)

```
cd backend && go vet ./... && go test ./... -p 1 && go build ./...
cd ../android && .\gradlew.bat assembleDebug testDebugUnitTest
```

Lo que tienen que cubrir, además de lo que ya existe:

| Qué | Dónde |
|---|---|
| La lista cumple las reglas de D2, sin repetidos | `backend/internal/colores` |
| `Elegir` da el primero libre, después genera, nunca repite y es determinista | `backend/internal/colores` |
| Primer guardado del perfil → color; segundo guardado → mismo color | `backend/internal/usuarios` (base) |
| Una cuenta con el perfil ya completo que lo edita → sigue sin color | `backend/internal/usuarios` (base) |
| Dos registros en paralelo → dos colores distintos | `backend/internal/usuarios` (base) |
| El índice único rechaza un repetido escrito a mano | `backend/internal/usuarios` (base) |
| `GET /admin/pedidos` trae `colorCliente`; `GET /pedidos` no | `backend/internal/pedidos` |
| `PATCH …/estado` devuelve `colorCliente` | `backend/internal/pedidos` |
| `Pedido` se lee con y sin `colorCliente` | `PedidoTest.kt` |
| `colorDeCliente` acepta `#rrggbb` y devuelve `null` para basura | test JVM nuevo |

**Control positivo** (memoria del repo: una guarda negativa necesita uno):
romper a propósito la unicidad (sacar el lock **y** el índice) y ver la prueba
de registros en paralelo en **rojo**; después restaurarlos.

## 2. En el emulador, contra el backend local

1. Backend local con la migración aplicada y dos cuentas nuevas registradas por
   la web local (sus colores tienen que ser fucsia y cian), cada una con un
   pedido pendiente. Más un pedido de una cuenta vieja sin color.
2. Instalar el debug en el emulador y abrir **Pendientes**:
   - [ ] las dos tarjetas de cuentas nuevas tienen franjas de colores distintos;
   - [ ] la tarjeta de la cuenta vieja no tiene franja y se ve como antes;
   - [ ] **siguen entrando las mismas tarjetas por pantalla que antes del
     cambio** (comparar con una captura previa del mismo emulador; SC-003);
   - [ ] la franja no pisa texto.
3. Tocar **"Lo tengo"** en una tarjeta con franja: en **En curso**, la franja
   sigue ahí sin refrescar (research D7).
4. Abrir una tarjeta desde un aviso para que quede **destacada**: se leen el
   borde y la franja por separado (FR-009).
5. Editar el perfil de una de las cuentas nuevas desde la web: el color no
   cambia.

## 3. En staging

Ver `docs/processes/staging.md` (*Desplegar a staging* y *La app contra
staging*).

1. `railway up` al entorno de staging. Confirmar en `/salud` que responde
   `"ambiente":"staging"`.
2. Colorear a mano una cuenta existente de staging con el procedimiento de
   `docs/processes/color-de-clientes.md`, y comprobar que sus pedidos viejos
   aparecen con franja.
3. Registrar una cuenta nueva: recibe el siguiente color libre de la lista.
4. App apuntada a staging en el teléfono de Mateo: se repiten los pasos 2 a 4
   de la sección anterior, sobre una pantalla real.

## 4. En producción (después del merge)

1. Deploy desde `master`. `/salud` en verde.
2. Colorear **las tres cuentas reales** con el procedimiento documentado, con
   los tres primeros colores de la lista, en orden.
3. Publicar el APK (`docs/processes/app-repartidor.md`) y que Diego lo instale.
   **El feature está entregado cuando su teléfono muestra las franjas.**
4. Antes de commitear cualquier evidencia:
   `git diff master..HEAD | grep "^+" | grep -oE "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+"`
   tiene que salir vacío.
