// Lo que se imprime y se pega al paquete, resuelto: que dice la hoja, no como
// se dibuja. Dibujarla es trabajo de `etiqueta-pdf.ts`.
//
// **Ese corte es lo que hace verificable el requisito central de este feature.**
// La etiqueta NO puede mostrar ningun importe (FR-007, Principio V), y una
// afirmacion sobre este objeto —texto inspeccionable— se prueba en tres lineas.
// La misma afirmacion sobre un PDF ya dibujado seria raspar bytes de un archivo
// comprimido.
//
// El otro motivo de existir es FR-003: el boton vive en DOS pantallas que no
// tienen el pedido en la misma forma. La confirmacion tiene el `FormState` que
// la persona acaba de tipear; Mis pedidos tiene un `PedidoGuardado` como lo
// devolvio el servicio, con otros nombres de campo y otros tipos. Las dos
// convergen aca, y por eso la misma etiqueta impresa desde los dos lados dice lo
// mismo. Sin este tipo, la hoja se arma dos veces y diverge sin que nadie lo
// note.
//
// Modulo puro: sin red, sin `window`, sin React. Corre en Node bajo Vitest,
// igual que `lib/repetir.ts`, que existe por exactamente esta razon.
import { comentarioParaMostrar } from "./comentario";
import { componerDireccion, type Direccion } from "./direccion";
import { resolverZona } from "./zona-lookup";

/** Un extremo del viaje, tal como sale impreso. */
export type BloqueEtiqueta = {
  nombre: string;
  telefono: string;
  /** Ya compuesta con `componerDireccion` (FR-010): papel y pantalla no pueden diferir. */
  direccion: string;
  /**
   * El nombre de la zona, `"Zona 3"`. **Solo en la entrega**, y **ausente** —no
   * vacio— cuando el pedido no tiene punto de entrega guardado.
   *
   * Ausente y no `""` por el mismo motivo que `016` uso para quien recibio: deja
   * distinguir "no hay punto" de "hay punto y no dio zona" sin que el dibujo
   * tenga que adivinar, y sin que el layout tenga que decidir si deja el renglon.
   *
   * **Nunca se deduce de la direccion escrita.** Sin punto no hay zona: adivinarla
   * es lo que el Principio V prohibe.
   */
  zona?: string;
};

/**
 * La hoja, resuelta.
 *
 * **Lo que este tipo NO tiene es tan parte del diseño como lo que tiene**, y no
 * es que se deje sin dibujar: no existe, asi que no se puede filtrar por error.
 *
 * - **Ningun importe** (FR-007). El Principio V no muestra precios, y una hoja
 *   titulada "resumen del pedido" es justo donde un total aparece solo.
 * - **Ni tamaño de paquete ni hora de retiro** (FR-008). Desde `014` el sitio
 *   manda `chico` y `16:00` fijos: son relleno, no datos que alguien eligio.
 * - **Ni la cedula de quien recibe** (FR-009). El servicio no se la manda al
 *   cliente, asi que aca no hay de donde sacarla ni por error.
 * - **Ni el estado.** Cambia; el papel no.
 * - **Ni coordenadas.** El punto resuelve la zona y no se imprime.
 */
export type Etiqueta = {
  /** `FU-####`. El elemento dominante de la hoja (FR-004). */
  codigo: string;
  entrega: BloqueEtiqueta;
  retiro: BloqueEtiqueta;
  /** `YYYY-MM-DD` tal como se guarda. No es un instante. */
  fechaRetiro: string;
  cantidad: number;
  /**
   * La indicacion del cliente para el viaje (026). **Ausente y no vacia**
   * cuando no hay, por el mismo motivo que `zona`: el dibujo no tiene que
   * decidir si deja el renglon, y sin comentario la hoja sale EXACTAMENTE como
   * antes de este feature (FR-009).
   *
   * **Este texto lo escribio el cliente y va pegado al paquete**, asi que lo
   * lee cualquiera que lo manipule. No es confidencial, y el formulario se lo
   * avisa a quien escribe (research D2).
   */
  comentario?: string;
};

/** El nombre de la zona de un punto, o ausente si no hay punto o no hay zona. */
function zonaDe(punto: { lat: number; lng: number } | null | undefined): string | undefined {
  if (!punto) return undefined;
  return resolverZona(punto.lat, punto.lng)?.nombre;
}

/** Deja fuera la clave cuando no hay comentario, igual que `conZona`. */
function conComentario(base: Omit<Etiqueta, "comentario">, crudo: string | null | undefined): Etiqueta {
  const texto = comentarioParaMostrar(crudo);
  return texto === null ? base : { ...base, comentario: texto };
}

