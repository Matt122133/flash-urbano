# Contrato: el tablero

Dos contratos: el endpoint que agrega `backend/internal/tablero`, y la pantalla
`/tablero` de la web. Las decisiones que los explican están en
[research.md](../research.md).

---

## 1. `GET /admin/tablero`

Nuevo. Montado en `backend/cmd/api/main.go` con `conSesion`, igual que
`GET /admin/pedidos`. **Solo lectura**: no hay otro método sobre este camino
(FR-017).

**Sin parámetros.** Ni `?corte=`, ni `?cliente=`, ni paginado: el servicio
devuelve los hechos y la web agrupa (D1). Un parámetro desconocido se ignora.

### Autorización

| Quién pide | Respuesta | Cuerpo |
|---|---|---|
| Sin credencial, o credencial vencida/revocada | **401** (lo decide el middleware, no el handler) | el de siempre de `httpx.ConSesion` |
| Con sesión, mail **no** en `ADMIN_EMAILS` | **403** | `{"error": "no autorizado"}` — el mismo texto que `/admin/pedidos` |
| Con sesión, mail en `ADMIN_EMAILS` | **200** | abajo |

El 403 **no trae ningún dato**: ni un conteo, ni la lista de clientes, ni un
cuerpo parcial (SC-004).

### 200

```json
{
  "pedidos": [
    { "creadoEn": "2026-09-11T01:15:00Z", "cantidad": 2, "clienteId": "6f1b0f1e-…" },
    { "creadoEn": "2026-09-11T13:40:00Z", "cantidad": 1, "clienteId": "0c2d9a33-…" }
  ],
  "clientes": [
    { "id": "0c2d9a33-…", "nombre": "Ana Pérez", "email": "ana@example.com" },
    { "id": "9e8f7a66-…", "nombre": null,        "email": "alta.a.medias@example.com" }
  ]
}
```

- **`pedidos`**: una entrada por fila de `pedidos`, **todas**, sin filtro de
  estado ni de cuenta (FR-004b). Ordenadas por `creadoEn` ascendente.
  `creadoEn` es el instante en UTC; la conversión a Montevideo es de la web
  (D3). Sin `id`, sin `codigo`, sin ningún otro campo.
- **`clientes`**: **todas** las cuentas, con o sin pedidos, incluidas las
  administradoras (D6). Ordenadas por nombre, las sin nombre al final por mail.
  `nombre` es `null` —no `""`— cuando el alta quedó a medias.
- **Listas vacías, nunca `null`**: sin pedidos, `"pedidos": []`. Es el mismo
  criterio que `GET /pedidos` (`TestSinPedidosEs200ConListaVacia`): un `null`
  obliga a la web a distinguir dos formas de "no hay".

### Lo que este cuerpo NO tiene, y una prueba lo sostiene

Ninguna clave que nombre plata: `precio`, `monto`, `importe`, `costo`, `total`
en pesos. Ninguna información personal de los pedidos. Ver research D9.

### CORS

`GET` ya está en `httpx.MetodosPermitidos`. **El camino nuevo se agrega a la
lista de `TestElPreflightAutorizaTodosLosMetodosQueSirveElEnrutador`**
(`backend/cmd/api/main_test.go`): esa lista se mantiene a mano, y un camino que
no está ahí no lo ata nadie.

---

## 2. La pantalla `/tablero`

`web/app/tablero/page.tsx` (componente de servidor: solo `metadata` con
`robots: noindex` y el montaje) + `web/components/tablero/` (cliente).

### Estados, en el orden en que se deciden

| # | Condición | Se ve | Llama al servicio |
|---|---|---|---|
| 1 | La sesión se está resolviendo (`cargando`) | "Un momento…" | no |
| 2 | Sin sesión | `PanelIngreso` en el lugar (D8). Al entrar, la página pasa sola al estado que corresponda. | no |
| 3 | Con sesión y `esAdmin === false` (lo dijo `/yo`), **o** el servicio contestó 403 | "Esta sección es solo para la administración." Nada más: ni números, ni clientes, ni un enlace a otra cosa (FR-003, D7). | **no** con `false`; sí cuando vino del 403 |
| 4 | Con sesión y `esAdmin` en `true` **o `undefined`**, pidiendo | "Un momento…" | sí |
| 5 | Admin, la llamada falló | El mensaje de error de D10 y un botón **Reintentar**. **Nunca ceros** (FR-016). | — |
| 6 | Admin, llegó | El tablero | — |

**`esAdmin` en `undefined` no es `false`.** Es lo que hay recién entrado: la
respuesta del ingreso no trae el campo, solo `/yo` lo contesta (research D7).
Tratarlo como `false` le dice a Diego que no es administrador justo después de
entrar. Por eso `undefined` pide, y **el 403 es el camino normal** para una
cuenta común recién entrada, no un caso raro: se muestra el estado 3, no el 5. Si contesta **401**, lo maneja el
proveedor de sesión como en el resto del sitio (sesión vencida).

### El tablero (estado 6)

De arriba abajo:

1. **Cliente**: un `<select>` con "Todos los clientes" primero y después cada
   cuenta como *Nombre — mail* (o solo el mail). Elegir uno cambia los números;
   volver a "Todos" los restituye **sin tocar el corte** (FR-010).
2. **Pedidos registrados**: el número grande, con su bajada (D10). Con un
   cliente elegido, los de ese cliente.
3. **Corte**: tres botones —Día, Semana, Mes— con `aria-pressed`, como el
   conmutador de `/perfil`. Mes por defecto.
4. **La aclaración de la fecha** (FR-006a), en una línea, pegada al corte.
5. **La tabla**: columnas *Período*, *Pedidos*, *Paquetes*, con encabezado
   (FR-008). Filas del período actual hacia atrás (D5).
6. **Vacíos**: sin ningún pedido, el texto de FR-015 sobre la tabla de una fila
   en cero. Con un cliente sin pedidos, el de FR-011.

**Lo que no hay, a propósito** (spec, *Lo que este feature NO hace*): gráficos,
tendencias, comparación con el período anterior, promedios, un total de
paquetes arriba, montos de cualquier tipo, acciones sobre pedidos.

**Móvil**: el Principio IV rige el formulario del cliente, y Diego mira esto
sentado en una computadora (spec, *Assumptions*). Igual la pantalla **no se
rompe a 360 px**: la tabla es de tres columnas angostas y cabe.

### Navegación

`nav-bar.tsx`: enlace **"Tablero"** a `/tablero` junto a *Mi cuenta*, solo si
`usuario?.esAdmin === true` (D12), en la barra de escritorio y en el menú de
móvil. Acá `undefined` **sí** es "no mostrar": un enlace no puede preguntar. Lo
que evita que Diego no lo vea después de entrar es que `entrar()` relee `/yo` en
segundo plano y copia `esAdmin` (research D7).
