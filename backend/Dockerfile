# Imagen del servicio para Railway.
#
# Dos etapas: se compila con el toolchain completo y se despacha un binario
# estatico sobre una imagen sin shell ni gestor de paquetes. Menos superficie
# que auditar en un servicio que va a manejar sesiones de clientes reales.

FROM golang:1.26-alpine AS build

WORKDIR /src

# go.mod y go.sum primero: mientras no cambien, la capa de dependencias se
# reaprovecha y no se vuelven a bajar en cada build. El glob toma go.sum
# cuando exista, sin romper el build cuando todavia no hay dependencias.
COPY go.* ./
RUN go mod download

COPY . .

# CGO_ENABLED=0 produce un binario estatico, que es lo que permite la imagen
# final sin libc. -trimpath saca las rutas de la maquina de build del binario.
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

FROM gcr.io/distroless/static-debian12:nonroot

# Sin shell y sin root. Si alguien logra ejecucion dentro del contenedor, no
# tiene con que moverse.
COPY --from=build /out/api /api
USER nonroot:nonroot

# Railway inyecta PORT y rutea a ese puerto; este EXPOSE es documentacion.
EXPOSE 8080

ENTRYPOINT ["/api"]
