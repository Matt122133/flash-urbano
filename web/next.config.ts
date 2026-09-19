import type { NextConfig } from "next";

import { resolverUrlDelApi } from "./lib/url-del-api";

// El deploy a GitHub Pages es hosting estatico: no hay servidor Node, asi que
// no corre la optimizacion de imagenes ni nada dinamico. Esa configuracion se
// activa SOLO cuando el workflow de Pages define GITHUB_PAGES=true; en local
// (`npm run dev` / `npm run build`) el proyecto se comporta como siempre.
const isPages = process.env.GITHUB_PAGES === "true";

// La guarda del cruce de cables (027, FR-008). Corre en cada build y **falla**
// si se esta publicando el sitio de produccion contra un backend que no es el
// suyo. Inerte fuera de la publicacion, a proposito: apuntar la web local a
// staging es el uso normal de tener staging (FR-008a).
//
// Va aca y no en el workflow porque asi corre tambien en local, o sea dentro
// del `verify:` del plan, y su control positivo se puede ejercer sin desplegar.
resolverUrlDelApi(process.env.NEXT_PUBLIC_API_URL, isPages);

const nextConfig: NextConfig = {
  // Vacio, y con una razon: desde el 2026-08-10 el sitio se sirve desde la RAIZ
  // de https://flashurbano.uy, no bajo el subdirectorio /flash-urbano de
  // github.io. Sin prefijo que agregar, no hay prefijo.
  //
  // La variable se conserva igual —y `lib/asset.ts` la sigue consumiendo—
  // porque es lo que hace que una mudanza futura sea cambiar esta linea y no
  // editar pantallas. Borrarla ahorraria cuatro caracteres y volveria a atar la
  // ubicacion del sitio al codigo de cada componente.
  env: { NEXT_PUBLIC_BASE_PATH: "" },
  ...(isPages
    ? {
        output: "export" as const,
        // Genera <ruta>/index.html en vez de <ruta>.html: es lo que sirve
        // cualquier hosting estatico sin reglas de reescritura. No tiene nada
        // que ver con el dominio y por eso se queda.
        trailingSlash: true,
        // /_next/image necesita servidor. En estatico las imagenes se sirven
        // tal cual, sin redimensionar.
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
