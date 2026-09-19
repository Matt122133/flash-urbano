# Research: La etiqueta de 12 x 10

**Feature**: `028-etiqueta-12x10` | **Fecha**: 2026-09-19

Siete decisiones. La unica grande es **D4**: como se verifica una maqueta de PDF
sin ojos. Las demas son numeros.

---

## D1 — La hoja sigue siendo A4, y eso evita la trampa de `format`

**Decision**: `new jsPDF({ unit: "mm", format: "a4" })` **no cambia**. El
documento sigue siendo A4 vertical; lo que se agrega adentro es el rectangulo de
120 x 100.

**Rationale**: la decision de producto (imprimir en impresora comun y recortar,
ver *Clarifications* del spec) deja el tamaño de pagina donde esta. De paso
esquiva un problema real: cuando a jsPDF se le pasa `format: [120, 100]`, el
ancho y el alto que terminan en el PDF **dependen de `orientation`**, que por
defecto es `portrait`, y la libreria reordena el par. Un `[120, 100]` con la
orientacion por defecto no garantiza 120 de ancho. Es exactamente el tipo de
detalle que compila, se ve bien en pantalla y sale mal del papel.

**Alternatives considered**:
- **Pagina de 120 x 100 exactos**. Correcta el dia que exista una etiquetadora de
  rollo, y descartada hoy porque no hay ninguna confirmada. Obligaria a resolver
  lo de `orientation` y dejaria la hoja a merced del *ajustar a la pagina*.
- **Pagina A4 apaisada**. No aporta: el rectangulo entra sobrado en vertical.

---

## D2 — Donde cae el rectangulo, y como se marca

**Decision**: el rectangulo ocupa **x ∈ [15, 135], y ∈ [15, 115]** en
milimetros, medido desde el borde superior izquierdo de la A4 (210 x 297). Las
marcas de corte son **cuatro escuadras en las esquinas, afuera**: separadas 2 mm
del vertice, brazos de 5 mm, linea de 0.2 mm.

**Rationale**:
- **Arriba a la izquierda y no centrado**, como pide el spec: recortar desde una
  esquina se hace apoyando la hoja, recortar del medio no.
- **15 mm de aire por los dos lados** deja las marcas en x = 10 e y = 10 en su
  punto mas externo. El area no imprimible de una impresora comun de oficina
  llega, en el peor caso que aparece en las hojas de datos, a **6.35 mm**; con
  10 mm hay 3.65 mm de sobra por el lado malo.
- **Escuadras y no recuadro**: la etiqueta recortada queda sin marco (FR-002), y
  un corte 1 mm torcido no deja medio renglon de linea impresa en el borde. Es lo
  que hace la imprenta y por eso se ve tan poco un marco en una etiqueta.

**Alternatives considered**:
- **Centrado horizontalmente** (x = 45). Mas "prolijo" en pantalla, peor con la
  tijera.
- **Recuadro punteado**. Mas facil de seguir la primera vez; deja rastro si el
  corte sale torcido, y el corte sale torcido siempre.

---

## D3 — El presupuesto vertical, en numeros

El rectangulo es de 120 x 100 mm. Con **margen interno de 5 mm** quedan
**110 x 90 mm utiles**.

Conversion usada en todo el modulo, la misma que ya vive en `etiqueta-pdf.ts`:
1 pt = 0.352778 mm, e interlineado = `pt x 0.352778 x 1.25` = **`pt x 0.440972`
mm**.

**El caso corriente** (direcciones de un renglon, comentario de dos). **Numeros
medidos sobre la maqueta ya implementada**, no estimados: son los que imprime
`maquetar()` para un pedido tipico, con `ajuste = 0`.

| Bloque | Cuerpo | Desde | Hasta | Alto |
|---|---|---|---|---|
| Encabezado: silueta 5 mm + *FLASH URBANO* + bajada + regla | 11 / 5.5 pt | 20.0 | 28.7 | 8.7 mm |
| Caja del codigo: rotulo + numero, con recuadro | 34 pt | 30.2 | 50.9 | 20.7 mm |
| ENTREGAR A: rotulo + regla + nombre + direccion + telefono | 12 / 10 pt | 53.4 | 71.1 | 17.7 mm |
| RETIRAR DE: rotulo + regla + nombre + direccion + telefono | 9 / 8 pt | 73.1 | 87.7 | 14.6 mm |
| COMENTARIO: rotulo + dos renglones | 8.5 pt | 89.7 | 100.2 | 10.5 mm |
| Pie: regla + FECHA DE RETIRO / PAQUETES | 9.5 pt | 101.4 | 110.0 | 8.6 mm |
| **Ocupado, con los aires entre bloques** | | **20.0** | **110.0** | **90 mm** |

Los aires entre bloques son 2.0 / 2.5 / 2.0 / 2.0 / 1.5 mm. **El pie va anclado
al borde de abajo**, igual que en `020`: el contenido baja desde arriba y "entra"
significa que no llega a pisarlo.

