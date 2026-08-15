# Contrato: pedidos

**Feature**: `007-pedido-identificado` | **Fecha**: 2026-08-12

Tres endpoints nuevos. Siguen las convenciones que fijó `006` y no inventan
ninguna: JSON, credencial en `Authorization: Bearer`, nunca cookies, errores con
la forma `{"error": "..."}`, y **qué endpoint pide credencial se ve leyendo
`rutas()` en `cmd/api/main.go` y nada más**.

```go
// Con credencial.
mux.Handle("POST /pedidos",       conSesion(dep.pedidos.Crear))
mux.Handle("GET /pedidos",        conSesion(dep.pedidos.Mios))
mux.Handle("GET /admin/pedidos",  conSesion(dep.pedidos.Todos))
```

Ninguno es abierto. No hay pedido anónimo — es la constitución v3.0.0 y FR-005.

---

## `POST /pedidos`

Crea un pedido. Es el endpoint del feature.

### Petición

```
POST /pedidos
Authorization: Bearer <credencial>
Idempotency-Key: <uuid>
Content-Type: application/json
```

```json
{
  "remitente":    { "nombre": "Ana Pérez", "telefono": "099123456" },
  "retiro": {
    "calle": "Doctor Martín Berinduague",
    "esquina": "Vicente Yáñez Pinzón",
    "numero": "1234",
    "apto": "301",
    "cooperativa": false,
    "punto": { "lat": -34.872, "lng": -56.16 }
  },
  "entrega": {
    "calle": "Rivera",
    "esquina": "Comercio",
    "numero": "4567",
    "apto": "",
    "cooperativa": false
  },
  "paquete":      { "tamano": "chico", "cantidad": 1 },
  "retiroCuando": { "fecha": "2026-08-13", "hora": "10:30" },
  "destinatario": { "nombre": "Juan Gómez", "telefono": "098765432" },
  "cobro":        { "zonaId": 1, "precio": 200 }
}
```

**`Idempotency-Key` es obligatorio.** Sin él, `400`. No es opcional-con-default:
un cliente que no la manda es un cliente que puede duplicar pedidos, y aceptarlo
en silencio deja el modo de falla que FR-016 existe para cerrar.

`entrega.punto` **no existe** y se rechaza si viene: la entrega no lleva punto
desde `003` (FR-007a de aquel feature). El cuerpo se lee con `httpx.LeerJSON`,
que ya rechaza campos desconocidos — es la misma defensa que en `006` impidió
volverse administrador mandando `esAdmin: true`.

### Respuestas

| Estado | Cuándo |
|---|---|
| `201` | Pedido creado. |
| `200` | La `Idempotency-Key` ya se había usado: **devuelve el mismo pedido**, no un error. |
| `400` | Cuerpo inválido, falta la clave de idempotencia, campo desconocido, fecha de retiro ya pasada. |
| `401` | Sin credencial, o vencida/revocada. |
| `500` | Falla del servicio. |

```json
{
  "id": "6f1c…",
  "codigo": "FU-0142",
  "estado": "creacion",
  "creadoEn": "2026-08-12T14:03:11Z"
}
```

**Por qué `200` y no `409` ante clave repetida**: quien reintenta porque no supo
si funcionó tiene que llegar al mismo lugar que si hubiera funcionado a la
primera. Un `409` obligaría a la pantalla a tratar el éxito como un error. La
diferencia entre `200` y `201` es lo que hace **observable** que la
deduplicación actuó — y por lo tanto probable.

### Validaciones del servicio

Lo que el servicio comprueba **por su cuenta**, sin confiar en el navegador:

- Credencial válida. El `usuario_id` sale del contexto de sesión
  (`httpx.UsuarioDe`), **nunca del cuerpo** — es la regla que `006` ya fijó.
- `Idempotency-Key` presente y no vacía.
- Todos los campos obligatorios presentes y no vacíos, incluidos
  `remitente.telefono` y `destinatario.telefono`.
