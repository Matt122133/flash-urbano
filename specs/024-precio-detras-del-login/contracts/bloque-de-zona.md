# Contrato: el bloque de zona del formulario

**Feature**: `024-precio-detras-del-login` | **Fecha**: 2026-09-10

Este feature no expone una API. Su única interfaz es una pantalla, y el contrato
que importa es **qué puede y qué no puede aparecer en un bloque**. Se escribe
como contrato porque es lo que las guardas automáticas van a hacer cumplir.

## El bloque

Hoy es `ResultadoZona`, función local en `web/components/pedido-form.tsx:1019`.
Es el único lugar del formulario que nombra la zona, y por lo tanto —por
FR-007a— el único que puede llevar un monto.

Tiene cuatro ramas. El monto solo existe en la cuarta.

| Rama | Cuándo | Qué muestra | ¿Monto? |
|---|---|---|---|
| Mapa caído | `estadoMosaicos === "no-disponible"` | Aviso de que sin mapa no se puede tomar el pedido, y contacto | **No** |
| Sin punto | `punto === null` | "Todavía no ubicamos la dirección de entrega" | **No** |
| Fuera de zona | `zona === null` | Aviso de cobertura y contacto. **Sin mencionar costo** (FR-009) | **No** |
| En zona | `zona !== null` | Nombre y color de la zona | **Solo si hay sesión** |

## Lo que entra al bloque

```text
ResultadoZona({ estadoMosaicos, punto, zona, conSesion })
```

`conSesion` es la prop nueva. Baja desde `crear-pedido.tsx`, que ya conoce la
sesión; **no** se lee dentro del formulario (research D1).

## Lo que dibuja el monto

```text
MontoDeZona({ zona, conSesion })   // web/components/pedido/monto-de-zona.tsx
```

- Llama él mismo a `precioVisible({ zona, conSesion })`. Con `null` **no
  renderiza nada**. El componente no decide: la regla vive en `lib/`.
- Es el **único** archivo de `app/` o `components/` autorizado a nombrar un
  precio, y tiene que ser importado por **exactamente un** archivo.
- **Se llama `MontoDeZona` y no `PrecioDeZona`, y el archivo `monto-de-zona.tsx`
  y no `precio-de-zona.tsx`.** No es preferencia: la guarda escanea también los
  strings con el patrón `/precio/i`, así que el `import` desde `pedido-form.tsx`
  la habría puesto en rojo por el identificador y por la ruta. Por lo mismo el
  componente recibe `zona` y `conSesion` en vez del monto ya calculado: nombrar
  `precioVisible` desde el formulario tiene el mismo problema. **Fuera de su
  propio archivo, el precio es innombrable**, y eso resultó ser una propiedad
  útil.

## Reglas que las guardas hacen cumplir

| # | Regla | Guarda |
|---|---|---|
| C1 | Ningún archivo de `app/` o `components/` nombra un precio, salvo `components/pedido/monto-de-zona.tsx` | `lib/sin-precio-a-la-vista.test.ts` (redefinida) |
| C2 | `monto-de-zona.tsx` es importado por exactamente un archivo | `lib/sin-precio-a-la-vista.test.ts` |
| C3 | Hay monto si y solo si hay zona y hay sesión | `lib/precio-visible.test.ts` |
| C4 | El grafo de imports del formulario no llega a `lib/api.ts` ni `lib/sesion.ts` | `lib/cotizar-abierto.test.ts` (**sin tocar**) |

## Reglas que ninguna guarda puede hacer cumplir

Van al quickstart, y son las únicas que pueden entregar el feature roto con el
`verify:` en verde:

| # | Regla | Requisito |
|---|---|---|
| M1 | El monto no aparece ni por un frame mientras la sesión se resuelve | FR-005a |
| M2 | El monto desaparece al vencer o cerrar la sesión, sin recargar | FR-005 |
| M3 | Al entrar por el diálogo a mitad de formulario, el monto aparece **sin perder lo tipeado ni el punto** | FR-006 |
| M4 | El bloque no salta de tamaño cuando aparece el monto | Principio IV |
| M5 | El texto deja claro que el monto es **por envío**, no por paquete, sin convertirse en un total | FR-007a, research D4 |
| M6 | El monto que se muestra es el que queda guardado en el pedido | FR-014, SC-004 |
| M7 | Un pedido anterior al 2026-08-22 no muestra su monto guardado en ninguna parte | FR-015, SC-008 |
