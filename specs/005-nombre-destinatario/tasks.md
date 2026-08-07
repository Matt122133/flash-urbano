---
description: "Task list for 005-nombre-destinatario"
---

# Tasks: Nombre de quien recibe el paquete

**Input**: [plan.md](plan.md), [spec.md](spec.md)

**Tests**: sin pruebas automáticas nuevas. `pedido-form.tsx` no tiene entorno de
DOM y montárselo es un feature aparte (ver Riesgos del plan). La verificación del
campo es manual y está en T004.

## Phase 1: User Story 1 - Se sabe a nombre de quién va el paquete (P1) 🎯

- [ ] T001 [US1] En `web/components/pedido-form.tsx`, agregar `receiverName` a `FormState` y a `INITIAL_STATE`.
- [ ] T002 [US1] Agregar la regla en `validate()`: no vacío después de `trim()`, con el mensaje "Ingresá el nombre de quien recibe.". **La clave es `errors.receiverName`.**
- [ ] T003 [US1] Agregar el `<Field>` en la sección "¿Quién recibe el paquete?", **antes** del teléfono, dentro de la grilla existente, leyendo `errors.receiverName`. **Comparar esta línea con la de T002 carácter por carácter antes de seguir**: el defecto que este campo cargaba durante dos features era exactamente una discrepancia entre estas dos claves.
- [ ] T004 [US1] Actualizar la fila del resumen de confirmación para que muestre el nombre junto al teléfono.
- [ ] T005 [US1] Verificar a mano en viewport de teléfono: dejar el nombre vacío, tocar Confirmar, y **ver el mensaje debajo del campo**. Después cargar un pedido completo y revisar que el resumen muestre nombre y teléfono, y ninguna cédula.

## Phase 2: Cierre

- [ ] T006 Enmendar `.specify/memory/constitution.md`: en *Scope boundaries*, de quien recibe se piden **nombre y teléfono**. Subir a **2.2.0** (`Version` y `Last Amended`) y agregar la entrada al historial explicando que `004` quitó nombre y cédula y que el cliente después repuso el nombre.
- [ ] T007 Correr `verify:`: `cd web && npm run lint && npm test && npm run build`.
- [ ] T008 Confirmar que la cédula no volvió: `grep -rn "recieverCI\|receiverCI\|cedula\|Cédula" web/components/ web/lib/` desde la raíz, sin resultados.
- [ ] T009 Cerrar: `specs/005-nombre-destinatario/plan.md` a `status: completed`, **después de commitear** — el sensor de cobertura solo autoriza mientras el plan está `active`.

## Dependencies

Secuencial: T001 → T002 → T003 → T004, todo en el mismo archivo. T006 es
independiente y puede ir antes o después. T007–T009 al final.

## Notes

- El riesgo entero del feature está en T003. El resto es mecánico.
- No se toca nada del precio, las zonas ni las direcciones.
