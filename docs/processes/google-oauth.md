---
owner: flash-urbano
status: living
last_reviewed: 2026-08-11
update_trigger: on-oauth-change
---

# Ingreso con Google

Cómo está dado de alta el cliente OAuth que hace funcionar el botón *Ingresar
con Google*, y las cuatro cosas que se pueden hacer mal sin que nada avise hasta
el primer login real.

Vive acá y no en `specs/006-backend-auth/` porque la configuración sobrevive al
feature: se toca cada vez que cambia un origen del sitio.

## Estado al 2026-08-11

| Qué | Estado |
|---|---|
| Proyecto en Google Cloud | Creado |
| Cliente OAuth | **Web application**, activo |
| Client ID | `83271218261-…apps.googleusercontent.com` — **público por diseño**, viaja en el bundle |
| Client Secret | **Sin usar.** Este flujo no lo necesita |
| Orígenes JavaScript | `https://flashurbano.uy`, `https://matt122133.github.io`, `http://localhost:3000` |
| Redirect URIs | **Ninguna**, a propósito |
| Pantalla de consentimiento | Publicada (verificar si aparece algún rechazo raro) |

**No cuesta plata.** El proyecto, el cliente OAuth y el ingreso con scopes
básicos (email y perfil) son gratis y no piden tarjeta. Lo que sí cuesta en
Google Cloud son otras APIs — Maps sobre todo, que **no se usa**: el mapa del
sitio son tiles de OpenStreetMap.

## Dónde vive el Client ID

En dos lados, **con el mismo valor**, y en ninguno de los dos en el árbol del
repo (FR-024):

| Dónde | Nombre | Para qué |
|---|---|---|
| GitHub → *Settings → Secrets and variables → Actions → **Variables*** | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Lo inyecta el build del sitio |
| Railway → variables del servicio | `GOOGLE_CLIENT_ID` | El servicio valida con él el destinatario del token |

Va como **variable y no como secreto**: termina dentro del JavaScript que
cualquiera puede leer. Tratarlo de secreto sería mentirse.

## Dar de alta el cliente, de cero

1. `console.cloud.google.com` → nuevo proyecto.
2. *APIs & Services → OAuth consent screen* → **External** → nombre, mail de
   soporte, mail de contacto. Los scopes por defecto alcanzan.
3. **Publicar la app.** Ver la trampa 1.
4. *Credentials → Create credentials → OAuth client ID* → **Web application**.
   - **Authorized JavaScript origins**: los tres de la tabla de arriba.
   - **Authorized redirect URIs**: vacío. Ver la trampa 2.
5. Copiar el Client ID a los dos lados de la tabla anterior.

## Las cuatro trampas

**1 — La pantalla de consentimiento en modo *Testing* sólo deja entrar a los
usuarios de prueba que se listen a mano.** Ni el cliente ni nadie más puede
ingresar, y el rechazo viene de Google, antes de tocar el servicio. Hay que
**publicarla en Production**. Con scopes básicos eso es inmediato: no dispara
revisión de seguridad ni costo.

**2 — No se registran redirect URIs, y es deliberado** (research D3). El flujo
es de *token de identidad* dentro de la página, sin redirección. Registrar una
URL de retorno reintroduce justamente lo que se rompe al mudar de dominio.

**3 — Los orígenes son esquema + host, sin barra final y sin path.** La misma
regla que `CORS_ORIGENES`. `https://flashurbano.uy/` con barra **no** matchea.

**4 — El Client Secret no se usa.** Aparece al crear el cliente y es tentador
guardarlo "por las dudas". El repo es público (FR-028) y este flujo no lo
necesita: ignorarlo.

## Cómo verificar sin un navegador

Que el cliente **exista** se comprueba desde afuera. Con un ID inválido Google
responde `invalid_client` / *"The OAuth client was not found"*; con uno válido
responde `redirect_uri_mismatch`, que acá es la respuesta correcta porque no hay
redirect URIs registradas:

```bash
CID="<el client id>"
curl -s -L -o /dev/null -w '%{url_effective}\n' \
  "https://accounts.google.com/o/oauth2/v2/auth?client_id=${CID}\
&redirect_uri=https%3A%2F%2Fflashurbano.uy%2F&response_type=code&scope=openid%20email"
```

**Lo que NO se puede verificar así**: si la pantalla está publicada y si los
orígenes JavaScript están bien escritos. El endpoint `gsi/status` devuelve lo
mismo para un origen legítimo y para uno inventado, así que no sirve. Eso lo
confirma únicamente un login real.

## Cuando cambia un origen del sitio

Mudar el sitio de dominio son **tres** lugares, y olvidar cualquiera rompe el
ingreso con un error que parece de otra cosa:

1. Orígenes JavaScript del cliente OAuth, acá.
2. `CORS_ORIGENES` en Railway — ver
   [`railway-despliegue.md`](railway-despliegue.md).
3. `connect-src` de la CSP, que se deriva solo de `NEXT_PUBLIC_API_URL` y por
   eso no hay que tocarlo a mano.
