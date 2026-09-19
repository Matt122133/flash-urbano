# Research: El reporte del mes

**Feature**: `029-reporte-del-mes` | **Fecha**: 2026-09-19

Siete decisiones. La primera es la unica con forma de arquitectura; el resto son
detalles que deciden si el archivo sirve o no.

---

## D1 — Un endpoint aparte, y **exige la cuenta**

**Decision**: nace `GET /admin/reporte?cliente=<id>&desde=<fecha>&hasta=<fecha>`,
en un paquete Go nuevo `backend/internal/reporte/`. `GET /admin/tablero` **no se
toca**.

**Rationale**: FR-017 pide que la pantalla de conteos no se encarezca, y FR-001
pide el reporte. Meterle las direcciones a `/admin/tablero` cumple el segundo y
rompe el primero **sin que nada se ponga rojo**: hoy ese endpoint mueve tres
campos por pedido para contar, y cargarlo con el domicilio de entrega de cada
envio se lo cobraria a **cada visita al tablero**, para un archivo que se baja
una vez por mes.

**Y el parametro `cliente` es obligatorio**: sin el, la respuesta es un 400, no
"todos". Asi **FR-006 deja de ser una regla de pantalla y pasa a ser una
propiedad del servicio**: no existe request que produzca un archivo con dos
cuentas mezcladas, ni siquiera armada a mano con `curl`. Un boton que no se
muestra es una precaucion; un endpoint que no sabe contestar "todos" es una
garantia.

**Alternatives considered**:
- **Engordar `/admin/tablero`.** Un archivo menos. Rompe FR-017 y hace que cada
  carga del tablero mueva datos de terceros que esa pantalla no muestra.
- **Un parametro `?detalle=1` sobre el mismo endpoint.** Mismo handler con dos
  formas de respuesta: dos contratos en una ruta, y la guarda de "no engordar" se
  vuelve un comentario en vez de una frontera.

---

## D2 — El CSV se arma en el navegador, sin ninguna libreria

**Decision**: el servicio devuelve JSON; el CSV lo compone `web/lib/reporte.ts`,
un modulo puro, y la descarga la dispara el navegador con un `Blob`.

**Rationale**: el sitio es un export estatico, no tiene servidor propio. Y un CSV
son comas y comillas: la unica parte dificil es citar bien, que son quince
lineas con prueba. **Esto es lo que hizo barato elegir CSV sobre XLSX**: una
libreria de planilla pesa cientos de KB y habria que traerla con import dinamico
como jsPDF; un CSV no pesa nada.

Ademas mantiene el reparto que ya usa `025`: **el servicio devuelve hechos, la
web los formatea**. La zona, las fechas de Montevideo y el formato del archivo
son decisiones de presentacion y viven donde hay pruebas que corren sin base.

---

## D3 — Las tres cosas que hacen que Excel lo abra bien

Ninguna es opcional. Las tres se ven recien al abrir el archivo en una planilla,
nunca en un editor de texto.

| Que | Por que |
|---|---|
| **Separador `;`** | Una planilla configurada en español espera `;`. Con `,` abre **todo en una sola columna** y el archivo es "correcto" y no sirve. |
| **BOM de UTF-8** (`﻿` al principio) | Sin el, Excel asume la codificacion local y "Piñeyro" sale "PiÃ±eyro". Las calles de Montevideo estan llenas de tildes y ñ, asi que no es un caso raro: es el caso. |
| **Fin de linea `CRLF`** | Lo que pide RFC 4180 y lo que no sorprende a ninguna planilla de Windows. |

Y el citado: un campo que contenga `;`, `"` o un salto de linea va entre
comillas, con las comillas internas duplicadas. **La direccion es el campo
peligroso** —*"Rivera 1234, apto 2"*— y es el que se prueba.

---

## D4 — Las fechas: una trampa menos de las que parecia

**Hallazgo que simplifica**: `pedidos.retiro_fecha` es una columna **`date`**, no
un `timestamptz`. O sea que **el corte del mes no tiene problema de zona
horaria**: es una fecha de calendario y se compara como tal.

La trampa queda acotada a dos lugares:

- **La fecha de entrega**, que sale de `pedidos_estados.ocurrido_en`, que si es
  `timestamptz`. Una entrega de las 22:00 del 30 de septiembre en Montevideo es
  el 1 de octubre en UTC. Se convierte con **`fechaEnMontevideo()`, que ya existe
  en `lib/tablero.ts`** y que `025` escribio exactamente para esto, con la zona
  IANA escrita y no un `-03:00` a mano.
- **La fecha de generacion** del archivo, por el mismo motivo.

**No se escribe un segundo conversor.** El repo ya tiene resueltas sus trampas de
fecha y duplicarlas es como se desincronizan.

---

## D5 — Los metadatos van al final

**Decision**: encabezado en la fila 1, los pedidos debajo, un renglon en blanco,
y despues las filas de contexto (cuenta, periodo, generado el).

**Rationale**: FR-014 y FR-012 no se pueden cumplir los dos de la forma obvia. Un
titulo arriba hace que la planilla tome esa fila como encabezado: se pierden los
nombres de columna, el filtro y el orden. Al final no molesta a nadie, y **el
renglon en blanco los deja fuera de la region contigua**, asi que ordenar los
datos no se los lleva puestos.

**Alternatives considered**: solo en el nombre del archivo (FR-014 pide adentro,
y un archivo renombrado pierde el contexto); una columna extra repetida en cada
fila (ruido en todas las filas para un dato que es del archivo).

---

## D6 — Las guardas de la plata, que son **dos** y no una

El feature toca los dos lados, y cada lado tiene su guarda porque las existentes
no alcanzan:

- **En Go**: `backend/internal/tablero/sin_plata_test.go` escanea **su propio
  paquete**. Un paquete nuevo `internal/reporte` nace sin nada. Hay que darle la
  suya, con el mismo patron y **su control positivo**.
- **En la web**: `sin-precio-a-la-vista.test.ts` escanea `app/` y `components/`, y
  **deja `lib/` afuera a proposito** porque ahi el precio tiene que seguir
  viviendo. `lib/reporte.ts` nace sin proteccion. Se le agrega el escaneo de
  fuente que `lib/tablero.ts` y —desde `028`— los modulos de la etiqueta ya
  tienen.

Es la tercera vez que este repo agrega un modulo en `lib/` y descubre lo mismo.
**Si vuelve a pasar una cuarta, la pregunta deja de ser "agreguemos la guarda" y
pasa a ser "por que cada modulo nuevo tiene que acordarse".**

---

## D7 — La enmienda 6.2.0, y por que es MINOR

La constitucion dice que el tablero *"cuenta"*. Este feature lo hace **listar**.
Se amenda el bullet de *Scope boundaries* y se agrega la entrada al historial.

**MINOR, no MAJOR**: no se reversa ningun principio, el Principio V queda palabra
por palabra, y **nada de lo construido queda fuera de norma** — se agrega una
capacidad. Mismo razonamiento y misma forma que 6.1.0, 5.1.0 y 2.1.0. **Sin
ADR**: la gobernanza pide uno cuando el cambio reversa una decision anterior, y
este extiende el alcance sin contradecir nada.

**Va antes del Constitution Check del plan, no despues.** Un plan que declare
"cumple la constitucion" contra un texto que dice otra cosa no esta cumpliendo:
esta describiendo mal el documento.
