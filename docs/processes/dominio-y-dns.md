---
owner: flash-urbano
status: living
last_reviewed: 2026-08-10
update_trigger: on-dns-change
---

# Dominio y DNS

Estado operativo de `flashurbano.uy` y qué registro hace falta para cada cosa.
Vive acá y no en `specs/006-backend-auth/` porque el dominio sobrevive a ese
feature: lo consumen el mail (`006`), la mudanza del sitio y el subdominio del
API.

La decisión comercial —precio, tope, registrador, titular— está en la fila 12 de
[`preguntas-cliente.md`](../preguntas-cliente.md).

## Estado al 2026-08-10

| Qué | Estado |
|---|---|
| Registro en nic.uy | **Activo.** `a.nic.uy` delega el dominio |
| Registrador | hostingmontevideo.com (panel WHMCS) |
| Titular | Mateo, acordado con Diego |
| Servidores de nombre | `ali.ns.cloudflare.com` / `martin.ns.cloudflare.com` |
| Zona DNS | **Existe y resuelve.** El SOA sale por `1.1.1.1` |
| `_dmarc` | **Cargado**, en `p=none` |
| Sitio, API y mail | Sin registros todavía — ver la tabla de abajo |

Comprobado el 2026-08-10:

```bash
nslookup -type=NS  flashurbano.uy a.nic.uy   # ali / martin .ns.cloudflare.com
nslookup -type=SOA flashurbano.uy 1.1.1.1    # responde: la zona existe
nslookup -type=TXT _dmarc.flashurbano.uy 1.1.1.1
```

`www`, `api` y `send` dan `Non-existent domain`, y el apex no tiene `A`. Es lo
esperado: la zona se creó vacía salvo `_dmarc`.

**Ya no hay bloqueo de infraestructura.** Lo que falta es cargar registros, y
eso es autoservicio en Cloudflare.

## Historia: la delegación coja que había hasta el 2026-08-09

Se deja escrito porque explica por qué la zona vive en Cloudflare y no en el
registrador, y porque el mismo síntoma vuelve si alguien revierte los
nameservers.

### La delegación coja, y por qué

El registro delega a los nameservers de hostingmontevideo, pero esos servidores
responden `REFUSED` para esta zona: **nunca se creó el archivo de zona ahí**. Es
lo que pasa cuando se compra el dominio suelto, sin plan de hosting — el
registrador pone sus nameservers por defecto y no aprovisiona nada.

Comprobado el 2026-08-09:

```bash
nslookup -type=NS  flashurbano.uy a.nic.uy               # delega: ns1/ns2.servidorlinux19.com
nslookup -type=SOA flashurbano.uy ns1.servidorlinux19.com # Query refused  <-- no hay zona
nslookup -type=SOA servidorlinux19.com ns1.servidorlinux19.com # responde: el server esta vivo
nslookup flashurbano.uy 1.1.1.1                           # Server failed
```

La tercera línea es la que descarta que el servidor esté caído: contesta bien
para su propia zona.

**El panel del registrador no tiene editor de zona.** El menú de *Gestionar
flashurbano.uy* ofrece Información General, Auto Renovación, Servidores de
nombres, Bloquear Registro, Contactos, Servidores DNS Privados, DNSSEC y los
cuatro "Cambiar…". No hay dónde cargar un registro. *Servidores DNS Privados* no
sirve para eso: registra **glue records** —nameservers propios tipo
`ns1.flashurbano.uy` apuntando a una IP— y usarlo acá empeora la delegación.

## La mudanza a Cloudflare — hecha el 2026-08-09/10

El registro se quedó en hostingmontevideo; sólo se mudó a quién le pregunta el
mundo por la zona. Cloudflare da zona DNS gratis y autogestionada, que es
exactamente lo que el panel del registrador no da.

**Riesgo del cambio: ninguno**, y así fue. El dominio no resolvía para nadie, así
que no había nada que romper ni ventana que esperar.

Los pasos que se ejecutaron, por si hay que repetirlos en otro dominio:

1. Cloudflare → cuenta gratis → *Add a site* → `flashurbano.uy` → plan **Free**.
2. La importación de registros **vino vacía**. Es correcto: la zona nunca existió.
3. Cloudflare entregó `ali.ns.cloudflare.com` y `martin.ns.cloudflare.com`.
4. Panel del registrador → **Servidores de nombres** → nameservers personalizados
   → los dos de Cloudflare, campos 3–5 vacíos → *Cambiar Nameservers*.
