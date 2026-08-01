import type { NextConfig } from "next";

// El deploy a GitHub Pages es hosting estatico: no hay servidor Node, asi que
// no corre la optimizacion de imagenes ni nada dinamico. Esa configuracion se
// activa SOLO cuando el workflow de Pages define GITHUB_PAGES=true; en local
// (`npm run dev` / `npm run build`) el proyecto se comporta como siempre.
const isPages = process.env.GITHUB_PAGES === "true";

// El sitio se publica en https://<usuario>.github.io/<repo>/, o sea bajo un
// subdirectorio. Sin basePath, todos los links y assets apuntarian a la raiz
// del dominio y romperian.
const repoBasePath = "/flash-urbano";

const nextConfig: NextConfig = {
  // Se inyecta en el bundle en tiempo de build. Lo necesita lib/asset.ts:
  // next/image NO le agrega el basePath a los archivos de public/ cuando las
  // imagenes van sin optimizar, asi que hay que prefijarlas a mano.
  env: { NEXT_PUBLIC_BASE_PATH: isPages ? repoBasePath : "" },
  ...(isPages
    ? {
        output: "export" as const,
        basePath: repoBasePath,
        assetPrefix: repoBasePath,
        // Genera <ruta>/index.html en vez de <ruta>.html: es lo que sirve
        // cualquier hosting estatico sin reglas de reescritura.
        trailingSlash: true,
        // /_next/image necesita servidor. En estatico las imagenes se sirven
        // tal cual, sin redimensionar.
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