**Entra, y con poco de sobra.** Ese margen chico esta dicho a proposito: es el
numero que dice que la maqueta **no tiene lugar para un bloque mas**, y que
cualquier idea de agregarle algo a esta etiqueta es un feature, no un ajuste.

**Dos correcciones que salieron de implementar**, anotadas aca para que la tabla
no mienta:

1. **El encabezado paso de 7.5 a 8.7 mm.** La regla se calculaba a `0.7` del
   alto de la bajada y caia en y = 26.7, con la linea base de *LOGISTICA Y
   TRANSPORTE* en 26.94: **la regla tachaba el texto**. Compilaba, y las guardas
   de geometria estaban verdes porque nada se salia del recorte ni bajaba de su
   piso. Se vio leyendo la tabla de posiciones. Ahora la regla va debajo de la
   caja entera, y **hay una guarda nueva** —"ninguna regla tacha un texto"— que
   lo agarra sola: comprobado poniendo el defecto de vuelta y viendola en rojo.
2. **El piso del pie subio de 6 a 7 pt.** La tabla de abajo metia "rotulos y
   pie" en una sola fila; son dos cosas distintas y el valor del pie lleva la
   fecha de retiro, que Diego lee.

**El caso extremo, medido**: las dos direcciones al maximo mas 280 caracteres de
comentario entran con **`ajuste = 0.56`** y **sin cortar nada**. El codigo queda
en 29.5 pt, todavia por encima de su piso de 26.

**El ancho no es el problema.** A 10 pt sobre 110 mm entran unos 78 caracteres
por renglon, y una direccion de Montevideo compuesta —*"Av. Gral. Flores 2543
esq. Bulevar Artigas, apto 302"*— tiene unos 52. **Por eso el caso corriente es
de un renglon por direccion y no de dos**, que es de donde sale el presupuesto de
arriba. El calculo de `020` suponia dos renglones porque en A4 no costaba nada
suponerlo.

**Los pisos de legibilidad** (FR-007), con la regla del spec de que la entrega
pesa mas que el comentario:

| Bloque | Cuerpo corriente | Piso |
|---|---|---|
| Codigo | 34 pt | **26 pt** |
| Entrega — nombre | 12 pt | **9 pt** |
| Entrega — direccion y telefono | 10 pt | **8 pt** |
| Retiro — nombre | 9 pt | **7.5 pt** |
| Retiro — direccion y telefono | 8 pt | **7 pt** |
| Comentario | 8.5 pt | **6.5 pt** |
| Rotulos | 6.5 pt | **6 pt** |
| Pie — el valor (fecha, cantidad) | 9.5 pt | **7 pt** |
| Marca — *FLASH URBANO* | 11 pt | **8 pt** |

**Los pisos son una hipotesis hasta que se imprimen.** Estan elegidos con la
cuenta de altura de mayuscula (26 pt da ~6.4 mm, que a un brazo se lee), pero el
papel es el juez: ver `quickstart.md`. Si en papel 26 pt no se lee de lejos, se
sube el piso y se baja otra cosa — lo que no se hace es dar el numero por bueno
porque se veia bien en un visor al 150 %.

---

## D4 — Como se verifica una maqueta sin ojos: **la maqueta es un dato**

**Esta es la decision central del feature.**

**El problema**: `etiqueta.test.ts` prueba *que dice* la hoja y dice de si mismo,
textual, que *"el aspecto es del quickstart: una hoja puede tener todos estos
campos correctos y ser ilegible, y ninguna prueba de este archivo lo notaria"*.
Pero los requisitos nuevos son **geometricos**: nada fuera del rectangulo
(FR-003), una sola pagina (FR-004), pisos por bloque (FR-007). Afirmarlos sobre
un PDF ya dibujado seria raspar bytes de un archivo comprimido — el mismo
callejon que `020` esquivo separando `etiqueta.ts` de `etiqueta-pdf.ts`.

**Decision**: aplicar otra vez el corte que ya funciono, un nivel mas abajo.
Nace **`web/lib/etiqueta-maqueta.ts`**, que convierte una `Etiqueta` en una
**lista de elementos ubicados** —cada uno con su `x`, `y`, `ancho`, `alto`,
`pt` y a que bloque pertenece, todo en milimetros— y `etiqueta-pdf.ts` queda
como un dibujante bobo que recorre esa lista y llama a `doc.text`,
`doc.roundedRect` y `doc.addImage`.

Con eso, los tres requisitos geometricos son afirmaciones sobre un array:

- **FR-003** — `maquetar(...)` devuelve elementos; ninguno se sale del
  rectangulo. Un `for` y un `expect`.
- **FR-004** — la maqueta no tiene concepto de pagina dos. No es que se pruebe:
  **no se puede expresar**.
- **FR-007** — cada elemento lleva su `pt` y su bloque; la prueba compara contra
  la tabla de pisos.
