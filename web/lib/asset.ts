// Prefija los archivos de `public/` con la base del sitio.
//
// Hoy esa base es **vacia**: desde el 2026-08-10 el sitio se sirve desde la raiz
// de https://flashurbano.uy, asi que `asset()` devuelve la ruta tal cual y esto
// no cambia nada. La funcion no sobra por eso.
//
// Por que sigue existiendo: next/image NO le agrega la base a los archivos de
// `public/` referenciados como <Image src="/foo.png"> cuando el build es
// estatico (images.unoptimized). Si el sitio volviera a servirse bajo un
// subdirectorio —otro hosting, una copia de staging— alcanza con que
// NEXT_PUBLIC_BASE_PATH deje de estar vacia en next.config.ts. Sin esta
// indireccion, esa mudanza seria editar cada componente que muestra una imagen.
//
// Es el mismo motivo por el que la direccion del API sale de la configuracion:
// donde vive el sitio no puede estar escrito adentro de las pantallas.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const asset = (path: string) => `${BASE_PATH}${path}`;
