# Quickstart — 006 backend auth

Cómo se prueba que este feature funciona. Los pasos manuales **no son opcionales**:
el criterio principal del feature (SC-002, SC-003) es que el ingreso ande en un
teléfono real, y eso ningún comando lo verifica.

## Prerequisitos

**Go instalado.** Listo: **1.26.5**, instalado el 2026-08-08 en
`C:\Users\USUARIO\golang\go` y agregado al PATH de usuario. Si `go version` no
responde, la terminal es anterior a la instalación — abrir una nueva.

**`flashurbano.uy` resolviendo.** Sólo hace falta para el camino del código por
mail. **El alta ya se ejecutó**, pero al 2026-08-09 la zona DNS no existe: los
nameservers a los que el registro delega responden `REFUSED`. Ver
[`docs/processes/dominio-y-dns.md`](../../docs/processes/dominio-y-dns.md) para
el estado y el plan.

La comprobación que importa **no** es la delegación sino que la zona conteste:

```bash
nslookup -type=SOA flashurbano.uy 1.1.1.1
```

Mientras responda `Server failed`, no hay zona y no hay mail posible. Ver los NS
con `nslookup -type=NS flashurbano.uy a.nic.uy` sólo dice a quién delega el
registro, no que ese alguien esté sirviendo algo.

**Variables de entorno del servicio.** Ninguna en el árbol: el repo es público
(FR-028). El servicio **no arranca** si falta alguna — dirección de la base,
credenciales de Google, clave del proveedor de mail, orígenes permitidos, y la
dirección de Diego como administrador.

## Verificación automática

Desde la raíz del repo, lo mismo que el `verify:` del plan:

```bash
(cd backend && go vet ./... && go test ./... && go build ./...) && \
(cd web && npm run lint && npm test && npm run build)
```

Lo que las pruebas del backend tienen que cubrir, porque es lo que se rompe en
silencio:

- Un código vencido, uno ya usado y uno con cinco fallos previos: rechazados los
  tres (SC-006).
- El quinto fallo mata el código aunque el sexto intento traiga el valor bueno.
- Un usuario no puede leer ni escribir el perfil de otro (SC-010).
- La misma dirección por los dos caminos devuelve **un solo** usuario (SC-010a).
- Un origen no autorizado es rechazado (SC-008).
- La base se levanta desde vacía con las migraciones, sin pasos manuales (SC-011).
- El rastro deja reconstruir un intento fallido, y **el código no aparece** en
  ningún registro (SC-012).

Estas pruebas corren **sin mandar mail**: el proveedor está detrás de una
interfaz (research D8), y ahí está la mitad del motivo de que exista.

## Verificación manual

### 1. Cotizar con el backend apagado (SC-001) — el más importante

Con el servicio **detenido**, entrar al sitio, cargar calle y esquina de retiro,
y ver el punto y el precio. Sin errores en la consola.

Va primero porque es lo que más fácil se rompe al introducir autenticación, y
porque si falla el feature resta valor en vez de sumarlo.

### 2. Entrar con Google desde el teléfono (SC-002, SC-003)

En **Safari de iPhone** y en **Chrome de Android**, no sólo en el escritorio. El
ADR predice que el modo de falla es exactamente que uno de los tres se comporte
distinto.

Entrar, completar nombre y teléfono, ver el nombre en la navegación.

### 3. Entrar con código por mail (SC-004)

Requiere el dominio activo y verificado. Pedir el código con una dirección que
**no** sea de Google y confirmar que llega **a la bandeja de entrada, no a
spam**, en menos de un minuto, en al menos dos proveedores distintos.

Si el dominio todavía está pendiente, este paso queda abierto y hay que decirlo
al cerrar el plan, no darlo por hecho.

### 4. La sesión sobrevive (SC-005)

Cerrar el navegador y volver. Sigue identificado. La prueba real de las dos
semanas es calendario; alcanza con comprobar que la credencial guardada sobrevive
al cierre y que el vencimiento está en el futuro.

### 5. Cerrar sesión invalida de verdad (SC-007)

Copiar la credencial antes de salir. Cerrar sesión. Reusarla a mano contra
`GET /yo`: tiene que fallar. Es lo que distingue la decisión de research D1 de
haber usado un JWT.

### 6. El perfil guarda y precarga

Guardar nombre, teléfono y dirección de retiro con calle, esquina, número y el
punto ajustado dentro de la cuadra. Salir, volver, ver los mismos valores —
**incluido el punto donde se lo dejó**, no en la esquina.

### 7. Diego es administrador y nadie más

Entrar con la dirección configurada: lo reconoce. Entrar con otra: no. Cambiar
la variable de entorno y comprobar que el cambio tiene efecto sin tocar la base.

### 8. El formulario de pedido sigue intacto (FR-007b)

Entrar a `/pedido` **sin identificarse**. Tiene que funcionar exactamente como
antes: sin puerta, sin precargado, terminando en la pantalla de resumen.

Es el paso que confirma que el feature se mantuvo dentro de su alcance. El
sensor de cobertura ya lo impone —`web/components/pedido-form.tsx` quedó fuera
de `covers:` a propósito— pero conviene verlo con los ojos.

## Lo que este feature no cierra

El formulario **sigue sin llegarle a nadie**, y el sitio es indexable desde
`004`. Cerrarlo es `007`. Quien termine este plan no debería reportar que el
producto quedó funcionando de punta a punta, porque no es cierto.
