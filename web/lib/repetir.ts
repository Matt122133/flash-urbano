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

import type { PedidoGuardado } from "./api";
import type { Punto } from "./direccion";
import type { TamanoPaquete } from "./pedido";

/**
 * La direccion de retiro en la forma que acepta `rehidratarRetiro()`.
 *
 * Es la misma que el perfil guarda (`RetiroGuardado`), y se declara
 * estructuralmente en vez de importarla: ese tipo vive en `components/` y este
 * modulo no puede mirar para alla. TypeScript las hace compatibles igual.
 */
export type DireccionParaRehidratar = {
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
  // El RETIRO, como texto y con el punto tal cual se guardo. Hasta `010` este
  // campo era la entrega; se invirtieron los roles en `011`.
  retiro: {
    calle: string;
    esquina: string;
    numero: string;
    apto: string;
    cooperativa: boolean;
    punto: Punto | null;
  };
  /** La indicacion para el repartidor (026). */
  comentario: string;
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
export function entregaParaRehidratar(
  pedido: PedidoGuardado,
): DireccionParaRehidratar {
  const d = pedido.entrega;
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
 * El retiro del pedido, como TEXTO y con su punto tal cual quedo guardado.
 *
 * **No pasa por `rehidratarRetiro()` desde `011`, y eso es la mitad de FR-017.**
 * Aquella funcion existe para revalidar el punto ANTES de cobrar sobre el; el
 * retiro dejo de cobrar, asi que revalidarlo seria descartar un dato bueno por
 * una regla que ya no aplica. Se copia y listo.
 *
 * Si el pedido viejo no tiene punto de retiro —una calle homonima o fuera del
 * indice cuando se creo— llega `null`, que es exactamente lo que el formulario
 * espera de un retiro sin ubicar.
 */
export function retiroDelPedido(
  pedido: PedidoGuardado,
): CamposRepetidos["retiro"] {
  const d = pedido.retiro;
  return {
    calle: d.calle,
    esquina: d.esquina,
    numero: d.numero ?? "",
    apto: d.apto ?? "",
    cooperativa: d.cooperativa,
    punto: d.punto ?? null,
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
    // **Se sigue precargando aunque el formulario no lo muestre** (`014`, el
    // 2026-08-30). No se saca a proposito: el dia que el campo vuelva, repetir
    // un pedido tiene que volver a precargarlo solo, sin que nadie se acuerde
    // de reponer esta linea. Hoy el valor que produce no llega a ninguna
    // pantalla y no viaja al servicio — `crear-pedido.tsx` manda `"chico"` fijo.
    packageSize: tamanoDelPedido(pedido.paqueteTamano),
    // El formulario guarda la cantidad como texto: es lo que entrega un
    // `<input>`, y convertirla de ida y de vuelta solo agregaria un lugar donde
    // equivocarse.
    quantity: String(pedido.cantidad),
    receiverName: pedido.destinatarioNombre,
    receiverPhone: pedido.destinatarioTelefono,
    // **Esto NO es solo para repetir: sin esta linea, EDITAR un pedido le
    // borra el comentario.** Al editar se guarda el pedido ENTERO, asi que un
    // campo que el formulario no trajo se pisa con lo que este vacio — es
    // exactamente el defecto que se vio el 2026-09-06 con la fecha de retiro.
    //
    // Para repetir tambien corresponde: el resto de los campos se repiten, y
    // hacer la excepcion sin motivo seria la sorpresa. `??` porque el servicio
    // OMITE la clave cuando no hay comentario.
    comentario: pedido.comentario ?? "",
    // **La entrega ya no sale de aca desde `011`**: ubica, asi que se rehidrata
    // con `entregaParaRehidratar()` y su punto decide el precio. Lo que sale de
    // aca es el RETIRO, que paso a ser el texto que antes era la entrega.
    retiro: retiroDelPedido(pedido),
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


// Aca vivian `precioDeHoy()` y `huboReajuste()`, que decidian si avisarle a
// alguien que su envio salia distinto que la vez pasada. Se fueron el
// 2026-08-30 con `013`, junto con su unico consumidor: sin monto en pantalla no
// hay reajuste que avisar (FR-007).
//
// Con ellas se fue el ultimo uso que este modulo hacia de `resolverZona()`, asi
// que tambien se fue ese import. **Que un punto fuera de zona no produzca
// pedido sigue en pie**, pero nunca vivio aca: lo comprueba `validate()` en
// `components/pedido-form.tsx`, sobre el punto que la persona tiene marcado en
// ese momento (FR-014). Lo que este modulo sigue haciendo es revalidar que el
// punto guardado siga cayendo en su cuadra, mas arriba, y eso nunca dependio
// del precio.
//
// Reponerlas es barato si el precio vuelve: el monto congelado sigue viniendo
// en cada pedido guardado. Ver docs/decisions/price-not-shown.md.