- **FR-008** — el corte del comentario aparece como un elemento marcado, o no
  aparece. Tambien inspeccionable.

**Rationale**: es el patron del repo, ya pagado y ya entendido, y es lo que
convierte "no se desborda" de una promesa en una prueba. La memoria del repo es
clara en que una guarda negativa necesita control positivo; aca el control
positivo es barato y esta en el plan (T-005): se mete a proposito una direccion
absurdamente larga y se comprueba que la prueba se pone **roja**.

**Alternatives considered**:
- **Rasterizar el PDF y comparar pixeles.** Trae una dependencia nueva y pesada,
  falla por diferencias de antialiasing entre maquinas, y contesta "cambio algo"
  en vez de "esto se salio del rectangulo".
- **Leer el texto del PDF generado** (`doc.output()` y buscar cadenas). Prueba el
  contenido, que ya esta probado en `etiqueta.test.ts`, y **no dice nada de la
  geometria**, que es justo lo nuevo.
- **Dejarlo todo al quickstart.** Es lo que hoy pasa con el aspecto, y funciona
  mientras el aspecto sea estable. Deja de funcionar cuando el layout depende del
  contenido: nadie va a imprimir a mano las doce combinaciones de largos en cada
  cambio futuro.

---

## D5 — El medidor de ancho se **inyecta**, no se importa

**Decision**: `maquetar(etiqueta, medir)` recibe una funcion
`medir(texto, pt) => mm`. `etiqueta-pdf.ts` le pasa una que consulta **el mismo
`jsPDF` que despues dibuja**; la prueba le pasa la de un `jsPDF` creado en el
test.

**Rationale**: el corte de un texto en renglones lo tiene que decidir el medidor
real de la libreria y no un conteo de caracteres —*"Piñeyro" y "MMMMMMM" tienen
las mismas siete letras y ocupan anchos muy distintos"*, dice `etiqueta-pdf.ts`
hoy, y tiene razon. Inyectarlo da las dos cosas a la vez: el modulo de maqueta no
importa jsPDF (queda puro y liviano), y **la medicion que usa la prueba es la
misma que usa el dibujo**, no una imitacion. Una prueba de geometria contra un
medidor falso es una prueba de la imitacion.

jsPDF corre en Node sin DOM, asi que la prueba puede instanciarlo: vitest ya está
en `environment: "node"` con `include: ["lib/**/*.test.ts"]`, y el archivo nuevo
entra solo.

**Alternatives considered**:
- **Que `etiqueta-maqueta.ts` importe jsPDF y se arme un documento de descarte
  para medir.** Un argumento menos, pero dos documentos con estado de fuente
  independiente: el dia que uno cambie de fuente y el otro no, la maqueta mide
  contra una tipografia y se dibuja con otra, y el sintoma es texto que se pasa
  por poquito. No se paga.

---

## D6 — Que desaparece de `020` (FR-009)

**Hallazgo: menos de lo que el spec sugiere.** No hay dos caminos de dibujo ni un
selector de tamaño; `020` dejo **una sola** maqueta. "La etiqueta A4 desaparece"
se traduce en que las constantes `ANCHO = 210`, `ALTO = 297`, `MARGEN = 18` y
`UTIL` de `etiqueta-pdf.ts` dejan de describir la etiqueta y pasan a describir el
rectangulo, y en que el cuerpo de las seis funciones de dibujo se reescribe
contra el presupuesto de D3.

**No se borra**: `etiqueta.ts` entero (que dice la hoja no cambia),
`boton-imprimir.tsx` entero (un solo boton, import dinamico, manejo del error),
`silueta-camion.ts`, el nombre de archivo, ni una sola de las pruebas que ya
existen.

**Se conserva la escala de grises** (`NEGRO`, `GRIS`) y el motivo, que en una
etiqueta chica pesa mas todavia: la hoja se imprime en blanco y negro, asi que la
jerarquia se hace con tamaño y peso, nunca con color.

---

## D7 — Lo que **no** se prueba automatico

Se anota aca para que sea una decision y no un descuido. La maqueta como dato
(D4) cubre la geometria; **no cubre si la hoja sirve**. Queda para el quickstart,
sobre papel recortado y no en pantalla:

- Que 26 pt se lean **a un brazo** (SC-005). Ninguna prueba sabe a que distancia
  esta una persona.
- Que el recorte por las marcas de esquina de efectivamente 12 x 10 (SC-001), que
  es lo unico que agarra el escalado de la impresora — el riesgo que el spec
  acepto al sacar la linea de *"imprimir al 100 %"*.
- Que la etiqueta recortada **no tenga marco** y que un corte torcido no se note
  (SC-002).
- Que el conjunto se lea comodo (SC-003), que es un juicio y no una medida.

`020` compilaba perfecto y salio con dos defectos visuales; `012` lo mismo en la
app. **Que el `verify:` este verde no dice que la etiqueta sirva**, y este feature
no es una excepcion.
