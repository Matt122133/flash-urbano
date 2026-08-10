# Feature Specification: El sitio vive en flashurbano.uy

**Feature dir**: `specs/009-dominio-propio` | **Date**: 2026-08-10
**Status**: brief

## Por qué existe

El sitio se publica hoy en `https://matt122133.github.io/flash-urbano/`. Es una
dirección que no se le puede dar a un cliente ni poner en un cartel: dice el
nombre de usuario de GitHub del desarrollador y no el del negocio.

El dominio `flashurbano.uy` está comprado, dado de alta y —desde el 2026-08-10—
resolviendo, con la zona en Cloudflare. Ya no falta infraestructura: falta
apuntar el sitio.

**Lo que este feature entrega es exactamente el sitio que ya existe, en su
dirección definitiva.** Ninguna pantalla cambia, ninguna funcionalidad se agrega.
Es una mudanza.

## Historias de usuario

### Historia 1 — Un cliente escribe la dirección del negocio y llega (P1)

Alguien a quien Diego le pasó `flashurbano.uy` lo escribe en el navegador del
teléfono y llega al sitio, con candado, sin advertencias y sin nada roto en la
pantalla.

**Prueba independiente**: abrir `https://flashurbano.uy` en un teléfono y usar el
cotizador de punta a punta.

### Historia 2 — Los que ya tenían la dirección vieja no se quedan afuera (P2)

Quien tenga guardada `matt122133.github.io/flash-urbano/`, o escriba
`www.flashurbano.uy`, termina en el sitio igual.

## Requisitos funcionales

- **FR-001** — El sitio se sirve desde `https://flashurbano.uy` con certificado
  válido para ese nombre.
- **FR-002** — Todos los links de navegación, imágenes, íconos y datos estáticos
  resuelven desde la **raíz** del dominio. Es el requisito que obliga al cambio
  de código: hoy el build inyecta un prefijo `/flash-urbano` en todo.
- **FR-003** — `www.flashurbano.uy` lleva a `flashurbano.uy`.
- **FR-004** — La dirección vieja de GitHub sigue llevando al sitio.
- **FR-005** — El contenido del sitio **no cambia**. Mismo texto, mismas
  pantallas, mismo cotizador que el día anterior a la mudanza.
- **FR-006** — Mudar el sitio no puede requerir editar pantallas. Las que ya
  consumen la base del sitio lo hacen por configuración (`lib/asset.ts`), y eso
  se conserva.

## Criterios de éxito

- **SC-001** — `https://flashurbano.uy` carga la home en un teléfono, con el
  logo visible y **cero errores 404 en la consola**. El 404 de un asset es el
  modo de falla concreto de este feature, no una preocupación genérica.
- **SC-002** — Se cotiza de punta a punta desde el dominio: calle, esquina,
  punto en el mapa y precio, igual que antes.
- **SC-003** — `http://flashurbano.uy` y `www.flashurbano.uy` terminan los dos
  en `https://flashurbano.uy`.
- **SC-004** — El sitio anterior en `matt122133.github.io/flash-urbano/` no
  queda muerto.

## Fuera de alcance

- **El API.** `api.flashurbano.uy` es de `006`/`007`; el servicio sigue
  respondiendo en su dirección de Railway y este feature no la toca.
- **El mail.** DKIM, SPF y los registros de Resend son la T059 de `006`.
- **Auth y pedidos.** Nada de `006` ni `007` entra acá. El sitio que se muda es
  el de `master`, sin login.

## Supuestos

- GitHub Pages emite y renueva el certificado del apex por Let's Encrypt, sin
  intervención, una vez que los registros `A`/`AAAA` estén y el dominio esté
  cargado en la configuración del repositorio.
- El sitio **no tiene usuarios reales todavía** (el formulario no le llega a
  nadie). Por eso se acepta una ventana de minutos con assets rotos entre que
  se despliega el build sin prefijo y GitHub aplica el dominio.
