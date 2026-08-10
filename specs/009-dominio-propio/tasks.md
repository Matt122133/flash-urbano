# Tasks: El sitio vive en flashurbano.uy

**Input**: [spec.md](spec.md), [plan.md](plan.md)

**Tests**: no se agregan. El plan explica por qué: lo que puede fallar acá —un
asset que resuelva a una URL inexistente en el sitio publicado— depende del
dominio, del certificado y de la configuración del repositorio, y no se puede
afirmar desde un test unitario. La verificación es manual y está abajo.

**Orden**: importa. Los pasos manuales van intercalados con los de código a
propósito, no agrupados al final.

---

## Fase 1 — DNS (manual, en Cloudflare)

- [ ] T001 Cargar en Cloudflare los ocho registros del apex, **todos en *DNS
  only* (nube gris)**: `A @` a `185.199.108.153`, `185.199.109.153`,
  `185.199.110.153` y `185.199.111.153`; `AAAA @` a `2606:50c0:8000::153`,
  `2606:50c0:8001::153`, `2606:50c0:8002::153` y `2606:50c0:8003::153`. Los
  cuatro `AAAA` no son opcionales: sin ellos, quien tenga IPv6 no entra
- [ ] T002 Cargar `CNAME www` → `matt122133.github.io`, también en *DNS only* (FR-003)
- [ ] T003 Verificar que resuelve, antes de tocar GitHub: `nslookup flashurbano.uy 1.1.1.1` tiene que devolver las cuatro IP, y `nslookup -type=AAAA` las cuatro v6

**Checkpoint**: el dominio apunta a GitHub. Todavía devuelve 404 de GitHub, y está bien.

---

## Fase 2 — El dominio en GitHub (manual)

- [ ] T004 *Settings → Pages → Custom domain* → `flashurbano.uy` → *Save*. Esperar a que el chequeo de DNS pase (FR-001)
- [ ] T005 **No marcar *Enforce HTTPS* todavía.** Va en T010, cuando el certificado esté emitido: marcarlo antes deja el sitio inaccesible hasta que termine

**Checkpoint**: el sitio responde en el dominio, con los assets rotos. Es la ventana declarada en el spec.

---

## Fase 3 — El código

- [ ] T006 Sacar `basePath` y `assetPrefix` de `web/next.config.ts`, y dejar `NEXT_PUBLIC_BASE_PATH` en `""`. Se conservan `output: "export"`, `trailingSlash` e `images.unoptimized`, que no tienen nada que ver con el prefijo y sí con que el hosting sea estático (FR-002, FR-006)
- [ ] T007 Escribir `web/public/CNAME` con una línea: `flashurbano.uy`. Next copia `public/` tal cual al export, así que viaja dentro del artefacto que se despliega
- [ ] T008 Actualizar el comentario de `web/lib/asset.ts`: dice "en GitHub Pages el sitio no vive en la raiz del dominio", que pasa a ser falso. La función **no cambia** —ya cae en `""` sola— y por eso sigue existiendo: es la que hace cierto a FR-006
- [ ] T009 Correr el `verify:` y mergear a `master` para que el workflow despliegue

**Checkpoint**: el sitio publicado sirve desde la raíz. La ventana se cerró.

---

## Fase 4 — Cierre y verificación

- [ ] T010 Marcar *Enforce HTTPS* en GitHub, una vez que diga que el certificado está emitido
- [ ] T011 Verificar SC-001 **en un teléfono**: `https://flashurbano.uy` carga la home, con el logo visible y **cero 404 en la consola**
- [ ] T012 Verificar SC-002: cotizar de punta a punta desde el dominio — calle, esquina, punto en el mapa y precio
- [ ] T013 Verificar SC-003 y SC-004: `http://flashurbano.uy`, `www.flashurbano.uy` y `matt122133.github.io/flash-urbano/` terminan los tres en el sitio
- [ ] T014 Actualizar [`docs/processes/dominio-y-dns.md`](../../docs/processes/dominio-y-dns.md): el sitio ya está mudado, los registros del apex quedan cargados, y la sección *"Mudar el sitio al dominio: no alcanza con el DNS"* pasa a ser historia
- [ ] T015 Anotar en `specs/006-backend-auth/tasks.md` que **el origen nuevo tiene que entrar en `CORS_ORIGENES` de Railway y en el cliente OAuth de Google** antes de T046. No rompe nada hoy porque el sitio de `master` no habla con el servicio, pero rompe las pruebas en teléfono de `006` si nadie lo hace
- [ ] T016 Commitear todo **antes** de poner el plan en `status: completed`: el sensor rebota el commit si el plan ya no está `active`

---

## Notes

- 16 tareas: 5 manuales de infraestructura, 4 de código, 4 de verificación manual, 3 de cierre
- Las de Fase 1 y 2 son de Mateo: necesitan el panel de Cloudflare y el de GitHub
