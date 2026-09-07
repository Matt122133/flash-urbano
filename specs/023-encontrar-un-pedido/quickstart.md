# Quickstart: Encontrar un pedido entre muchos

Lo que el `verify:` **no** puede decidir. Todo esto se hace a mano, en el
navegador, y lo importante es el telefono.

## Prerequisitos

- `022` mergeado y esta rama rebasada sobre `master` (ver el plan).
- Backend local y sitio arriba: `cd backend && ./dev.sh` y `cd web && npm run dev`.
- Una cuenta con **al menos 12 pedidos**, y entre ellos: dos o tres
  **pendientes**, uno **aceptado**, varios **entregados**, y dos destinatarios
  cuyo nombre se parezca (para ver que la busqueda discrimina).
- **Uno de los destinatarios tiene que llevar tilde** en el nombre.

## 0. Sin tocar nada (FR-012, SC-005)

Antes de probar ningun filtro:

1. Entrar a `/perfil?ver=pedidos` y **no tocar nada**.
2. La lista se ve como antes de este feature: los 5 mas recientes, el "Ver todos"
   con su conteo, y las tarjetas con sus acciones.
3. **No hay ningun control en naranja.** Sin filtro puesto, nada esta puesto.

Este paso existe porque FR-012 se cumple por omision, y lo que se cumple por
omision es lo que se rompe sin que nadie lo note.

## 1. El corte por estado (US1, FR-001)

1. Entrar a `/perfil?ver=pedidos`.
2. Tocar **Pendientes**.
3. **Tiene que quedar puesto en naranja**, y los otros tres en contorno. Si hay
   dos controles naranjas a la vez, esta mal.
4. **Todos los pendientes se ven, sin tocar "Ver todos"** — aunque sean mas de
   cinco o esten mas abajo en la lista.
5. Mirar la URL: dice `?ver=pedidos&estado=pendientes`.

## 2. Que el filtro no se lo coma la otra vista (D2, el defecto que se busca)

1. Con **Pendientes** puesto, tocar **Mis datos**.
2. Volver a **Mis pedidos**.
3. **El filtro tiene que seguir puesto.** Si volvio a la lista completa, `irA()`
   piso el parametro y hay que arreglar D2.

## 3. Recargar y volver atras (FR-016)

1. Con el filtro puesto, **recargar** la pagina: sigue puesto.
2. **Boton de atras**: vuelve al estado anterior, sin filtro.
3. Entrar de nuevo desde el menu (*Mi cuenta*): **lista completa**. Esto es lo
   correcto — un filtro de hace tres dias no puede recibirte.

## 4. La busqueda (US2, FR-002 a FR-004)

1. Escribir parte de un nombre de destinatario: quedan solo los suyos.
2. Escribir el mismo nombre **sin la tilde** (o con ella, al reves): encuentra lo
   mismo.
3. Buscar por codigo de tres formas —`142`, `fu-0142`, `FU-0142`— y llegar al
   mismo pedido.
4. Buscar **una calle** de una entrega: **no encuentra nada**, y esta bien
   (decision del 2026-09-06).
5. **Recargar con texto escrito**: el texto se pierde y no aparece en la URL.
   Es FR-017: ese texto puede ser el nombre de un tercero.

## 5. Los dos vacios (FR-006), que es donde esto se rompe feo

1. Con una cuenta **sin ningun pedido**: dice "Todavia no hiciste ningun envio" e
   invita a crear el primero.
2. Con pedidos, buscar algo que no exista (`zzzz`): dice que **no hay
   coincidencias** y ofrece volver a la lista completa. **Si aca aparece "todavia
   no hiciste ningun envio", el feature esta mal**: le esta diciendo a alguien
   que perdio sus pedidos.

## 6. El filtro y las acciones de `022` (FR-008)

1. Poner **Pendientes**.
2. **Dar de baja** uno de la lista.
3. El pedido desaparece, **el filtro sigue puesto**, y el conteo baja en uno.
4. Con **Editar** sobre otro: se abre el formulario cargado; al volver, el filtro
   sigue puesto.
5. Sobre un resultado filtrado, tocar tambien **Repetir** y **Imprimir la
   etiqueta**: FR-013 dice que encontrar un pedido no puede costarle ninguna de
   las acciones que ya tenia, y son cuatro botones, no dos.

## 7. En el telefono (Principio IV)

1. Abrir la lista en un telefono de verdad.
2. Los cuatro cortes **entran sin scroll horizontal** y se pueden tocar con el
   pulgar (48 dp de alto minimo, el mismo piso que `015` le puso a la app).
3. Con el teclado abierto para buscar, **la lista sigue viendose**: si el teclado
   la tapa entera, la busqueda no sirve para nada.

## 8. Con el servicio caido (FR-011)

1. Cortar el backend (`Ctrl+C` en `dev.sh`) y recargar la pantalla.
2. **No se dibuja ningun control de filtro.** Se ve el aviso de error y su
   boton de reintentar, que es lo unico que sirve en ese momento.

## 9. El cronometro (SC-001)

El criterio que decide si esto sirve, y el unico que se mide con un reloj.

1. Con la cuenta de prueba cargada —**50 pedidos**, no doce—, pedirle a alguien
   que no construyo esto que encuentre uno del que solo se le dice el nombre de
   quien recibe.
2. **Menos de 15 segundos, y sin recorrer la lista con el ojo.**
3. Si tarda mas, el problema no es la persona: son los controles.
