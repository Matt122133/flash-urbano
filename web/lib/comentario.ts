// Si hay comentario que mostrar, y cual. Una sola respuesta para las cuatro
// pantallas.
//
// **Por que existe, y no es sobre-ingenieria de un `trim()`.**
//
// FR-009 dice que un pedido sin comentario tiene que verse **exactamente como
// antes de este feature**: sin etiqueta, sin dos puntos sueltos, sin espacio
// reservado. Eso es una regla de presentacion, y en este repo no hay forma de
// probarla sobre el componente: `vitest.config.ts` corre en `node` con
// `include: lib/**`, sin jsdom, y dice por escrito que montar un DOM seria
// infraestructura de mas. Montarla ahora seria la primera dependencia nueva de
// un feature que no agrega ninguna.
//
// Sacando la DECISION aca, se prueba con lo que ya existe. Es el mismo corte
// por el que `etiqueta.ts` esta separado de `etiqueta-pdf.ts`: una afirmacion
// sobre texto se prueba en tres lineas; la misma afirmacion sobre un PDF
// dibujado seria raspar bytes.
//
// Lo que esto NO prueba es que el componente efectivamente no dibuje nada. Eso
// sigue siendo el quickstart, a ojo. Lo que si garantiza es que **las cuatro
// pantallas tomen la misma decision**, que es donde estaba el riesgo real: que
// una se desalineara de las otras tres sin que nadie lo notara.
//
// Modulo puro: sin red, sin `window`, sin React.

/**
 * El comentario listo para mostrar, o `null` si no hay ninguno.
 *
 * Devuelve `null` —y no cadena vacia— a proposito: en un `if` las dos se
 * comportan igual, pero `null` se lee como "no hay" y `""` invita a mostrarlo
 * igual. Quien llama escribe `if (texto)` o `{texto && <Bloque/>}` y no se
 * puede equivocar.
 *
 * **El recorte de aca es para MOSTRAR, no para guardar.** Lo que se guarda lo
 * normaliza el servicio, que es el unico punto por el que pasan todas las
 * escrituras (contrato 1.1). Duplicar la regla de guardado en el navegador es
 * como se separan dos implementaciones de lo mismo; esta funcion existe para
 * decidir si se dibuja algo, y por eso tambien tolera lo que ya esta guardado.
 */
export function comentarioParaMostrar(
  crudo: string | null | undefined,
): string | null {
  if (crudo == null) return null;
  // `trim()` saca espacios y saltos de los EXTREMOS y no toca los de adentro:
  // una indicacion de tres renglones sigue teniendo sus tres renglones.
  const limpio = crudo.trim();
  return limpio === "" ? null : limpio;
}

/**
 * El tope de largo, en CARACTERES.
 *
 * **Tiene que coincidir con `ComentarioLargoMaximo` del servicio y con el
 * `CHECK` de la migracion `0009`**, que cuenta con `char_length`. Si el
 * contador de la pantalla midiera distinto que el servicio, la persona veria
 * que le queda lugar y el pedido le volveria rechazado.
 *
 * `String.length` cuenta unidades UTF-16, no caracteres: para las enes y las
 * tildes da lo mismo, pero un emoji cuenta dos. Es el unico caso en que la
 * pantalla y el servicio no coinciden, y se eligio no arrastrar un contador de
 * puntos de codigo por eso: el efecto es que un texto lleno de emoji se corta
 * un poco antes, nunca despues, asi que **la pantalla nunca deja escribir algo
 * que el servicio vaya a rechazar**. El error cae del lado seguro.
 */
export const COMENTARIO_LARGO_MAXIMO = 280;
