---
owner: flash-urbano
status: living
last_reviewed: 2026-08-09
update_trigger: on-dns-change
---

# Dominio y DNS

Estado operativo de `flashurbano.uy` y qué registro hace falta para cada cosa.
Vive acá y no en `specs/006-backend-auth/` porque el dominio sobrevive a ese
feature: lo consumen el mail (`006`), la mudanza del sitio y el subdominio del
API.

La decisión comercial —precio, tope, registrador, titular— está en la fila 12 de
[`preguntas-cliente.md`](../preguntas-cliente.md).

## Estado al 2026-08-09

| Qué | Estado |
|---|---|
| Registro en nic.uy | **Activo.** `a.nic.uy` delega el dominio |
| Registrador | hostingmontevideo.com (panel WHMCS) |
| Titular | Mateo, acordado con Diego |
| Servidores de nombre | `ns1/ns2.servidorlinux19.com` — **delegación coja** |
| Zona DNS | **No existe.** Nada resuelve |
| Mail del dominio | Bloqueado hasta que haya zona |

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

## El plan: la zona va a Cloudflare

El registro se queda en hostingmontevideo; sólo se muda a quién le pregunta el
mundo por la zona. Cloudflare da zona DNS gratis y autogestionada, que es
exactamente lo que el panel del registrador no da.

**Riesgo del cambio: ninguno.** El dominio hoy no resuelve para nadie, así que no
hay nada que romper ni ventana que esperar.

1. Cloudflare → cuenta gratis → *Add a site* → `flashurbano.uy` → plan **Free**.
2. La importación de registros **viene vacía**. Es correcto: la zona nunca existió.
3. Cloudflare entrega dos nameservers `*.ns.cloudflare.com`.
4. Panel del registrador → **Servidores de nombres** → nameservers personalizados
   → los dos de Cloudflare, campos 3–5 vacíos → *Cambiar Nameservers*.
5. Verificar con los comandos de arriba: `a.nic.uy` tiene que delegar a
   Cloudflare, y `1.1.1.1` tiene que resolver el SOA.

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

Ninguno se puede cargar hasta que exista la zona.

| Para | Tipo | Nombre | Valor | Cuándo |
|---|---|---|---|---|
| Informes de mail | TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:<mail>` | Apenas haya zona |
| Firma del mail | TXT | lo que diga Resend | lo que diga Resend | Al dar de alta el dominio en Resend |
| SPF del envío | TXT | subdominio de envío | lo que diga Resend | Ídem |
| Rebotes | MX | subdominio de envío | lo que diga Resend | Ídem |
| Sitio en el apex | A ×4 | `@` | las 4 IP de GitHub Pages | Cuando se mude el sitio |
| API | CNAME | `api` | el host de Railway | Cuando se despliegue el servicio |

**Los valores de Resend son por cuenta y por región: copiarlos del panel, no
escribirlos de memoria.**

`_dmarc` arranca en `p=none` a propósito — junta informes sin rechazar nada.
Endurecer a `p=quarantine` recién cuando se vea que los envíos legítimos pasan.

Conviene que Resend firme desde un **subdominio** (`send.flashurbano.uy`), no
desde el apex: si un envío ensucia la reputación, ensucia el subdominio y no el
dominio con el que se le escribe a los clientes.

## Qué desbloquea esto

La Historia 3 de [`006-backend-auth`](../../specs/006-backend-auth/spec.md) —
entrar con un código por mail— y su SC-004, que exige que el código llegue a la
bandeja de entrada y no a spam. Es el único bloqueo operativo del feature: las
demás historias no dependen del dominio, y por eso ésa es P2.

## Qué no hace falta

**No contratar hosting web en hostingmontevideo.** El sitio vive en GitHub Pages
y el API en Railway. Del dominio sólo se necesita DNS, que es gratis.
</content>
