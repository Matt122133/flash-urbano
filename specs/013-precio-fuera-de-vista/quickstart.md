# Quickstart — `013` El precio sale de la vista

Lo que `verify:` **no** puede demostrar. `verify:` corre lint, pruebas y build
de `web/`: prueba que el código compila y que la guarda automática de FR-020
está en verde. **No prueba que el sitio se vea bien, ni que el pedido siga
llegando entero al servicio.** Eso es lo de acá abajo, y es a mano.

## Nivel 1 — desde la sesión, sin nadie más

### Q1. Ninguna pantalla muestra un monto

```bash
cd web
npm run dev
```

Recorrer, con el navegador, **en este orden**:

1. `/` — la portada. El llamado a la acción dice *Ver zonas*, no *Ver zonas y
   precios*.
2. `/sobre-nosotros` — el mapa está, con las cinco zonas pintadas y
   distinguibles. La leyenda lista las cinco con color y nombre. **Ningún
   monto.** Pasar el cursor por cada polígono: el globo dice `Zona N` y nada
   más.
3. `/sobre-nosotros`, la tabla de horarios — el sábado dice *A coordinar*.
4. `/pedido` — el copy no promete un precio.
5. `/pedido`, completo — dos direcciones, marcar un punto de entrega dentro de
   una zona. Donde antes salía `$ 250` sale la confirmación de cobertura con el
   nombre de la zona. El resumen dice `Zona 3`, sin monto.
6. `/pedido` — mover el pin a otra zona cubierta. **No aparece ningún aviso de
   cambio de precio.**
7. `/mis-pedidos` con al menos un pedido viejo que tenga monto guardado — la
   tarjeta no lo muestra.
8. Repetir ese pedido — no aparece ningún aviso de reajuste.

**Esperado**: cero cifras de dinero en las ocho. Si aparece una, la guarda de
FR-020 no la atrapó y hay que ampliarla antes de arreglar la pantalla — si no,
vuelve.

### Q2. Fuera de zona sigue sin producir pedido

En `/pedido`, marcar un punto fuera de las cinco zonas (por ejemplo al oeste de
Ruta 5, más allá del límite dibujado).

**Esperado**: no se puede confirmar, y el mensaje encamina al contacto **sin
mencionar costo**. Nunca se ofrece una zona cercana.

### Q3. La guarda de FR-020 sabe fallar

**Esto no es opcional y no se reemplaza por leer el código.** Una prueba que
afirma que algo no pasa vale lo que valga la demostración de que sabría
detectarlo.

1. Volver a poner un monto a mano en `components/pedido/tarjeta-pedido.tsx` —
   por ejemplo `$ {pedido.precio}`.
2. `npm test`.
3. **Esperado: rojo**, y el mensaje tiene que decir qué archivo.
4. Deshacer.
5. `npm test` → verde.

### Q4. Los cinco anillos cierran después de regenerar

```bash
cd web
node design-source/build-zonas.js design-source/zonas-flash-urbano.kml lib/zonas.ts
npm test
```

**Esperado**: el generador no se queja, y la prueba que verifica el cierre de
los anillos pasa. Mirar además que el diff de `lib/zonas.ts` toque **solo la
Zona 5**: si toca otra, el KML trae más cambios de los que se creía.

### Q5. El formulario sigue vivo con el servicio caído

Con el backend **apagado**, abrir `/pedido`: se tiene que poder escribir las dos
direcciones, resolver el cruce y marcar el punto. Recién *Confirmar* falla.

**Esperado**: todo funciona hasta confirmar. Es FR-019, y `cotizar-abierto.test.ts`
lo guarda de forma estática; esto comprueba el comportamiento.

## Nivel 2 — contra el servicio, mirando la base

**Este es el que `verify:` no puede hacer, y es el que demuestra FR-015.**

### Q6. El pedido sigue llegando con su cobro, y se sigue guardando

Con el backend local levantado y `TEST_DATABASE_URL` puesto:

1. Crear un pedido desde el sitio, de punta a punta, con sesión iniciada.
2. Mirar la fila en Postgres:

```sql
SELECT id, zona_id, precio, creado_en
FROM pedidos
ORDER BY creado_en DESC
LIMIT 1;
```

**Esperado**: `zona_id` y `precio` **poblados**, con el precio de la zona donde
cayó el punto de entrega. Si vinieran en `0` o nulos, este feature rompió
FR-015: sacó el dato además de la vista, que es exactamente lo que la decisión
dijo que no había que hacer.

3. Abrir la app de Diego y mirar ese pedido. **Esperado**: aparece, se puede
   mover de estado, y **no muestra ningún monto** (FR-016).

## Nivel 3 — con el cliente

### Q7. Que Diego lo mire

Que abra el sitio y confirme que es lo que pidió: que el precio no está en
ningún lado, y que el mapa sigue dejando claro que las zonas son distintas y
cuáles se trabajan.

**Es la única comprobación que puede decir que el feature acertó**, porque el
pedido fue suyo y el criterio también.
