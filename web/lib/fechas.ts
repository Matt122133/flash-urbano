/**
 * Coherencia entre las fechas de retiro y de entrega.
 *
 * Vive en `lib/` y no adentro del formulario para poder probarlo: son cuatro
 * campos sueltos (`<input type="date">` y `<input type="time">`) y los errores
 * que importan estan todos en los bordes — mismo dia con distinta hora, mismo
 * instante exacto, cambio de mes. Eso se verifica con tests, no mirando la
 * pantalla.
 *
 * Todo aca es puro: recibe strings y devuelve un veredicto. Sin `Date.now()`
 * escondido — el "hoy" entra por parametro, porque si no el test tendria que
 * viajar en el tiempo para correr dos veces igual.
 */

/** `YYYY-MM-DD`, tal como lo entrega un `<input type="date">`. */
export type Fecha = string;
/** `HH:MM`, tal como lo entrega un `<input type="time">`. */
export type Hora = string;

export type ProblemaDeFechas =
  | "retiro-en-el-pasado"
  | "entrega-antes-del-retiro"
  | "margen-insuficiente";

/**
 * Cuanto tiene que haber, como minimo, entre retiro y entrega.
 *
 * No sale de ninguna restriccion tecnica: es cuanto tarda una persona en
 * cruzar Montevideo con un paquete. Aceptar un minuto de diferencia era
 * aceptar un pedido imposible de cumplir.
 */
export const MARGEN_MINIMO_MINUTOS = 120;

/**
 * Fecha y hora llevadas a minutos, para poder restarlas.
 *
 * Se arma con `Date.UTC` y no con `new Date(...)` local: aca no se quiere
 * ninguna zona horaria, solo aritmetica. Estas fechas son locales de Montevideo
 * por definicion, y lo unico que se hace con ellas es medir cuanto hay entre
 * una y otra.
 */
function enMinutos(fecha: Fecha, hora: Hora): number {
  const [a, m, d] = fecha.split("-").map(Number);
  const [h, min] = (hora || "00:00").split(":").map(Number);
  return Date.UTC(a, m - 1, d, h, min) / 60000;
}

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
 * Que tiene de malo esta combinacion de fechas, o `null` si esta bien.
 *
 * Sólo mira coherencia: que los campos esten completos lo valida el formulario
 * aparte, y con campos incompletos esta funcion no opina.
 */
export function problemaDeFechas(
  {
    fechaRetiro,
    horaRetiro,
    fechaEntrega,
    horaEntrega,
  }: {
    fechaRetiro: Fecha;
    horaRetiro: Hora;
    fechaEntrega: Fecha;
    horaEntrega: Hora;
  },
  diaDeHoy: Fecha = hoy(),
): ProblemaDeFechas | null {
  if (!fechaRetiro || !fechaEntrega) return null;

  // El retiro se compara por dia y no por instante: alguien cargando un pedido
  // a las 9 para retirar "hoy a las 8" es un caso raro, y rechazarlo por
  // minutos molestaria mas de lo que ayuda. Lo que no puede pasar es un dia que
  // ya termino.
  if (fechaRetiro < diaDeHoy) return "retiro-en-el-pasado";

  if (!horaRetiro || !horaEntrega) {
    // Sin horas, alcanza con comparar los dias.
    if (fechaEntrega < fechaRetiro) return "entrega-antes-del-retiro";
    return null;
  }

  const margen = enMinutos(fechaEntrega, horaEntrega) - enMinutos(fechaRetiro, horaRetiro);
  if (margen < 0) return "entrega-antes-del-retiro";
  if (margen < MARGEN_MINIMO_MINUTOS) return "margen-insuficiente";
  return null;
}

export const MENSAJES_DE_FECHAS: Record<ProblemaDeFechas, string> = {
  "retiro-en-el-pasado": "Esa fecha ya pasó. Elegí hoy o un día posterior.",
  "entrega-antes-del-retiro":
    "La entrega no puede ser antes del retiro: primero pasamos a buscar el paquete.",
  "margen-insuficiente": `Necesitamos al menos ${MARGEN_MINIMO_MINUTOS / 60} horas entre el retiro y la entrega.`,
};
