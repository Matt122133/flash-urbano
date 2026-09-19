/**
 * La guarda que impide publicar el sitio de produccion apuntado a otro backend.
 *
 * ## Por que existe
 *
 * Desde `027` hay dos servicios identicos corriendo: produccion y staging. La
 * URL con la que se compila el sitio sale de `NEXT_PUBLIC_API_URL`, que en la
 * publicacion viene de una variable de repositorio de GitHub
 * (`deploy-pages.yml`), y en local sale de `.env.local`. **Nada impide que el
 * sitio publico salga compilado contra staging.**
 *
 * Y ese error no tiene sintoma. `app/layout.tsx` deriva el `connect-src` de la
 * CSP **de la misma variable**, asi que un build cruzado queda internamente
 * coherente: la CSP autoriza exactamente el backend equivocado, el sitio carga,
 * el formulario anda, y los pedidos de clientes reales entran a la base de
 * prueba. Nadie se entera hasta que alguien pregunta donde estan los pedidos.
 *
 * ## Por que aca y no en el workflow
 *
 * Una comprobacion que vive solo en CI recien se demuestra el dia que falla de
 * verdad. Esta corre tambien en `npm run build` local, o sea que entra al
 * `verify:` del plan y su control positivo se puede ejercer sin desplegar nada:
 * poner `GITHUB_PAGES=true` con la URL equivocada y ver el rojo.
 *
 * ## El precio, que es real
 *
 * Esto pone en el repo una opinion sobre cual es la URL correcta. `006` la habia
 * dejado afuera a proposito, para que mudar de dominio no fuera tocar codigo.
 * **Mudar de dominio ahora incluye cambiar la constante de abajo.** No hay
 * guarda posible sin que el repo sepa que es lo correcto; lo que si hay es
 * dejarlo escrito donde se lea a tiempo, y por eso esta el comentario.
 *
 * Este modulo **no importa `lib/api.ts`** y no debe hacerlo: hay una prueba que
 * guarda que `api.ts` no entre al grafo de importacion del formulario de
 * pedido, para que la cotizacion siga funcionando con el servicio caido.
 */

/**
 * El backend de produccion. Leido de la variable de repositorio
 * `NEXT_PUBLIC_API_URL` el 2026-09-13; el servicio no tiene dominio propio.
 *
 * **Si el sitio muda de dominio, esta linea se cambia con el.**
 */
export const URL_DEL_API_DE_PRODUCCION =
  "https://flash-urbano-production.up.railway.app";

/** El error que corta el build. Tipo propio para que la prueba lo distinga. */
export class ApiCruzadoError extends Error {
  constructor(recibida: string) {
    super(
      [
        "El sitio de produccion se esta compilando contra un backend que no es el de produccion.",
        `  recibida: ${recibida || "(vacia)"}`,
        `  esperada: ${URL_DEL_API_DE_PRODUCCION}`,
        "",
        "Si esto es una publicacion de verdad, corregi la variable de repositorio",
        "NEXT_PUBLIC_API_URL. Si el sitio mudo de dominio, actualiza tambien",
        "URL_DEL_API_DE_PRODUCCION en web/lib/url-del-api.ts.",
      ].join("\n"),
    );
    this.name = "ApiCruzadoError";
  }
}

/**
 * Devuelve la URL del servicio, o falla si se esta publicando produccion contra
 * otra cosa.
 *
 * `esPublicacion` es lo que distingue los dos usos, y la asimetria es el
 * requisito (FR-008a): **apuntar la web local a staging es el uso normal** de
 * tener un ambiente de staging, y no puede fallar. Lo que no puede pasar es
 * publicar el sitio asi.
 *
 * La normalizacion de la barra final repite la de `lib/api.ts` a proposito: son
 * dos usos distintos de la misma variable y este modulo no puede importar aquel.
 */
export function resolverUrlDelApi(
  crudo: string | undefined,
  esPublicacion: boolean,
): string {
  const url = (crudo ?? "").replace(/\/+$/, "");

  if (!esPublicacion) {
    return url;
  }

  if (url !== URL_DEL_API_DE_PRODUCCION) {
    throw new ApiCruzadoError(url);
  }

  return url;
}
