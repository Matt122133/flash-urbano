// Reconstruye el estado del bloque de direccion a partir de la direccion de
// retiro guardada en el perfil.
//
// Se extrajo de `formulario-perfil.tsx` en `007`, cuando el formulario de pedido
// necesito lo mismo para precargarse (FR-023). Es codigo delicado y ganado a los
// golpes —las calles homonimas del indice de Montevideo— y tener dos copias es
// como una recibe el arreglo y la otra no.
//
// **Los dos consumidores usan el mismo resultado y deciden distinto**, y esa
// diferencia es lo que justifica que `puntoEnLaCuadra` sea parte del contrato en
// vez de un detalle interno:
//
//   - El PERFIL muestra la direccion guardada. Un punto que ya no cae en su
//     cuadra sigue siendo lo que la persona guardo, y mostrarlo es correcto.
//   - El PEDIDO **cobra** sobre ese punto. FR-022 prohibe cobrar sobre un punto
//     guardado sin revalidar que sigue cayendo en la cuadra declarada, asi que
//     ahi no alcanza con mostrarlo: hay que descartarlo y avisar.

import {
  ESTADO_DIRECCION_VACIO,
  type EstadoDireccion,
} from "@/components/bloque-direccion";
import {
  buscarEsquina,
  cargarIndice,
  contiene,
  normalizar,
  regionPermitida,
  type Calle,
  type Esquina,
  type Indice,
} from "@/lib/direcciones";
import type { RetiroGuardado } from "./proveedor-sesion";

export type ResultadoRehidratacion = {
  /** El estado listo para montar en `BloqueDireccion`. */
  estado: EstadoDireccion;
  /**
   * El indice resolvio el cruce. En false la pantalla queda degradada —se ve la
   * direccion pero no se puede ajustar el punto—, no vacia.
   */
  ubicable: boolean;
  /**
   * El punto guardado cae dentro de la cuadra que declara la direccion.
   *
   * En false, **el punto envejecio**: el indice de calles se regenero y las
   * esquinas se movieron, o la direccion cambio. Quien cobra sobre este punto
   * tiene que revalidarlo antes (FR-022); quien solo lo muestra, no.
   *
   * Es `false` tambien cuando no hay punto guardado o cuando no se pudo ubicar:
   * en los dos casos la respuesta honesta a "¿esta el punto en su cuadra?" es
   * que no se sabe, y tratar "no se sabe" como "si" es exactamente el error que
   * FR-022 evita.
   */
  puntoEnLaCuadra: boolean;
};

/**
 * **Todas** las calles que se muestran con ese nombre, no la primera.
 *
 * `callePorNombre` de `lib/direcciones.ts` devuelve la primera coincidencia, y
 * eso alcanza para las pruebas pero **no para reconstruir una direccion
 * guardada**: el indice de Montevideo tiene 50 grupos de nombres homonimos —100
 * calles— que se normalizan al mismo texto, casi siempre porque el dato de
 * origen escribio la misma calle con y sin tilde.
 *
 * El caso que lo destapo: `Vicente Yañez Pinzón` (id 255, una sola esquina) y
 * `Vicente Yáñez Pinzón` (id 3331, veinticuatro) son dos entradas distintas del
 * indice. Quedarse con la primera hacia que el cruce guardado **no existiera**
 * al volver, y la pantalla decia "no pudimos ubicarla" sobre una direccion
 * perfectamente valida.
 *
 * No se arregla en `callePorNombre` porque `lib/direcciones.ts` esta fuera del
 * `covers:`, y porque aca hay algo que esa funcion no tiene: el punto guardado,
 * que es lo que permite elegir bien entre los homonimos.
 */
function callesPorNombre(indice: Indice, nombre: string): Calle[] {
  const q = normalizar(nombre);
  return indice.calles.filter((c) => c.busqueda === q);
}

