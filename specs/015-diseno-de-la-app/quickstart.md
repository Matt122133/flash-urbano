# Quickstart — `015` La app para la calle

**Este feature es enteramente visual, así que `verify:` es el nivel más flojo de
los tres.** Compila la app y corre sus pruebas de JVM: dice que existe, no que
sirve. `012` pasó ese mismo verde y entregó un botón con el texto cortado, un
título pegado a la barra de estado, un error en inglés en la cara del usuario y
un APK sin firmar.

## Nivel 1 — desde la sesión, sin emulador

### Q1. `verify:` verde

```
cd android && .\gradlew.bat assembleDebug testDebugUnitTest
```

**La barra invertida importa**: corre en `cmd`, donde `./` es inválido y el
nombre pelado no resuelve. Ver research D7.

### Q2. El contraste, medido

Entre las pruebas de JVM tiene que estar la que calcula el contraste de cada par
del tema. **Y su control positivo**: romperlo a propósito —poner gris claro sobre
blanco en la tabla de pares— tiene que ponerla en rojo, nombrando el par.
Deshacer y confirmar verde.

Sin ese paso la prueba no vale: una que devuelve siempre "pasa" es verde para
siempre.

## Nivel 2 — el emulador. **Obligatorio, no opcional.**

Es la única oportunidad barata de encontrar defectos: en el teléfono de Diego
cada vuelta es generar el APK, pasárselo y que lo abra a mano.

### Q3. Las tres pestañas

Con pedidos en las tres secciones:

1. La barra está **abajo**, con tres destinos y sus íconos.
2. Tocar cada uno cambia la lista **sin salir de la pantalla**.
3. Pendientes y En curso muestran su número. **Entregados no muestra ninguno.**
4. Desplazar una lista larga hasta el final: **la barra sigue ahí**.
5. Tocar "atrás" desde cualquier pestaña **sale de la app** — es el cambio de
   comportamiento que decidió research D1, y hay que verlo, no suponerlo.

### Q4. Mover un pedido con una mano

1. Con la lista de Pendientes, **una tarjeta entera tiene que verse con su
   acción**, sin desplazar.
2. Tocar "Lo tengo": el pedido sale de Pendientes, el número del badge baja, y
   aparece el aviso con **Deshacer**.
3. **El aviso aparece sobre Pendientes, donde estás** — no salta a En curso
   (research D6).
4. Tocar Deshacer: el pedido vuelve y el badge sube.
5. Repetir en En curso con "Entregado".

### Q5. El pulgar, en serio

**Agarrar el teléfono con una mano, como se usa de verdad**, y hacer el recorrido
completo: abrir, mirar un pedido, moverlo, cambiar de pestaña. **Sin recolocar la
mano ni ayudarse con la otra.**

Es SC-001 y SC-003 y es el motivo del feature. Si en algún paso hay que estirar,
el diseño no cumplió y hay que arreglarlo **acá**, no en el teléfono de Diego.

### Q6. Nada de morado, nada tapado

1. Recorrer las cuatro pantallas —las tres pestañas y el ingreso— buscando
   **morado**. No puede quedar ni un elemento con el color por defecto.
2. Mirar el borde de arriba: el contenido **no puede estar pegado a la barra de
   estado** ni tapado por ella. Es un defecto que `012` ya entregó una vez.
3. Mirar el borde de abajo: la barra de navegación del sistema no puede tapar la
   barra de destinos.

### Q7. Vacíos y sin señal

1. Abrir una sección sin pedidos: **explica por qué está vacía**, no es una
   pantalla en blanco.
2. Poner el emulador en **modo avión**: se sigue viendo lo último que se bajó,
   con el aviso; y las acciones se ven apagadas **antes** de tocarlas, no fallan
   al tocar.

### Q8. Un estado que la app no conoce — **no se prueba acá**

Este paso decía: poner a mano un estado raro en la base de desarrollo y mirar la
app. **Es imposible, y lo encontró el analyze**: `pedidos.estado` lleva
`CHECK (estado IN ('creacion','aceptacion','entrega'))`, así que la base no
acepta otro valor sin tirarle la restricción — y tirarla para probar una pantalla
es peor que no probarla.

**FR-011 se verifica con una prueba de JVM sobre `seccionDe()`** (tarea T017),
que además corre en cada `verify:` en vez de una sola vez. Lo que sí queda para
el emulador es lo de siempre: que en los pedidos normales **ese texto no esté**,
que es lo que se comprueba mirando cualquier tarjeta en Q3.

## Nivel 3 — Diego

### Q9. El APK, y cómo llega

Generar el `release`, comprobar que **está firmado** y que no lleva la excepción
de texto plano. El procedimiento entero —incluido que **`adb install` no funciona
en su Xiaomi** y hay que empujar el archivo a Descargas— está en
[`docs/processes/app-repartidor.md`](../../docs/processes/app-repartidor.md).

### Q10. Que la use al sol, con una mano

**Es SC-008 y es lo único que puede cerrar este feature.** `012` dejó estos dos
pasos sin evaluar y de ahí salió este trabajo; volver a dejarlos abiertos sería
repetir el ciclo.

Que Diego haga una jornada real y conteste dos cosas: si llega con el pulgar a
todo lo que necesita, y si lo lee sin taparle el sol con la mano.
