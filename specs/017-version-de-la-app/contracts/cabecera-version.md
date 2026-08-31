# Contrato: la cabecera de versión

**Feature**: `017-version-de-la-app` | **Fecha**: 2026-08-31

Es la única superficie nueva entre la app y el servicio. No hay endpoint nuevo.

---

## La cabecera

```
X-App-Version: 0.2.0
```

- **Quién la manda**: la app de Diego, en **todos** los pedidos que hace, no
  sólo en los autenticados. Mandarla en `POST /auth/codigo` no sirve de nada
  hoy, pero mandarla en unos sí y en otros no es la clase de asimetría que
  después nadie recuerda por qué existe.
- **Quién NO la manda**: el sitio web. No tiene versión que declarar.
- **Valor**: el mismo `BuildConfig.VERSION_NAME` que la app muestra en pantalla
  (FR-012). Ver research D7.

## Qué hace el servicio con ella

| Caso | Qué pasa |
|---|---|
| Ausente | Nada. La sesión conserva la versión que tuviera. |
| Vacía o sólo espacios | Igual que ausente. |
| Más larga que el tope | Se descarta entera; **no se recorta y se guarda**. Un valor a medias es peor que ninguno: parece un dato. |
| Con forma de versión | Se guarda en la sesión junto con `now()`. |
| Sin forma de versión | Se descarta. Igual que ausente. |

**Nunca es un error.** Una cabecera mal formada **no** cambia el código de
respuesta ni impide resolver la sesión. Este dato existe para diagnosticar; que
un defecto en él pudiera dejar a Diego sin poder trabajar sería invertir por
completo la relación entre el problema y su instrumento.

**Nunca se refleja de vuelta.** Ninguna respuesta del servicio incluye lo que el
cliente declaró. Un valor de un cliente que vuelve a salir por una respuesta es
la forma clásica de convertir un campo de diagnóstico en un vector.

## Forma aceptada

Lo que produce Gradle en las tres situaciones de research D3:

```
0.2.0                    tag exacto
0.2.0+3-gc3eb8fe         hay tag, HEAD mas adelante
0.0.0-c3eb8fe            sin tag
0.0.0-desconocido        sin git
```

El validador tiene que aceptar las cuatro. **Que un binario de trabajo se
distinga de uno publicado es el objetivo (FR-006), no un caso raro**: si el
validador sólo aceptara `X.Y.Z`, los binarios de trabajo llegarían como *no
declarada* y se perdería justamente la distinción.

## Lo que este contrato NO incluye

Ningún dato del teléfono: ni modelo, ni fabricante, ni versión de Android, ni
identificador de dispositivo, ni `User-Agent` propio (FR-011). La pregunta que
este feature contesta es *qué versión de la app corre*, y para eso el resto
sobra.
