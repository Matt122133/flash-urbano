# Quickstart: La marca en la pestaña

**Feature**: `008-marca-en-la-pestana` | **Fecha**: 2026-08-12

## El `verify:` del plan

```bash
cd web && npm run lint && npm test \
  && GITHUB_PAGES=true npm run build \
  && ls out | grep -qE '^favicon\.ico$' && ls out | grep -qE '^icon\.'
```

Prueba que los iconos **lleguen al export**, que es lo que se publica (FR-006).
`npm run build` a secas no hace el export, así que un verde sin la parte de
`GITHUB_PAGES` no dice nada sobre producción.

**Lo que el `verify:` no puede probar**: que el icono se **lea**. Que un archivo
de 16×16 exista no es que alguien distinga un camión en él. Eso es todo lo de
abajo.

---

## Regenerar los iconos

```bash
cd web && node design-source/build-favicon.js
```

**SC-004**: borrar los tres archivos generados, correr eso, y que reaparezcan
iguales. Si el script no los reproduce, el feature dejó un binario huérfano —
que es exactamente lo que FR-007 prohíbe.

---

## Verificación manual

El favicon **se cachea con muchas ganas**. Todo lo de abajo va en **ventana
privada**, o con el caché forzado a limpiarse. Es el error clásico: comprobar
con satisfacción el icono anterior.

### V1 — Se lee a 16×16 (SC-002)

Abrir el `.ico` generado y **mirarlo al tamaño real, sin ampliar**. La pregunta
no es "¿se ve algo?" sino **"¿se distingue que es un camión?"**.

Si es una mancha, la salida es simplificar la silueta (plan D1), **no** dar el
criterio por cumplido porque el archivo existe.

### V2 — Las cuatro combinaciones (SC-001)

`npm run dev`, y mirar la pestaña en:

| | Tema claro | Tema oscuro |
|---|---|---|
| **Chrome** | ☐ | ☐ |
| **Firefox** | ☐ | ☐ |

Las cuatro. El tema claro es el que importa de verdad — es donde un camión
blanco sin fondo desaparecería, y es el motivo de la decisión D2.

### V3 — El teléfono (SC-003)

Desde un teléfono, agregar el sitio a la pantalla de inicio y comprobar que el
ícono es la marca y no una captura de la página.

### V4 — Ninguna pantalla cambió (SC-006)

`git diff --stat` no puede mostrar ningún archivo de `web/app/` que no sean los
iconos, ni nada de `web/components/`. El logo de la navegación queda igual: es
FR-008, y el sensor de cobertura ya lo impone.

### V5 — En producción

Después del despliegue, abrir `https://flashurbano.uy` en ventana privada.
Comprobar también `https://flashurbano.uy/favicon.ico` directo: es la URL que
los navegadores piden por su cuenta, sin mirar el HTML.