5. Verificar con los comandos de arriba. **La propagación no es inmediata**: el
   cambio se hizo el 09/08 y recién el 10/08 `a.nic.uy` devolvía Cloudflare. No
   hay nada que arreglar en el medio; hay que esperar y volver a consultar.

### Tres trampas

- **No activar DNSSEC** (*Manage DNSSEC DS Records*) mientras los nameservers
  cambian. Un DS apuntando a servidores que no firman deja el dominio sin
  resolver en todos lados, y desarmarlo es lento.
- **En Cloudflare, todo en "DNS only" (nube gris).** Cloudflare proxea por
  defecto. Para Railway el proxy **rompe** la emisión del certificado; con
  GitHub Pages complica el SSL del apex. El proxy no compra nada acá: el sitio
  ya está en un CDN.
- Cambiar nameservers **no toca** titularidad, renovación ni registro.

## Registros, por para qué sirven

La zona ya existe: todos éstos se pueden cargar cuando corresponda.

| Para | Tipo | Nombre | Valor | Estado |
|---|---|---|---|---|
| Informes de mail | TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:<mail>` | ✅ cargado el 2026-08-10 |
| Firma del mail | TXT | lo que diga Resend | lo que diga Resend | Al dar de alta el dominio en Resend |
| SPF del envío | TXT | subdominio de envío | lo que diga Resend | Ídem |
| Rebotes | MX | subdominio de envío | lo que diga Resend | Ídem |
| Sitio en el apex | A ×4 | `@` | las 4 IP de GitHub Pages | Cuando se mude el sitio — **leer la trampa de abajo** |
| API | CNAME | `api` | el host de Railway | Cuando se le ponga dominio propio al servicio |

**Los valores de Resend son por cuenta y por región: copiarlos del panel, no
escribirlos de memoria.**

`_dmarc` arranca en `p=none` a propósito — junta informes sin rechazar nada.
Endurecer a `p=quarantine` recién cuando se vea que los envíos legítimos pasan.

Conviene que Resend firme desde un **subdominio** (`send.flashurbano.uy`), no
desde el apex: si un envío ensucia la reputación, ensucia el subdominio y no el
dominio con el que se le escribe a los clientes.

## Mudar el sitio al dominio: no alcanza con el DNS

Cargar los cuatro `A` y escribir `flashurbano.uy` en *Settings → Pages → Custom
domain* **deja el sitio roto**, y conviene saberlo antes y no después de hacerlo.

El motivo es `web/next.config.ts`: cuando el workflow define `GITHUB_PAGES=true`
el build sale con `basePath` y `assetPrefix` en `/flash-urbano`, porque hoy el
sitio vive en `matt122133.github.io/flash-urbano/`. En un dominio propio el sitio
se sirve desde la **raíz**, así que todos los links y assets quedarían apuntando
a una carpeta que no existe.

Mudar el sitio es, entonces, cuatro cosas y no una:

1. Los cuatro `A` del apex en Cloudflare, en **DNS only**.
2. `basePath` condicionado al dominio, no a `GITHUB_PAGES` a secas —
   **cambio de código** en `web/next.config.ts`, que **no está en el `covers:` de
   `006`**: necesita su propio plan o extender el de turno.
3. `CORS_ORIGENES` en Railway, con el origen nuevo (FR-023: es variable, no código).
4. El origen autorizado del cliente OAuth de Google (T045 de `006` ya lo prevé
   para los dos orígenes).

Conviene hacerlo **después** de T046 —el ingreso probado en teléfono— para no
reconfigurar orígenes de Google y CORS dos veces en el medio de la Historia 2.

## Qué desbloquea esto

La Historia 3 de [`006-backend-auth`](../../specs/006-backend-auth/spec.md) —
entrar con un código por mail— y su SC-004, que exige que el código llegue a la
bandeja de entrada y no a spam. Era el único bloqueo operativo del feature: las
demás historias no dependen del dominio, y por eso ésa es P2.

**Desde el 2026-08-10 ese bloqueo se levantó**: la zona existe. Lo que queda de
T059 ya no es infraestructura de dominio sino dar de alta `flashurbano.uy` en
Resend y cargar los registros que el panel indique.

## Qué no hace falta

**No contratar hosting web en hostingmontevideo.** El sitio vive en GitHub Pages
y el API en Railway. Del dominio sólo se necesita DNS, que es gratis.
</content>
