# Quickstart: comprobar el reporte del mes

`verify:` prueba que las filas digan lo que tienen que decir, que el texto cite
bien y que nadie nombre la plata.

**Lo que no puede probar es lo unico que a Diego le importa: que el archivo se
abra bien.** El separador, el BOM y el fin de linea son correctos o no segun lo
que haga **una planilla de verdad en una maquina configurada en español**, y eso
no lo sabe ningun `expect`. Esto es esa mitad.

## Prerequisitos

```bash
cd web && npm install
```

Para las pruebas de Go contra Postgres, **Docker Desktop levantado** y
`TEST_DATABASE_URL` puesta. Sin eso **las pruebas de base se saltean solas y no
fallan**: mirar el numero de `skip`, no el verde. Ver `backend/README.md`.

Y una planilla de verdad: Excel o LibreOffice, **en español**.

---

## 1. Las pruebas

```bash
cd web && npm run lint && npm test && npm run build
cd ../backend && go vet ./... && go test ./... -p 1 && go build ./...
```

**Contar los `skip` de Go.** Si las pruebas contra Postgres se saltearon, el
verde no dice nada sobre la consulta del reporte, que es justo la parte nueva.

### Los controles negativos, rompiendo a proposito

- **La guarda de plata del paquete Go**: agregarle a `internal/reporte` una
  variable que se llame `precio`. `go test` tiene que ponerse **ROJO**.
- **La guarda de plata de la web**: lo mismo en `lib/reporte.ts`. `npm test`
  **ROJO**.
- **El filtro por cuenta**: hacer que el handler acepte `cliente` vacio como
  "todos". Tiene que haber una prueba en **ROJO** — es FR-006, y es la que
  impide que un cliente vea las direcciones de otro.
- **La fecha de Montevideo**: cambiar `fechaEnMontevideo` por un corte en UTC.
  La prueba del pedido entregado a las 22:00 del ultimo dia del mes tiene que
  ponerse **ROJA**. Ojo: **esta maquina esta en Montevideo**, asi que una prueba
  mal escrita pasa por casualidad. La prueba tiene que forzar la zona y afirmar
  que tomo.

---

## 2. El archivo, abierto en una planilla de verdad

Levantar el sitio contra staging y entrar al tablero como administrador.

```bash
cd web && npm run dev
```

**Mirar antes quien tiene el 3000**: un `next dev` huerfano sirve codigo viejo
sin fallar.

1. **Sin cuenta elegida, no hay boton** (FR-006a). Comprobarlo primero: es la
   mitad estructural de la privacidad.
2. Elegir una cuenta, poner el corte en **mes**, y tocar la descarga de una fila.
3. **Abrir el archivo de DOBLE CLIC**, no importarlo. Si hay que elegir un
   separador, el feature no esta terminado.

Y ahi mirar, en este orden:

- **Cada dato en su columna** (SC-002). Si todo cayo en la columna A, falta el
  `;`.
- **Las tildes y la ñ** (SC-003). Buscar una direccion con ñ. "PiÃ±eyro" es BOM
  faltante.
- **Una direccion con coma** —*"Rivera 1234, apto 2"*— **no partio la fila**
  (SC-007).
- **La fila 1 es el encabezado**, y los datos de generacion estan **al final**,
  despues de un renglon en blanco (SC-012).
- **Cero importes, en todo el archivo** (SC-006). Mirar tambien el pie.
- **Ordenar por zona** y comprobar que el bloque de metadatos **no se mezclo**
  con los datos.

---

## 3. Los dos casos que cuestan plata

**No son opcionales**: son las dos historias P1 del spec y ninguna se ve en la
pantalla.

1. **Un pedido sin marcar como entregado aparece igual**, con la celda de
   entrega vacia (SC-004). Armar uno, no marcarlo en la app, y bajar el reporte.
   **Si no aparece, Diego factura de menos y nada se lo avisa.**
2. **Un pedido sin punto de entrega** (anterior a `011`) sale con la zona vacia,
   y **se distingue** de un pedido con zona. Vacio no es "no se cobra".

---

## 4. La zona coincide con el resto del producto

Tomar un pedido del reporte y comprobar que **la zona que dice el CSV es la misma
que muestra el formulario y la misma que sale impresa en su etiqueta** (SC-005).
Si difieren, alguien escribio un segundo resolvedor de zona, que es exactamente
lo que FR-007 prohibe.

---

## 5. Antes de cerrar

- Bajar el `npm run dev`.
- **Comprobar que la constitucion quedo en 6.2.0** con su entrada de historial
  (FR-021). Es el requisito que mas facil se olvida porque no lo rompe ninguna
  prueba.
- Pasar el cambio por staging antes de que llegue a `master`. **El backend si se
  despliega**, asi que aca staging no es una formalidad: hay una ruta nueva.
