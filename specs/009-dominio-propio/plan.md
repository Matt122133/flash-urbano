---
ticket: none
status: draft
covers:
  # Lo unico que cambia de comportamiento: el prefijo del build.
  - web/next.config.ts
  # El archivo que le dice a GitHub Pages cual es el dominio. Next copia
  # public/ tal cual al export, asi que viaja dentro del artefacto.
  - web/public/CNAME
  # No cambia de comportamiento —ya cae en "" solo— pero su comentario dice
  # "en GitHub Pages el sitio no vive en la raiz del dominio", que pasa a ser
  # falso. Un comentario que afirma lo contrario de lo que hace el codigo es
  # peor que ninguno.
  - web/lib/asset.ts
  # spec-kit escribe aca cual es el feature activo.
  - .specify/feature.json
verify: cd web && npm run lint && npm test && npm run build
analyzed:
---

# Implementation Plan: El sitio vive en flashurbano.uy

**Feature dir**: `specs/009-dominio-propio` | **Date**: 2026-08-10 | **Spec**: [spec.md](spec.md)

## Summary

Una mudanza de dirección. El sitio no cambia; cambia dónde se lo encuentra.

El trabajo real son tres líneas de `next.config.ts` y un archivo de una línea.
Lo que hace que valga un plan y no un commit suelto es que **es un cambio de
producción sobre el único artefacto que el cliente ve**, y que tiene un orden de
pasos que si se hace al revés deja el sitio roto un rato.

## Por qué no va dentro de `006`

`006-backend-auth` está en ejecución en la rama `backend-auth` y **no se mergea
hasta cerrar la Fase 4** (entrar con Google desde un teléfono, más las pruebas
manuales en iPhone y Android). El sitio publicado sale de `master`. Meter la
mudanza en `006` la ataría a ese cierre y el dominio quedaría en 404 mientras
tanto, que es exactamente lo contrario de lo que se pide.

Va en su propia rama desde `master` para que pueda salir hoy.

## Technical Context

**Language/Version**: TypeScript 5, Next.js 16.2.12, React 19.2.4. Sin cambios.

**Primary Dependencies**: ninguna nueva.

**Storage**: ninguna.

**Testing**: Vitest 4. **Las pruebas existentes no cubren esto y no se agregan
pruebas nuevas**, y conviene decir por qué en vez de dejarlo implícito: lo que
puede fallar es que un asset resuelva a una URL que no existe *en el sitio
publicado*, y eso no se puede afirmar desde un test unitario — depende del
dominio, del certificado y de la configuración del repositorio en GitHub. La
verificación de este feature es manual por naturaleza y está en los pasos.

El `verify:` corre igual, y sirve para lo que sí puede: que el build estático
salga sin errores de tipos ni de lint después del cambio.

**Target Platform**: export estático en GitHub Pages, sobre dominio propio.
Navegadores de teléfono primero.

**Scale/Scope**: dos archivos de código, uno de ellos de una línea.

## Constitution Check

Contra `.specify/memory/constitution.md` **v2.2.0**.

**Principio I (visual-first)**: es literalmente lo más visible que se puede
entregar — la dirección que el cliente le pasa a sus clientes. **Pasa.**

**Principio II (la autogestión es el valor central)**: no toca el formulario.
**Pasa.**

**Principio III (simplicidad sobre infraestructura, YAGNI)**: es el principio
que dicta la forma de la solución. Se **saca** configuración en vez de agregar
una palanca: no se introduce ninguna variable para elegir entre servir bajo
subdirectorio o bajo dominio propio. La mudanza es de ida, y una palanca para un
camino que se recorre una vez es complejidad especulativa. **Pasa.**

**Principio IV (mobile-first)**: SC-001 y SC-002 se verifican en un teléfono.
**Pasa.**

**Principio V (el sitio cotiza; la logística es manual)**: SC-002 exige que
cotizar siga funcionando desde el dominio nuevo. Es el único requisito del
proyecto que este feature podría romper —si un asset o el índice de calles no
cargara— y por eso es criterio de éxito y no una comprobación al pasar.
**Pasa.**

**Plan-bounded change (harness)**: `covers:` nombra tres archivos y ninguno de
ellos es una pantalla. **Pasa.**

Sin violaciones que justificar.

## La decisión de diseño, y la que se rechazó

**Se elimina el `basePath`, no se lo hace configurable.**

La alternativa era leerlo de una variable del workflow, para poder servir el
sitio bajo subdirectorio o bajo dominio propio según la configuración. Se
rechaza por dos motivos. El primero es el Principio III: es una palanca para una
mudanza que ocurre una vez. El segundo es más concreto y es el que la vuelve
peligrosa — una variable de repositorio **no definida** llega al workflow como
cadena vacía, no como ausente, así que el valor por defecto seguro no se puede
expresar con `??`. Quien agregara la palanca sin saber eso dejaría el prefijo
vacío por accidente, que es justo el modo de falla que se quiere evitar.

## Enfoque de ejecución

El orden importa y es lo único delicado del feature.

**Primero, el DNS.** Los ocho registros del apex y el `CNAME` de `www` en
Cloudflare, todos en *DNS only*. Es reversible y no rompe nada: mientras GitHub
no tenga el dominio cargado, `flashurbano.uy` devuelve un 404 de GitHub. Feo,
pero inofensivo, y es el estado que hay que atravesar.

**Segundo, el dominio en GitHub.** *Settings → Pages → Custom domain*. GitHub
comprueba el DNS y empieza a emitir el certificado, que tarda. A partir de acá
el sitio responde en el dominio **con los assets rotos**, porque el build que
está publicado todavía trae el prefijo. Es la ventana declarada en los supuestos
del spec.

**Tercero, el código, y desplegar.** Sacar el prefijo, mergear a `master`, y que
el workflow publique. Al terminar el despliegue la ventana se cierra.

**Cuarto, HTTPS obligatorio.** *Enforce HTTPS* recién cuando GitHub diga que el
certificado está emitido. Marcarlo antes deja el sitio inaccesible hasta que
termine.

**Quinto, verificar en un teléfono**, que es donde vive el criterio de éxito.

## Riesgos

**La ventana de assets rotos.** Está declarada y acotada a minutos. Lo que la
hace aceptable es que el sitio no tiene usuarios reales todavía: el formulario no
le llega a nadie. Si eso cambiara antes de ejecutar este plan, el orden correcto
pasaría a ser desplegar el código primero y cargar el dominio inmediatamente
después, invirtiendo cuál de las dos direcciones queda rota un rato.

**El certificado del apex.** GitHub no lo emite si Cloudflare está proxeando
(nube naranja). Es la trampa ya documentada en
[`docs/processes/dominio-y-dns.md`](../../docs/processes/dominio-y-dns.md), y el
síntoma es un error de certificado que parece del dominio y es del proxy.

**El `CNAME` que desaparece.** Con el origen de Pages en "GitHub Actions", el
dominio vive en la configuración del repositorio. El archivo `CNAME` dentro del
artefacto es redundancia deliberada: si algún despliegue futuro limpiara la
configuración, el archivo la repone. Cuesta una línea.

**Google y CORS quedan desactualizados.** El origen nuevo no está en
`CORS_ORIGENES` de Railway ni en el cliente OAuth de Google. **No rompe nada
hoy**, porque el sitio de `master` no habla con el servicio — eso llega con
`006`. Pero `006` tiene que sumar el origen nuevo antes de sus pruebas en
teléfono, y por eso este plan lo deja anotado en su tarea de cierre en vez de
confiar en que alguien se acuerde.

## Complexity Tracking

Sin violaciones de la constitución que justificar.
