/**
 * La fecha de retiro.
 *
 * Vive en `lib/` y no adentro del formulario para poder probarlo: los errores
 * que importan estan en los bordes —cambio de mes, cambio de anio, el dia de
 * hoy— y eso se verifica con tests, no mirando la pantalla.
 *
 * Todo aca es puro: recibe strings y devuelve un veredicto. Sin `Date.now()`
 * escondido — el "hoy" entra por parametro, porque si no el test tendria que
 * viajar en el tiempo para correr dos veces igual.
 *
 * **Antes este modulo comparaba retiro contra entrega**: margen minimo de dos
 * horas, entrega no anterior al retiro, cruce de medianoche. Todo eso se fue en
 * `004`, cuando el cliente reemplazo la ventana de entrega elegida por quien
 * pide por un compromiso fijo de 24 horas desde el retiro. Ya no hay dos
 * momentos que comparar, asi que no hay coherencia que validar: queda una sola
 * regla, y por eso queda una sola funcion.
 */

/** `YYYY-MM-DD`, tal como lo entrega un `<input type="date">`. */
export type Fecha = string;
/** `HH:MM`, tal como lo entrega un `<input type="time">`. */
export type Hora = string;

/** El dia de hoy en formato `YYYY-MM-DD`, en la zona horaria del navegador. */
export function hoy(ahora: Date = new Date()): Fecha {
  const dosDigitos = (n: number) => String(n).padStart(2, "0");
  return [
    ahora.getFullYear(),
    dosDigitos(ahora.getMonth() + 1),
    dosDigitos(ahora.getDate()),
  ].join("-");
}

/**
 * Si la fecha de retiro cayo en un dia que ya termino.
 *
 * Se compara **por dia y no por instante**, y es deliberado: alguien cargando un
 * pedido a las 9 para retirar "hoy a las 8" es un caso raro, y rechazarlo por
 * minutos molestaria mas de lo que ayuda. Lo que no puede pasar es un dia que ya
 * paso.
 *
 * La comparacion es de strings y funciona porque `YYYY-MM-DD` ordena
 * lexicograficamente igual que cronologicamente — con el relleno de ceros que
 * garantiza `hoy()`.
 *
 * Con la fecha vacia no opina: que el campo este completo lo valida el
 * formulario aparte.
 */
export function retiroEnElPasado(
  fechaRetiro: Fecha,
  diaDeHoy: Fecha = hoy(),
): boolean {
  if (!fechaRetiro) return false;
  return fechaRetiro < diaDeHoy;
}

export const MENSAJE_RETIRO_EN_EL_PASADO =
  "Esa fecha ya pasó. Elegí hoy o un día posterior.";

/**
 * Cuanto tarda la entrega desde el retiro, tal como se le comunica a quien pide.
 *
 * Es **texto fijo y no un momento calculado** (FR-009a de `004`): el cliente
 * pidio un aviso, no una fecha de entrega. Calcular un instante concreto
 * reintroduce por la ventana el compromiso con horario que este cambio saca por
 * la puerta, y le pone minutero a una promesa que se cumple a mano.
 */
export const PLAZO_DE_ENTREGA = "Entregamos dentro de las 24 horas del retiro.";
