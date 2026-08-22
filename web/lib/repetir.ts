// Lo que hace falta para repetir un pedido, sin nada de React.
//
// **No puede importar de `components/`.** La dependencia va en un solo sentido
// —`components/` usa `lib/`, nunca al reves— y ademas es lo que deja este modulo
// probable en el entorno `node` que ya existe. Es el mismo criterio con el que
// `007` puso `armarCuerpoPedido()` en `lib/pedido.ts` en vez de adentro del
// formulario.
//
// Lo que **si** vive en la capa de componentes es el armado final del
// `FormState`, porque necesita `EstadoDireccion` y llamar a `rehidratarRetiro()`.
// Ver `components/pedido/crear-pedido.tsx`.

import type { DireccionGuardada, PedidoGuardado } from "./api";
import type { Punto } from "./direccion";
import type { TamanoPaquete } from "./pedido";
import { resolverZona } from "./zona-lookup";

/**
 * La direccion de retiro en la forma que acepta `rehidratarRetiro()`.
 *
 * Es la misma que el perfil guarda (`RetiroGuardado`), y se declara
 * estructuralmente en vez de importarla: ese tipo vive en `components/` y este
 * modulo no puede mirar para alla. TypeScript las hace compatibles igual.
 */
export type RetiroParaRehidratar = {
  calle: string;
  esquina: string;
  numero: string;
  punto: Punto | null;
  apto: string | null;
  cooperativa: boolean | null;
};

/**
 * Los campos sueltos del formulario que salen del pedido.
 *
 * **Cuatro cosas NO estan aca, y ninguna es un olvido**:
 *
 * - `pickupDate` y `pickupTime` (FR-014). La fecha del pedido viejo ya paso —el
 *   servicio rechaza una fecha pasada, validada en hora de Montevideo— asi que
 *   copiarla seria precargar un dato invalido. El formulario los muestra vacios
 *   solo, si `inicial` no los trae.
 * - `precio` y `zonaId` (FR-015). El precio se resuelve del punto en el momento
 *   de repetir, nunca se hereda. Los del pedido viejo se leen para una sola
 *   cosa: decidir si hubo reajuste.
 */
export type CamposRepetidos = {
  name: string;
  phone: string;
  packageSize: TamanoPaquete | "";
  quantity: string;
  receiverName: string;
  receiverPhone: string;
  entrega: {
    calle: string;
    esquina: string;
    numero: string;
    apto: string;
    cooperativa: boolean;
  };
};

/** Los tres tamanos que el servicio acepta. */
const TAMANOS: readonly TamanoPaquete[] = ["chico", "mediano", "grande"];

/**
 * El retiro del pedido, listo para rehidratar.
 *
 * `numero` viaja nulable desde la base y aca tiene que ser texto: nulo se
 * convierte en vacio, que es como el formulario representa "no lo dijo".
 * `apto` y `cooperativa` se dejan nulables porque `rehidratarRetiro()` ya
 * distingue esos dos casos y lo hace bien.
 */
export function retiroDelPedido(pedido: PedidoGuardado): RetiroParaRehidratar {
  const d = pedido.retiro;
  return {
    calle: d.calle,
    esquina: d.esquina,
    numero: d.numero ?? "",
    punto: d.punto ?? null,
    apto: d.apto,
    cooperativa: d.cooperativa,
  };
}

/**
 * Todo lo demas del pedido, tal como se guardo.
 *
 * **Incluye el nombre y el telefono de quien envia, del pedido y no del perfil.**
 * Es la decision del 2026-08-22: si el boton dice repetir, repite, y ningun dato
 * se cambia solo por detras. Lo que la hace aceptable es que todo esto es
 * editable antes de confirmar (FR-013a) — sin esa mitad, seria resucitar en
 * silencio un telefono que la persona ya cambio.
 */
export function camposDelPedido(pedido: PedidoGuardado): CamposRepetidos {
  return {
    name: pedido.remitenteNombre,
    phone: pedido.remitenteTelefono,
    packageSize: tamanoDelPedido(pedido.paqueteTamano),
    // El formulario guarda la cantidad como texto: es lo que entrega un
    // `<input>`, y convertirla de ida y de vuelta solo agregaria un lugar donde
    // equivocarse.
    quantity: String(pedido.cantidad),
    receiverName: pedido.destinatarioNombre,
    receiverPhone: pedido.destinatarioTelefono,
    entrega: entregaDelPedido(pedido.entrega),
  };
}

/**
 * El tamano, si es uno de los que el formulario conoce.
 *
 * Un valor desconocido devuelve `""` —el campo queda sin elegir— y **no se
 * aproxima al mas parecido**. Es FR-017: un dato que hoy no se puede resolver
 * llega vacio, nunca con un valor inventado, porque un campo en blanco se ve y
 * un valor aproximado se confirma sin que nadie lo mire.
 *
 * Puede pasar de verdad: el servicio guarda `paquete_tamano` como texto con
 * CHECK justamente porque la lista puede crecer, y una version vieja del sitio
 * puede toparse con un valor nuevo.
 */
export function tamanoDelPedido(tamano: string): TamanoPaquete | "" {
  return (TAMANOS as readonly string[]).includes(tamano)
    ? (tamano as TamanoPaquete)
    : "";
}

/**
 * La entrega, como texto.
 *
 * **No se intenta resolver el cruce contra el indice de calles**, y es
 * deliberado: la entrega no tiene punto guardado —`003` la dejo como texto a
 * proposito— y sin punto no hay con que desempatar entre las ~50 parejas de
 * calles homonimas de Montevideo. Elegir la primera coincidencia seria
 * exactamente el valor aproximado que FR-017 prohibe. El texto guardado, en
 * cambio, es exacto: es lo que la persona escribio.
 */
function entregaDelPedido(d: DireccionGuardada): CamposRepetidos["entrega"] {
  return {
    calle: d.calle,
    esquina: d.esquina,
    numero: d.numero ?? "",
    apto: d.apto ?? "",
    cooperativa: d.cooperativa,
  };
}

/**
 * El precio que corresponde HOY a un punto, o `null` si no cae en ninguna zona.
 *
 * `null` no es un error de esta funcion: es la respuesta correcta a un punto
 * fuera de toda zona, y quien llama tiene que tratarla como "no hay precio y no
 * hay pedido" (FR-016, Principio V). Nunca la zona mas cercana.
 */
export function precioDeHoy(punto: Punto | null): number | null {
  if (!punto) return null;
  return resolverZona(punto.lat, punto.lng)?.precio ?? null;
}

/**
 * Si el precio cambio desde que se hizo el pedido original (FR-015a).
 *
 * Se compara **contra el precio congelado del pedido**, no contra su `zonaId`:
 * lo que la persona necesita saber es que va a pagar otra cosa, y eso puede
 * pasar por dos caminos distintos —cambiaron los precios de las zonas, o se
 * corrigio un limite y el punto quedo en otra zona—. Los dos terminan en el
 * mismo aviso.
 *
 * Sin precio de hoy no hay reajuste que avisar: ese caso es el de FR-016, que
 * corta antes y no deja confirmar.
 */
export function huboReajuste(
  precioOriginal: number,
  precioActual: number | null,
): boolean {
  if (precioActual === null) return false;
  return precioActual !== precioOriginal;
}