- `paquete.tamano` ∈ {`chico`, `mediano`, `grande`}; `cantidad` > 0.
- `cobro.precio` > 0; `cobro.zonaId` ∈ 1..5.
- `retiro.punto` con `lat`/`lng` presentes y numéricos.
- **`retiroCuando.fecha` no anterior a hoy en `America/Montevideo`.** La zona
  horaria es explícita: en Railway el proceso corre en UTC, y sin esto, entre
  las 21:00 y la medianoche de Montevideo el servicio cree que ya es mañana y
  rechaza retiros válidos de hoy. No se valida la hora dentro del día de hoy —
  pedir a las 10:05 un retiro "hoy 10:00" es pedir lo antes posible, y la
  logística es manual.

Lo que el servicio **no** comprueba, con motivo escrito en
[`research.md` D6](../research.md):

- **Que el precio corresponda a la zona.** Se guarda lo declarado.
- **Que el punto caiga en la zona declarada.** Requeriría la geometría del lado
  del servidor.
- **Que el punto caiga en la cuadra declarada.** Requeriría el índice de calles.
  Se revalida en el navegador al precargar (research D7).

---

## `GET /pedidos`

Los pedidos del usuario que pide, del más reciente al más viejo.

```
GET /pedidos
Authorization: Bearer <credencial>
```

```json
{ "pedidos": [ { "codigo": "FU-0142", "estado": "creacion", "…": "…" } ] }
```

Devuelve **sólo los del usuario del contexto de sesión**. No acepta ningún
parámetro que permita pedir los de otro: no hay `?usuarioId=`, y no debe
haberlo. Una lista vacía es `200` con `"pedidos": []`, no `404`.

**No tiene pantalla en este feature** (FR-030). Existe porque FR-031 exige poder
leer los pedidos sin abrir la base, y porque es lo que va a consumir *Mis
Pedidos* cuando se construya.

---

## `GET /admin/pedidos`

Todos los pedidos. Sólo para una dirección administradora.

```
GET /admin/pedidos
Authorization: Bearer <credencial>
```

| Estado | Cuándo |
|---|---|
| `200` | Es administrador. Devuelve todos. |
| `403` | Está identificado y no es administrador. |
| `401` | Sin credencial válida. |

Quién es administrador lo decide `config.EsAdmin`, que `006` construyó y probó:
sale del entorno, no de una columna, y **no hay forma de volverse administrador
desde el sitio porque no hay dónde escribirlo**. Este feature no agrega ningún
concepto nuevo de permisos.

**`403` y no `404`**: acá sí se distingue, y es deliberado. En `006` el ingreso
no revela si una dirección existe, porque revelarlo ayuda a quien prueba
credenciales. Acá no hay nada que ocultar — que exista una ruta de
administración no es secreto — y un `404` mandaría a quien depura a buscar un
error de tipeo en la URL.

---

## Lo que el sitio manda y cómo lo lee el formulario

`web/lib/api.ts` gana una función por endpoint. **Ninguna la importa
`pedido-form.tsx`**: la guarda de FR-001 lo prohíbe y la inversión de
dependencia de [research D1](../research.md) lo hace innecesario. Las importa
`components/pedido/crear-pedido.tsx`, que es quien compone.

La clave de idempotencia la genera el navegador con `crypto.randomUUID()` y vive
en un `useRef` mientras dura el intento: los reintentos y la reanudación
posterior al ingreso la comparten, y después de un pedido creado se descarta.

---

## Errores que la pantalla tiene que distinguir

`ErrorApi` ya trae lo necesario y no hace falta agregarle nada:

| Situación | Qué ve la persona |
|---|---|
| `sinRespuesta` (estado 0) | *No pudimos crear el pedido: el servicio no responde.* Lo cargado **sigue en pantalla** (FR-008, SC-013). |
| `sesionInvalida` (401) | Se abre el diálogo de ingreso. Es FR-009: una sesión vencida se comporta igual que no tener sesión. |
| `400` | El mensaje del servicio, junto al formulario, sin descartar nada. |
| `200` en vez de `201` | **Indistinguible para la persona**: llega a la confirmación con su código. Es el punto. |
