---
owner: flash-urbano
status: living
last_reviewed: 2026-08-10
update_trigger: on-dns-change
---

# Dominio y DNS

Estado operativo de `flashurbano.uy` y qué registro hace falta para cada cosa.
Vive acá y no dentro de un `specs/<feature>/` porque el dominio sobrevive a
cualquiera de ellos: lo consumen el sitio, el mail (`006`) y el subdominio del
API.

La decisión comercial —precio, tope, registrador, titular— está en la fila 12 de
[`preguntas-cliente.md`](../preguntas-cliente.md).

## Estado al 2026-08-10

| Qué | Estado |
|---|---|
| Registro en nic.uy | **Activo**, vía hostingmontevideo.com (panel WHMCS) |
| Titular | Mateo, acordado con Diego |
| Servidores de nombre | `ali` / `martin.ns.cloudflare.com` |
| Zona DNS | **Existe y resuelve** |
| **El sitio** | **Vivo en `https://flashurbano.uy`**, con certificado válido |
| `www` | Redirige al apex |
| `_dmarc` | Cargado, en `p=none` |
| Mail (DKIM/SPF/MX) | **Falta.** Espera el alta del dominio en Resend |
| `api` | **Falta.** El servicio sigue en su dirección de Railway |

Comandos para comprobarlo:

```bash
nslookup -type=NS  flashurbano.uy a.nic.uy    # ali / martin .ns.cloudflare.com
nslookup -type=A   flashurbano.uy 1.1.1.1     # las 4 IP de GitHub Pages
nslookup -type=AAAA flashurbano.uy 1.1.1.1    # las 4 IPv6
curl -s -o /dev/null -w "%{http_code} %{ssl_verify_result}\n" https://flashurbano.uy/
```

**La comprobación que importa del proxy no es mirar el color del toggle**: si las
`A` devuelven `185.199.*.153` el proxy está apagado; si devuelven `104.*` o
`172.67.*` está encendido y hay que apagarlo.

## Registros cargados

Todos en **DNS only** (nube gris).

| Para | Tipo | Nombre | Valor |
|---|---|---|---|
| Sitio | A ×4 | `@` | `185.199.108.153`, `.109.153`, `.110.153`, `.111.153` |
| Sitio (IPv6) | AAAA ×4 | `@` | `2606:50c0:8000::153`, `8001`, `8002`, `8003` |
| `www` | CNAME | `www` | `matt122133.github.io` |
| Informes de mail | TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:<mail>` |

Los cuatro `AAAA` **no son opcionales**: sin ellos, quien tenga IPv6 no entra.

`_dmarc` arranca en `p=none` a propósito — junta informes sin rechazar nada.
Endurecer a `p=quarantine` recién cuando se vea que los envíos legítimos pasan.

## Registros que faltan

| Para | Tipo | Nombre | Valor | Cuándo |
|---|---|---|---|---|
| Firma del mail | TXT | lo que diga Resend | lo que diga Resend | Al dar de alta el dominio en Resend |
| SPF del envío | TXT | subdominio de envío | lo que diga Resend | Ídem |
| Rebotes | MX | subdominio de envío | lo que diga Resend | Ídem |
| API | CNAME | `api` | el host de Railway | Cuando se le ponga dominio propio al servicio |

**Los valores de Resend son por cuenta y por región: copiarlos del panel, no
escribirlos de memoria.**

Conviene que Resend firme desde un **subdominio** (`send.flashurbano.uy`), no
desde el apex: si un envío ensucia la reputación, ensucia el subdominio y no el
dominio con el que se le escribe a los clientes.

## La mudanza del sitio — hecha el 2026-08-10 (`009-dominio-propio`)

El orden que se siguió, que **no** es el que parece obvio:

1. Los nueve registros en Cloudflare, en DNS only.
2. **Mergear el código primero**, no configurar el dominio primero. Con el build
   viejo publicado, cargar el dominio antes deja rotas **las dos** direcciones —
   el sitio nuevo por los assets prefijados, y la vieja porque GitHub empieza a
   redirigirla. Mergeando primero, lo único roto un rato es la URL vieja, que no
   tiene nadie.
3. *Settings → Pages → Custom domain* → `flashurbano.uy` → Save.
4. *Enforce HTTPS* cuando el certificado esté emitido.

### Tres cosas que se aprendieron haciéndolo

- **El archivo `CNAME` dentro del artefacto NO configura el dominio** cuando el
  origen de Pages es "GitHub Actions". Eso funciona sólo en los despliegues por
  rama. Hay que cargarlo a mano en Settings. `web/public/CNAME` se dejó igual,
  como respaldo si algún día se cambia el modo de despliegue.
- **`basePath` se eliminó, no se hizo configurable.** Una variable de repositorio
  no definida llega al workflow como cadena vacía, no como ausente, así que el
  default seguro no se puede expresar con `??`. Ver `009-dominio-propio/plan.md`.
- La propagación de los nameservers tardó del 09 al 10. No hay nada que arreglar
  en el medio; hay que esperar y volver a consultar.

### Dos trampas que siguen vigentes

- **No activar DNSSEC** (*Manage DNSSEC DS Records*) si se vuelven a cambiar los
  nameservers. Un DS apuntando a servidores que no firman deja el dominio sin
  resolver en todos lados, y desarmarlo es lento.
- **Todo en DNS only.** Para Railway el proxy de Cloudflare **rompe** la emisión
  del certificado; con GitHub Pages complica el SSL del apex. El proxy no compra
  nada acá: el sitio ya está en un CDN.

## Lo que este dominio todavía debe

**`006`, Historia 3** — entrar con un código por mail, y su SC-004, que exige que
el código llegue a la bandeja de entrada y no a spam. Ya no está bloqueado por
infraestructura: falta dar de alta `flashurbano.uy` en Resend y cargar lo que
indique su panel.

**`006`, antes de sus pruebas en teléfono** — el origen `https://flashurbano.uy`
tiene que entrar en `CORS_ORIGENES` de Railway y en los orígenes autorizados del
cliente OAuth de Google. No rompe nada hoy porque el sitio de `master` todavía no
habla con el servicio.

## Qué no hace falta

**No contratar hosting web en hostingmontevideo.** El sitio vive en GitHub Pages
y el API en Railway. Del dominio sólo se necesita DNS, que es gratis.
