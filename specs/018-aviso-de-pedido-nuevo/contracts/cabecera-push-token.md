# Contrato: la cabecera `X-App-Push-Token`

Cómo la app le dice al servicio a dónde mandarle los avisos. Es la misma
mecánica que `X-App-Version` de `017`, y se documenta aparte porque **el dato
que viaja es distinto en naturaleza**: la versión describe al software, el token
direcciona a un teléfono.

## Quién la manda

La app de Diego, en **todas** las llamadas autenticadas, agregada en el único
lugar donde se arman las peticiones (`llamar()` en `Servicio.kt`).

**El sitio web no la manda nunca** y eso es parte del contrato, no un descuido:
la consulta que la consume trata "no mandada" y "vacía" como el mismo caso y
deja la fila como estaba.

## Forma

```
X-App-Push-Token: <token del proveedor de avisos>
```

- Texto imprimible ASCII.
- Largo máximo aceptado: **512 caracteres**. Un token real ronda los 160-180;
  el margen cubre cambios del proveedor sin dejar la puerta abierta.
- Vacía o ausente: **válido**, y significa *"no tengo nada nuevo que declarar"*.

## Qué hace el servicio

| Caso | Qué pasa |
|---|---|
| Cabecera ausente o vacía | La fila **no se toca**. Es el caso del sitio web y el de una app sin permiso de avisos. |
| Cabecera válida | Se guarda en `sesiones.push_token` de **esa** sesión, dentro del mismo `UPDATE` que ya resuelve la credencial. |
| Cabecera mal formada o demasiado larga | **Se descarta en silencio y la petición sigue.** No es un `400`: un token raro no puede dejar a Diego sin poder trabajar. Queda en el registro. |
| Sesión revocada o vencida | No se escribe nada, porque la consulta no alcanza esa fila. La petición falla por su propia razón (401). |

## Lo que NO viaja en esta cabecera

Nada más que el token. Ni modelo, ni fabricante, ni versión de Android, ni
identificador de dispositivo (FR-012). Para mandarle un aviso a un teléfono
alcanza con saber a dónde entregarlo.

## Relación con `X-App-Version`

Van juntas, en la misma petición, y se escriben en la misma fila con el mismo
`COALESCE`. Son independientes: una app puede declarar versión y no token —
permiso de avisos negado— y eso es información útil, no un error.
