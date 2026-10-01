---
ticket: none
status: active
covers:
  # La columna nueva, nulable, con CHECK de formato e indice unico parcial.
  - backend/migrations/
  # Paquete nuevo y puro: la lista, las reglas y `Elegir`. Sin base.
  - backend/internal/colores/
  # La asignacion en `GuardarPerfil`, en la transicion false -> true.
  - backend/internal/usuarios/
  # El JOIN, el campo no exportado, `ParaAdmin.ColorCliente`, y el PATCH de
  # estado que pasa a devolver `ParaAdmin`. Incluye la guarda de que el
  # cliente no recibe el color.
  - backend/internal/pedidos/
  # El modelo que lee `colorCliente` y la funcion que lo vuelve color.
  - android/app/src/main/java/uy/flashurbano/repartidor/datos/
  # SOLO `TarjetaPedido`: la franja. El resto de la tarjeta no se toca (FR-011).
  - android/app/src/main/java/uy/flashurbano/repartidor/pantallas/
  - android/app/src/test/java/uy/flashurbano/repartidor/
  # Como colorear a mano una cuenta existente, sin datos (FR-013, D6).
  - docs/processes/color-de-clientes.md
  - docs/README.md
  - .specify/feature.json
verify: cd backend && go vet ./... && go test ./... -p 1 && go build ./... && cd ../android && .\gradlew.bat assembleDebug testDebugUnitTest
analyzed: 2026-09-30
---

# Implementation Plan: El color de cada cliente en la tarjeta

**Branch**: `030-color-por-cliente` | **Date**: 2026-09-30 | **Spec**:
[spec.md](spec.md)

## Summary

Cada cuenta de cliente recibe **un color único** cuando se registra. Sale
primero de una lista curada de siete colores y, cuando la lista se agota, de un
generador que elige el color más lejano de todos los asignados. La app del
repartidor lo dibuja como una **franja de 6 dp en el borde izquierdo** de cada
tarjeta. Las cuentas existentes quedan sin color, y las tres cuentas reales se
colorean a mano con un procedimiento documentado sin datos.

Toca **dos superficies**, backend y app. **La web no se toca**: el color no se
muestra al cliente (FR-014), así que no entra en el `verify:`.

## Technical Context

**Language/Version**: Go 1.2x (`backend/`), Kotlin + Jetpack Compose
(`android/`)

**Primary Dependencies**: ninguna nueva. La conversión a OKLab son veinte líneas
de aritmética, y traer una librería de color para eso sería más superficie que
código (Principio III).

**Storage**: Postgres. Una columna nulable en `usuarios` y un índice único
parcial.

**Testing**: `go test` (las pruebas de base necesitan `TEST_DATABASE_URL`, o se
saltean solas), y JUnit en la JVM para Android (`testDebugUnitTest`).

**Target Platform**: Railway (servicio) y el Android de Diego, instalado a mano.

**Project Type**: servicio web + app móvil.

**Performance Goals**: sin metas nuevas. Hay un JOIN por clave primaria en una
lista que ya se lee entera, y un lock en el registro, que ocurre pocas veces por
mes.

**Constraints**: la tarjeta no crece (FR-010, decisión de `012`); una app vieja
sigue andando (FR-012); ningún dato de clientes reales en el repo (FR-013).

**Scale/Scope**: tres clientes reales hoy. La lista curada alcanza para siete, y
el generador separa bien hasta unos dieciséis (research D3).

## Constitution Check

- **Principio III (simplicidad)**: pasa. Una columna, un paquete puro y un
  dibujo en la tarjeta. Lo único que podría parecer de más es el generador, y
  es un requisito explícito (FR-004a), no una especulación.
- **Principio V (precio)**: no se toca. Nada lee `precio`, y el color no es un
  importe ni lo sugiere.
- **Scope boundaries, app de Diego**: la app sigue mostrando sus listas de
  trabajo; esto es una ayuda de lectura dentro de ellas.
- **Repo público**: FR-013 y el procedimiento de D6 mantienen fuera los datos
  de las tres cuentas.
- **Staging antes que producción**: el quickstart lo exige (sección 3).
- **Harness**: `covers:` nombra cada prefijo; `verify:` corre backend y Android,
  **con `.\gradlew.bat`**.

**Re-check post-diseño**: sin violaciones. No hace falta *Complexity Tracking*.

## Project Structure

### Documentation (this feature)

```text
specs/030-color-por-cliente/
├── spec.md
├── plan.md
├── research.md        # D1–D7
├── data-model.md
├── quickstart.md
├── contracts/
│   └── color-de-cliente.md
└── tasks.md           # /speckit-tasks
```

### Source Code

```text
backend/
├── migrations/0010_color_de_cliente.sql        # nuevo
├── internal/colores/                            # nuevo, puro
│   ├── colores.go         # Lista, Valido, Elegir, OKLab
│   └── colores_test.go
├── internal/usuarios/usuario.go                 # GuardarPerfil en transaccion
│   └── (pruebas de base de la asignacion)
└── internal/pedidos/
    ├── pedido.go          # JOIN usuarios, colorCliente, ParaAdmin.ColorCliente
    ├── handlers.go        # PATCH estado -> ParaAdmin
    └── respuesta_cliente_test.go   # + el color no llega al cliente

android/app/src/
├── main/java/uy/flashurbano/repartidor/
│   ├── datos/Pedido.kt              # colorCliente, colorDeCliente()
│   └── pantallas/Principal.kt       # franja en TarjetaPedido
└── test/java/uy/flashurbano/repartidor/datos/
    ├── PedidoTest.kt
    └── ColorDeClienteTest.kt        # nuevo

docs/processes/color-de-clientes.md              # nuevo, sin datos
```

**Structure Decision**: la paleta vive en el backend, que es quien asigna. La app
no conoce la lista: recibe un hex y lo dibuja. Si se agrega un color, **no hay
que publicar un APK**.

## Decisiones que el plan tomó y conviene mirar antes de aprobar

1. **Se excluye también el verde** (el de "entregado"), y por eso la lista tiene
   **siete** colores y no diez. FR-003 ya lo dice (research D2).
2. **El color se asigna en la transición `perfil_completo false → true`**, no
   "cuando el color es nulo". Con la regla simple, la primera cuenta de prueba
   que editara su perfil habría recibido color (research D4).
3. **`PATCH /admin/pedidos/{id}/estado` pasa a devolver `ParaAdmin`**, o la franja
   desaparece al tocar "Lo tengo" (research D7).
4. **La franja se dibuja sobre el contenido y no ocupa lugar.** También pasa por
   el costado de la franja de acción; si en el teléfono se ve mal, se corta ahí
   (research D5).

## Complexity Tracking

Sin violaciones que justificar.