/**
 * Reconstruye el estado del bloque de direccion a partir de lo guardado.
 *
 * Es lo que hace cierto a FR-019a: no alcanza con volver a escribir los tres
 * textos en los campos. Sin la `Esquina` resuelta no hay cuadra, sin cuadra no
 * hay region, y sin region el mapa no deja arrastrar ni dibuja el limite — o sea
 * que el punto ajustado se veria pero no se podria corregir.
 *
 * Cuando el par calle/esquina da varios cruces, **el punto guardado desempata**:
 * se elige el candidato en cuya cuadra cae. Preguntarle de nuevo a la persona
 * cual era el suyo, cuando el dato para saberlo ya esta guardado, seria hacerle
 * repetir una decision que ya tomo.
 */
export async function rehidratarRetiro(
  retiro: RetiroGuardado,
): Promise<ResultadoRehidratacion> {
  // Los tres textos y el punto se muestran pase lo que pase. Que el indice no
  // resuelva la direccion degrada la pantalla —no se puede ajustar el punto—
  // pero no la deja vacia: ver la direccion guardada sin poder moverla es mejor
  // que no verla.
  const base: EstadoDireccion = {
    direccion: {
      ...ESTADO_DIRECCION_VACIO.direccion,
      calle: retiro.calle,
      esquina: retiro.esquina,
      numero: retiro.numero,
      punto: retiro.punto ?? null,
      // Nulo se muestra como el estado vacio del bloque: campo en blanco y
      // ninguna opcion de cooperativa marcada. Es la diferencia entre "no lo
      // dijo" y "dijo que no".
      apto: retiro.apto ?? "",
      cooperativa: retiro.cooperativa ?? false,
    },
    esquina: null,
    cualEsLaCalle: "A",
    candidatos: [],
  };

  const noUbicable: ResultadoRehidratacion = {
    estado: base,
    ubicable: false,
    puntoEnLaCuadra: false,
  };

  // No lanza: un indice caido y una calle que ya no existe llevan al mismo
  // lugar, y quien llama no tiene nada distinto que hacer con cada caso.
  let indice: Indice;
  try {
    indice = await cargarIndice();
  } catch {
    return noUbicable;
  }

  // Todas las combinaciones de homonimos, no una sola: con dos nombres que
  // tengan dos entradas cada uno hay cuatro pares posibles, y **solo uno cruza
  // de verdad**.
  const calles = callesPorNombre(indice, retiro.calle);
  const cruzadas = callesPorNombre(indice, retiro.esquina);
  if (calles.length === 0 || cruzadas.length === 0) return noUbicable;

  const candidatos: { esquina: Esquina; cual: "A" | "B" }[] = [];
  for (const calle of calles) {
    for (const cruzada of cruzadas) {
      for (const e of buscarEsquina(indice, calle, cruzada)) {
        candidatos.push({ esquina: e, cual: e.calleA.id === calle.id ? "A" : "B" });
      }
    }
  }
  if (candidatos.length === 0) return noUbicable;

  // El que contiene al punto guardado. Desempata tanto entre homonimos como
  // entre cruces repetidos del mismo par de nombres, que es el mismo problema
  // visto dos veces.
  const punto = retiro.punto;
  const contenedor =
    punto &&
    candidatos.find((c) => contiene(regionPermitida(c.esquina, c.cual), punto));

  // Si ninguno lo contiene —el indice se regenero y las cuadras se movieron— se
  // cae al primero, que al menos deja la pantalla usable con el limite dibujado.
  // **Y se dice que el punto no esta en su cuadra**, para que quien cobre pueda
  // decidir distinto de quien solo muestra.
  const elegido = contenedor || candidatos[0];

  return {
    estado: {
      ...base,
      esquina: elegido.esquina,
      cualEsLaCalle: elegido.cual,
      // El punto guardado manda sobre el del cruce: es el ajustado.
      direccion: { ...base.direccion, punto: punto ?? elegido.esquina.punto },
    },
    ubicable: true,
    puntoEnLaCuadra: Boolean(contenedor),
  };
}
