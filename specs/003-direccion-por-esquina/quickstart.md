# Quickstart — Cómo se valida que el feature anda

**Feature dir**: `specs/003-direccion-por-esquina` | **Date**: 2026-08-04

Guía de validación, no de implementación. Es lo que se corre para creerle al
feature.

## Antes de empezar

- Node y npm instalados; `cd web && npm install` ya corrido.
- Para **regenerar** el índice hacen falta los `.sql` de ejes viales del curso
  de TSIG. Para todo lo demás no: `web/public/calles-mvd.json` queda versionado
  en el repo.

## El gate

```bash
cd web && npm run lint && npm test && npm run build
```

Es el `verify:` del plan. **Mientras no esté verde, el feature no está hecho.**

## Regenerar el índice

Sólo hace falta si cambia el dato de origen o las reglas de construcción.

```bash
cd web
node design-source/build-calles.js <ruta-a-los-sql> public/calles-mvd.json
```

El script tiene que imprimir al terminar, y hay que mirarlo:

- calles y esquinas emitidas — referencia: **5.746** y **20.884**
- tamaño crudo y comprimido — **el comprimido tiene que quedar bajo 1 MB**
  (SC-007). Hoy son 0,47 MB.

Si los números se apartan mucho de esas referencias, algo cambió en el dato o
en las reglas y hay que entender qué antes de seguir.

## Que las esquinas caigan donde deben (SC-002)

```bash
cd web && npm test
```

El fixture de `web/lib/direcciones.test.ts` compara esquinas conocidas contra
coordenadas de referencia con tolerancia de 30 m.

**Las coordenadas de referencia las confirma una persona contra un mapa real.**
No las puede generar el mismo proceso que se quiere verificar, y no salen de
memoria: durante la investigación, dos de cinco esquinas que se daban por
ciertas resultaron estar mal (research R2 y R6). Este es el único paso del
plan que necesita a alguien mirando.

## El recorrido a mano

```bash
cd web && npm run dev
```

En `/pedido`, con el navegador en viewport de teléfono:

1. **Autocompletado.** Escribir `zapican` en Calle: aparecen sugerencias.
   Probar `18 de julio`, `Garzon` y `garzón` — los tres tienen que llevar a la
   misma calle.
2. **Esquina acotada.** Con la calle elegida, escribir en Esquina: sólo se
   ofrecen calles que la cruzan de verdad.
3. **Resolución.** Al quedar el par, aparece el mapa **debajo** de los campos,
   centrado en el cruce, con el pin puesto, y se muestran zona y precio. Los
   campos de número, apto y cooperativa se habilitan recién ahí.
4. **Sin salto de layout.** Mirando el momento en que aparece el mapa: el
   contenido de abajo no tiene que pegar un salto.
5. **Arrastre.** Mover el pin dentro de la cuadra: se queda donde se lo suelta.
   Soltarlo lejos: vuelve al borde más cercano y explica por qué.
6. **Precio en vivo.** Arrastrar cruzando una avenida que separa zonas: el
   precio cambia con aviso visible, y el arrastre no se interrumpe ni pide
   confirmación.
7. **Invalidación.** Con todo resuelto, cambiar la calle: punto, zona, precio y
   complementos se limpian.
8. **Fuera de zona.** Un cruce fuera de las cinco zonas: sin precio, sin poder
   enviar, derivado a contacto.
9. **Ambigüedad.** Un par con más de un cruce (`Calle 2` con `Calle 3` sirve):
   se muestran los candidatos y no se coloca pin hasta elegir.
10. **Entrega.** Sigue siendo texto libre, sin mapa. No cambió.

## Accesibilidad (SC-009)

Sin tocar el mouse, desde el primer campo:

- Tab llega al campo de calle; escribir abre la lista.
- Flechas recorren, Enter elige, Escape cierra sin elegir.
- El foco no se pierde ni salta a lugares raros al abrir y cerrar la lista.
- Con un lector de pantalla se anuncian las sugerencias, cuántas hay y cuál
  quedó elegida.

Tiene que poder completarse una dirección de retiro entera así.

## El apilado del mapa (SC-005)

En viewport de teléfono, en `/pedido` y en `/sobre-nosotros`:

- Scrollear con el mapa en pantalla: el header y el logo quedan **encima**.
- Abrir el menú de navegación sobre el mapa: se ve completo.
- Con una dirección ya resuelta, volver a editar la calle: la lista de
  sugerencias se despliega **sobre** el mapa, entera.

## Índice caído

Cortando la red antes de tocar el campo de calle, el formulario tiene que
**decir** que no puede resolver direcciones. Mudo es fallar.

## Antes de dar por cerrado

- `verify:` verde.
- El recorrido a mano completo en viewport de teléfono, que es donde se usa.
- `web/design-source/README.md` dice de dónde salió el dato de calles (FR-002).
- `ARCHITECTURE.md` refleja que el dato generado grande vive en `public/`.
- El plan pasa a `status: completed`.
