# Quickstart: comprobar la etiqueta de 12 x 10

`verify:` prueba la **geometria**: que ningun elemento se salga del rectangulo,
que ningun cuerpo baje de su piso, que un pedido corriente no se achique. Eso es
nuevo en este feature y antes no existia.

**Lo que `verify:` sigue sin poder decir es si la hoja sirve.** Si 26 pt se leen
a un brazo, si el recorte da 12 x 10 de verdad, si la silueta impresa en mono
parece un camion o una mancha: eso es esto. Hace falta **una impresora, una
tijera y una regla**. No hay atajo: `020` compilaba perfecto y salio con dos
defectos de vista, y `012` hizo lo mismo en la app.

## Prerequisitos

```bash
cd web
npm install
```

Una impresora con papel A4, una tijera y una regla milimetrada.

---

## 1. Las pruebas

```bash
cd web
npm run lint && npm test && npm run build
```

### El control negativo de la guarda geometrica — no es opcional

La prueba nueva de FR-003 afirma que **nada se sale del rectangulo**. Una guarda
que afirma que algo *no* pasa esta verde tambien cuando dejo de mirar donde cree
que mira. Hay que romperla a proposito:

1. En `lib/etiqueta-maqueta.ts`, subirle el piso al comentario o bajarle el
   margen interno al rectangulo — cualquier cosa que empuje un elemento afuera.
   Lo mas rapido: cambiar el margen interno de 5 mm a 0.
2. `npm test` → **la prueba de FR-003 tiene que ponerse ROJA**, nombrando el
   elemento que se salio.
3. Deshacer.

Si queda verde con el margen en 0, la guarda no esta midiendo nada.

Hacer lo mismo con la de los pisos (FR-007): bajar un cuerpo por debajo de su
piso a mano y ver la prueba en rojo.

Y la de `020` sigue valiendo: meterle un importe a la estructura de la etiqueta y
ver la prueba de *sin precio* en rojo.

---

## 2. La hoja, impresa y recortada

El sitio se levanta con:

```bash
cd web
npm run dev
```

**Antes de levantarlo, mirar quien tiene el 3000.** Un `next dev` huerfano de una
sesion anterior contesta igual y sirve codigo viejo, y entonces esto comprueba la
etiqueta de ayer.

Cargar un pedido en `http://localhost:3000/pedido` con datos **corrientes**, no
con los maximos: nombre y direccion de largo normal, un comentario de un renglon
o dos. **Ese es el caso que este feature se comprometio a hacer bien** (FR-005), y
el que hay que mirar primero.

Confirmar, tocar **Imprimir resumen**, abrir el PDF e **imprimirlo al 100 %**
(*tamaño real* / *actual size*, **nunca** *ajustar a la pagina*).

### 2.1 Medir, antes de cortar

Con la regla, sobre el papel, de marca a marca:

- **120 mm de ancho y 100 mm de alto** (SC-001).
- Si da 115 x 96, la impresora escalo: es el modo de falla que el spec acepto
  cuando saco la linea de *"imprimir al 100 %"* de la hoja. **No es un defecto de
  la etiqueta.** Corregir la opcion de impresion y volver a medir.

### 2.2 Cortar

Recortar por las cuatro escuadras. Despues:

- **La etiqueta no tiene marco impreso** (SC-002). Si quedo una linea en el
  borde, se dibujo recuadro en vez de escuadras.
- **No quedo nada de la etiqueta del lado de afuera** (FR-003): ni un renglon del
  comentario, ni la mitad de un telefono.
- Un corte 1 mm torcido **no se nota**.

### 2.3 Leerla

Pegar la etiqueta en una caja, dejarla, y volver a mirarla **parado, a un brazo
de distancia**:

1. **El codigo se lee sin acercarse** (SC-005). Es el requisito heredado de `020`
   y el que mas se arriesgo al achicar la hoja cinco veces. Si a 34 pt no se lee,
   el piso de 26 pt es una fantasia y hay que rehacer el presupuesto.
2. **La direccion de entrega se lee de cerca, comoda** (SC-003), y pesa
   visiblemente mas que la de retiro.
3. **Las tildes y la ñ se dibujan bien.** Probar con "Piñeyro" y "Bulevar
   España".
4. **La silueta del camion parece un camion**, impresa en blanco y negro. En una
   hoja chica la silueta es mas chica todavia; este es el punto donde puede
   volverse una mancha.
5. **No hay ningun importe en ninguna parte** (SC-006), ni un hueco que sugiera
   que deberia haberlo.
6. **La zona aparece como nombre** —"Zona 3"— y nunca como una tarifa.

---

## 3. El caso extremo, una vez

Es P3 y el riesgo esta aceptado, pero hay que **verlo una vez** antes de cerrar,
porque es el unico modo de saber cuanto duele:

Cargar un pedido con las dos direcciones al maximo —calle compuesta, numero,
apto, esquina y cooperativa en las dos— y un comentario de 280 caracteres.
Imprimir, recortar y mirar:

- Entra completo, apretado (FR-006).
- **El codigo, las dos direcciones, los dos telefonos, la fecha y la cantidad
  estan enteros** (SC-004).
- Si el comentario se corto, **se ve que se corto** (FR-008) y no se corto nada
  mas.

Probar tambien un comentario **corto pero de cinco renglones** (cinco
indicaciones, una por linea). Es el caso que gasta alto sin gastar caracteres, y
es mas probable que el de 280 seguidos.

---

## 4. La misma etiqueta desde Mis pedidos

Entrar a `/perfil`, buscar el pedido recien creado, y tocar **Imprimir resumen**
en su tarjeta. **Tiene que salir el mismo documento** (SC-007). Es el requisito
que `020` puso para que las dos pantallas no divergieran, y un re-maquetado es
exactamente donde divergirian.

---

## 5. En el telefono

El sitio es mayoritariamente movil. Abrir `/perfil` en el telefono y tocar
**Imprimir resumen**: lo que importa es que **el archivo llegue y se abra**, no
donde aterrice —carpeta, visor o hoja de compartir son los tres resultados
correctos—. El unico resultado incorrecto es que no pase nada.

---

## 6. Antes de cerrar

Bajar el `npm run dev`. Y recordar que **esto no reemplaza a staging**: el cambio
va a staging y se ejercita ahi antes de que llegue a `master`.
