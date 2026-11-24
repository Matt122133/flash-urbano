# Research: Orden de la dirección en la app

No quedaban `NEEDS CLARIFICATION`; esto registra lo que se leyó para decidir.

## Dónde se arma el texto hoy

| Lugar | Función | Orden actual | Campos |
|---|---|---|---|
| `pantallas/Principal.kt` (tarjeta, RETIRA y ENTREGA) | `comoTexto` | `calle esq. X numero apto A (cooperativa)` | todos |
| `pantallas/HojaEntrega.kt` (hoja de entrega) | `direccionCorta` | `calle esq. X numero` | calle, esquina, número |
| `web/lib/direccion.ts` | `componerDireccion` | `calle numero, apto A, esq. X, cooperativa` | todos |
| `web/components/pedido/tarjeta-pedido.tsx` | `componer` | igual que la web, con `breve` sin apto ni cooperativa | — |

Las dos de la app ponen la esquina antes del número. La web, en sus dos
lugares, ya lo hace bien, y su `breve` es exactamente lo que la hoja de entrega
necesita.

## Decisión: una función pura con `breve`

- **Decision**: `textoDeDireccion(d: Direccion, breve: Boolean = false): String`
  en `pantallas/TextoDeDireccion.kt`; las dos privadas se borran.
- **Rationale**: dos funciones con el mismo trabajo son la causa de que hubiera
  dos órdenes; una sola, pura y fuera de un `@Composable`, se prueba en la JVM
  sin emulador.
- **Alternatives considered**:
  - *Corregir las dos en el lugar*: arregla hoy, pero deja que la próxima vez
    diverjan; y son `private` dentro de archivos de UI, sin prueba posible sin
    cambiar su visibilidad igual.
  - *Que el servicio mande el texto armado*: mueve un problema de presentación
    al backend y suma una pierna (deploy, staging) a un cambio que no la
    necesita.

## Decisión: el texto de la web, carácter por carácter

- **Decision**: mismo orden, mismo separador `", "`, `apto X`, `esq. Y`,
  `cooperativa` sin paréntesis.
- **Rationale**: clarificación del 2026-11-24 (Mateo: "con las comas"), y SC-002.
- **Alternatives considered**: invertir solamente (`Rivera 1234 esq. Soca`),
  descartado en la clarificación.
