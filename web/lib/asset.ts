// En GitHub Pages el sitio no vive en la raiz del dominio sino bajo
// /flash-urbano. Next reescribe solo los links de navegacion y los chunks de
// _next; los archivos de `public/` referenciados desde <Image src="/foo.png">
// quedan sin prefijo cuando el build es estatico (images.unoptimized), y
// terminan dando 404.
//
// `asset()` agrega ese prefijo. En local NEXT_PUBLIC_BASE_PATH es "" y la
// funcion devuelve la ruta tal cual, asi que no cambia nada.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const asset = (path: string) => `${BASE_PATH}${path}`;