/** Deja fuera la clave cuando no hay zona, en vez de ponerla en `undefined`. */
function conZona(base: Omit<BloqueEtiqueta, "zona">, zona: string | undefined): BloqueEtiqueta {
  return zona === undefined ? base : { ...base, zona };
}

/**
 * Lo que el formulario acaba de juntar, mas el codigo que devolvio el servicio.
 *
 * Se recibe suelto y no como `FormState` entero **a proposito**: este modulo no
 * tiene por que conocer el tipo de un componente, y asi la prueba puede armar el
 * caso sin construir un estado de formulario completo.
 */
export function etiquetaDelFormulario(datos: {
  codigo: string;
  nombre: string;
  telefono: string;
  retiro: Direccion;
  entrega: Direccion;
  destinatarioNombre: string;
  destinatarioTelefono: string;
  fechaRetiro: string;
  cantidad: string | number;
  comentario?: string;
}): Etiqueta {
  return conComentario({
    codigo: datos.codigo,
    entrega: conZona(
      {
        nombre: datos.destinatarioNombre,
        telefono: datos.destinatarioTelefono,
        direccion: componerDireccion(datos.entrega),
      },
      zonaDe(datos.entrega.punto),
    ),
    retiro: {
      nombre: datos.nombre,
      telefono: datos.telefono,
      direccion: componerDireccion(datos.retiro),
    },
    fechaRetiro: datos.fechaRetiro,
    // El formulario lo tiene como texto de un `<input>`; el servicio como numero.
    cantidad: Number(datos.cantidad),
  }, datos.comentario);
}

/**
 * La forma de un pedido guardado que esta etiqueta necesita, **descrita aca y no
 * importada de `lib/api.ts`**.
 *
 * Es la misma inversion que el formulario hace con `onConfirmar`, y por el mismo
 * motivo: este modulo no puede depender del cliente del servicio (FR-013), y la
 * guarda del grafo de imports —que toma de mas a proposito, hacia el lado
 * seguro— marcaria hasta un `import type`, que se borra al compilar.
 *
 * **No se pierde comprobacion**: TypeScript es estructural, asi que un
 * `PedidoGuardado` satisface esto sin declararlo, y si el servicio le renombra un
 * campo el error salta en quien llama. Lo que se gana es que este archivo no
 * nombre a `lib/api.ts` en ninguna forma.
 */
export type PedidoParaEtiqueta = {
  codigo: string;
  remitenteNombre: string;
  remitenteTelefono: string;
  destinatarioNombre: string;
  destinatarioTelefono: string;
  retiro: DireccionParaEtiqueta;
  entrega: DireccionParaEtiqueta;
  retiroFecha: string;
  cantidad: number;
  /** Ausente cuando el servicio no lo manda: no llega `null`, no llega. */
  comentario?: string;
};

type DireccionParaEtiqueta = {
  calle: string;
  esquina: string;
  numero: string | null;
  apto: string | null;
  cooperativa: boolean;
  punto?: { lat: number; lng: number } | null;
};

/** Una direccion guardada, al molde que `componerDireccion` espera. */
function comoDireccion(d: DireccionParaEtiqueta): Direccion {
  return {
    calle: d.calle,
    esquina: d.esquina,
    // El servicio los devuelve nullables; el compositor espera texto.
    numero: d.numero ?? "",
    apto: d.apto ?? "",
    cooperativa: d.cooperativa,
    punto: d.punto ?? null,
  };
}

/**
 * Un pedido tal como lo devolvio el servicio (Mis pedidos).
 *
 * **Es el unico de los dos que puede venir sin punto de entrega**: un pedido
 * anterior a `011`, cuando la zona salia del retiro y la entrega era texto sin
 * punto. Ahi la etiqueta sale igual, sin el bloque de zona.
 */
export function etiquetaDelPedido(p: PedidoParaEtiqueta): Etiqueta {
  return conComentario({
    codigo: p.codigo,
    entrega: conZona(
      {
        nombre: p.destinatarioNombre,
        telefono: p.destinatarioTelefono,
        direccion: componerDireccion(comoDireccion(p.entrega)),
      },
      zonaDe(p.entrega.punto),
    ),
    retiro: {
      nombre: p.remitenteNombre,
      telefono: p.remitenteTelefono,
      direccion: componerDireccion(comoDireccion(p.retiro)),
    },
    fechaRetiro: p.retiroFecha,
    cantidad: p.cantidad,
  }, p.comentario);
}

/** Nombre del archivo descargado. Lleva el codigo para que dos no se pisen (FR-016). */
export function nombreDeArchivo(e: Etiqueta): string {
  return `flash-urbano-${e.codigo}.pdf`;
}
