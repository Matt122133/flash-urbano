// DONDE va cada cosa en la etiqueta, en milimetros. Que DICE la hoja lo resuelve
// `etiqueta.ts`; pintarla es trabajo de `etiqueta-pdf.ts`.
//
// **Este modulo existe para que la geometria se pueda afirmar en una prueba.**
//
// Es el mismo corte que `020` hizo entre `etiqueta.ts` y `etiqueta-pdf.ts`, un
// nivel mas abajo, y por el mismo motivo. `028` achico la etiqueta de una hoja
// A4 a un rectangulo de 120 x 100 mm —un quinto de la superficie— y con eso
// aparecieron requisitos que antes no existian porque sobraba papel: que nada
// quede fuera del recorte (FR-003), que entre en un solo rectangulo (FR-004),
// que ningun cuerpo baje de su piso de legibilidad (FR-007). Afirmar eso sobre
// un PDF ya dibujado seria raspar bytes de un archivo comprimido. Afirmarlo
// sobre la lista de elementos que devuelve `maquetar()` es un `for` y un
// `expect`.
//
// **Todo en milimetros**, con el origen en el borde superior izquierdo de la
// hoja A4: es como piensa jsPDF y es como piensa una regla, que es la otra
// herramienta con la que se verifica este feature.
//
// Modulo puro: sin red, sin `window`, sin React y **sin importar jsPDF**. El
// ancho de un texto lo decide un medidor que se recibe por parametro, no una
// cuenta de caracteres — ver `Medir`.
import type { Etiqueta } from "./etiqueta";
import { SILUETA_PROPORCION } from "./silueta-camion";

// ---------------------------------------------------------------------------
// La hoja (research D2)
// ---------------------------------------------------------------------------

/**
 * El rectangulo recortable, sobre una A4 de 210 x 297.
 *
 * Arriba y a la izquierda, no centrado: recortar desde una esquina se hace
 * apoyando la hoja; recortar del medio, no. Los 15 mm de aire dejan las marcas
 * de corte a 10 mm del borde del papel, y el area no imprimible de una
 * impresora comun llega a 6.35 mm en el peor caso publicado.
 */
export const RECORTE = { x: 15, y: 15, ancho: 120, alto: 100 } as const;

/** Margen interno de la etiqueta. Lo de adentro es 110 x 90. */
const MARGEN = 5;

const UTIL_ANCHO = RECORTE.ancho - MARGEN * 2;
const UTIL_ALTO = RECORTE.alto - MARGEN * 2;

const IZQ = RECORTE.x + MARGEN;
const DER = RECORTE.x + RECORTE.ancho - MARGEN;
const ARRIBA = RECORTE.y + MARGEN;
const ABAJO = RECORTE.y + RECORTE.alto - MARGEN;

/** Las escuadras de corte: afuera del rectangulo, sin recuadro (FR-002). */
const MARCA = { separacion: 2, brazo: 5, grosor: 0.2 } as const;

// ---------------------------------------------------------------------------
// Tipografia
// ---------------------------------------------------------------------------

const MM_POR_PUNTO = 0.352778;

/** Alto de renglon para un cuerpo dado, en mm. Misma regla que usaba `020`. */
export const interlineado = (pt: number) => pt * MM_POR_PUNTO * 1.25;

/**
 * Los seis bloques de la hoja. Es por bloque —y no por posicion— que la prueba
 * compara cada cuerpo contra su piso.
 */
export type Bloque =
  | "encabezado"
  | "codigo"
  | "entrega"
  | "retiro"
  | "comentario"
  | "pie";

/** Cada renglon con su propio cuerpo. Un bloque tiene varios roles. */
export type Rol =
  | "marca"
  | "marcaBajada"
  | "codigoRotulo"
  | "codigoNumero"
  | "entregaRotulo"
  | "entregaZona"
  | "entregaNombre"
  | "entregaTexto"
  | "retiroRotulo"
  | "retiroNombre"
  | "retiroTexto"
  | "comentarioRotulo"
  | "comentarioTexto"
  | "pieRotulo"
  | "pieValor";

const BLOQUE_DE: Record<Rol, Bloque> = {
  marca: "encabezado",
  marcaBajada: "encabezado",
  codigoRotulo: "codigo",
  codigoNumero: "codigo",
  entregaRotulo: "entrega",
  entregaZona: "entrega",
  entregaNombre: "entrega",
  entregaTexto: "entrega",
  retiroRotulo: "retiro",
  retiroNombre: "retiro",
  retiroTexto: "retiro",
  comentarioRotulo: "comentario",
  comentarioTexto: "comentario",
  pieRotulo: "pie",
  pieValor: "pie",
};

/**
 * El cuerpo de cada rol **en el caso corriente**, que es al que se calza la
 * maqueta (FR-005): direcciones de largo normal, comentario corto o ausente.
 *
 * No se calza al maximo que el formulario acepta. Diseñar para ese maximo
 * obligaria a cuerpo chico en las once etiquetas de cada doce que no lo
 * alcanzan — decision de Mateo del 2026-09-19, ver el spec.
 */
const CORRIENTE: Record<Rol, number> = {
  marca: 11,
  marcaBajada: 5.5,
  codigoRotulo: 6.5,
  codigoNumero: 34,
  entregaRotulo: 7,
  entregaZona: 7,
  entregaNombre: 12,
  entregaTexto: 10,
  retiroRotulo: 7,
  retiroNombre: 9,
  retiroTexto: 8,
  comentarioRotulo: 6.5,
  comentarioTexto: 8.5,
  pieRotulo: 6.5,
  pieValor: 9.5,
};

/**
 * El piso de legibilidad de cada rol (FR-007).
 *
 * **La entrega pesa mas que el comentario**: es la direccion a la que hay que
 * llegar. El codigo tiene el piso mas alto en terminos absolutos porque es lo
 * unico que se lee de lejos — 26 pt dan una mayuscula de ~6.4 mm.
 *
 * **Son una hipotesis de papel hasta que se imprimen.** Salen de una cuenta de
 * altura de mayuscula, no de haberlos leido parado. El quickstart los confirma
 * o los tumba; si los tumba, se corrigen aca y se actualiza la tabla de
 * `research.md` D3 en el mismo cambio.
 */
export const PISO: Record<Rol, number> = {
  marca: 8,
  marcaBajada: 4.5,
  codigoRotulo: 6,
  codigoNumero: 26,
  entregaRotulo: 6,
  entregaZona: 6,
  entregaNombre: 9,
  entregaTexto: 8,
  retiroRotulo: 6,
  retiroNombre: 7.5,
  retiroTexto: 7,
  comentarioRotulo: 6,
  comentarioTexto: 6.5,
  pieRotulo: 6,
  // El pie lleva la fecha de retiro, que Diego lee de cerca pero lee. La tabla
  // de research D3 metia "rotulos y pie" en una sola fila con piso 6; son dos
  // cosas distintas y el valor del pie no baja de 7.
  pieValor: 7,
};

/**
 * El cuerpo de un rol para un `ajuste` dado.
 *
 * **Cada bloque viaja hacia su PROPIO piso**, y esto es lo que arreglo el
 * analyze del 2026-09-19. La tentacion es multiplicar todos los cuerpos por un
 * factor: no funciona, porque cada rol tiene distinto aire hasta su piso. Los
 * rotulos van de 6.5 a 6 pt (8 %); el codigo va de 34 a 26 (24 %). Un factor
 * global se frena cuando el rol mas apretado toca su piso y ahi se detiene
 * **con 9 mm todavia recuperables** en los demas — y el sintoma seria FR-008
 * cortando comentarios que entraban perfectamente.
 */
const cuerpo = (rol: Rol, ajuste: number) =>
  CORRIENTE[rol] + (PISO[rol] - CORRIENTE[rol]) * ajuste;

// ---------------------------------------------------------------------------
// La estructura
// ---------------------------------------------------------------------------

export type Rect = { x: number; y: number; ancho: number; alto: number };

export type Segmento = { x1: number; y1: number; x2: number; y2: number; grosor: number };

export type Peso = "normal" | "bold";

export type Alineacion = "izquierda" | "centro" | "derecha";

/**
 * Una cosa dibujable, ya medida y ubicada.
 *
 * `x`/`y` son la esquina superior izquierda de la **caja**, no la linea base:
 * lo que FR-003 pregunta es si la caja entra en el recorte. La linea base para
 * dibujar sale de `lineaBase()`.
 */
export type Elemento = {
  bloque: Bloque;
  rol?: Rol;
  tipo: "texto" | "recuadro" | "regla" | "imagen";
  x: number;
  y: number;
  ancho: number;
  alto: number;
  texto?: string;
  pt?: number;
  peso?: Peso;
  alineacion?: Alineacion;
  gris: number;
};

export type Maqueta = {
  /** El rectangulo recortable. La frontera de FR-003. */
  recorte: Rect;
  /** Las escuadras de corte. **Viven afuera del recorte a proposito.** */
  marcas: Segmento[];
  elementos: Elemento[];
  /**
   * Cuanto hubo que achicar (FR-006). **0 = nada se movio del cuerpo
   * corriente. 1 = todos los roles estan exactamente en su piso.**
   */
  ajuste: number;
  /** `true` solo si se activo el ultimo recurso de FR-008. */
  comentarioCortado: boolean;
};

/**
 * Mide el ancho de un texto, en mm.
 *
 * **Se inyecta y no se importa de jsPDF** (research D5). Asi este modulo queda
 * puro, y sobre todo: la medicion que usa la prueba es **la misma que usa el
 * dibujo**, no una imitacion. Una prueba de geometria contra un medidor falso
 * prueba la imitacion.
 *
 * El corte de un texto en renglones lo decide este medidor y nunca un conteo de
 * caracteres: "Piñeyro" y "MMMMMMM" tienen las mismas siete letras y ocupan
 * anchos muy distintos. Contar caracteres es como se desborda una etiqueta.
 */
export type Medir = (texto: string, pt: number, peso: Peso) => number;

/** Escala de grises, no colores: la hoja se imprime en mono, igual que en `020`. */
const NEGRO = 17;
const GRIS = 105;

/** Donde va la linea base de un elemento de texto, para dibujarlo. */
export const lineaBase = (e: Elemento) => e.y + (e.pt ?? 0) * MM_POR_PUNTO;

// ---------------------------------------------------------------------------
// maquetar
// ---------------------------------------------------------------------------

const AIRE = {
  encabezado: 2,
  codigo: 2.5,
  entrega: 2,
  retiro: 2,
  comentario: 1.5,
} as const;

/** La silueta del camion, en el encabezado. */
const SILUETA_ALTO = 5;

export function maquetar(e: Etiqueta, medir: Medir): Maqueta {
  // 1. El caso corriente: sin achicar nada. Es lo que tiene que pasar casi
  //    siempre, y FR-005 dice que la maqueta se calza a esto.
  let intento = componer(e, medir, 0, null);

  let ajuste = 0;
  let renglonesComentario: number | null = null;

  if (!intento.entra) {
    // 2. Achicar (FR-006). El alto baja monotonamente con `ajuste`, asi que
    //    alcanza con buscar el menor que entre: se achica lo justo y no mas.
    ajuste = menorAjusteQueEntra(e, medir);
    intento = componer(e, medir, ajuste, null);

    if (!intento.entra) {
      // 3. El ultimo recurso (FR-008), y **solo con ajuste === 1**: con todos
      //    los roles exactamente en su piso. Mientras quede aire en algun lado,
      //    cortar seria mentir. Cede el comentario y nada mas: nunca una
      //    direccion, nunca un telefono.
      ajuste = 1;
      renglonesComentario = renglonesQueEntran(e, medir);
      intento = componer(e, medir, 1, renglonesComentario);
    }
  }

  return {
    recorte: { ...RECORTE },
    marcas: escuadras(),
    elementos: intento.elementos,
    ajuste,
    comentarioCortado: intento.cortado,
  };
}

/** Busca el menor `ajuste` de [0,1] que hace entrar el contenido. */
function menorAjusteQueEntra(e: Etiqueta, medir: Medir): number {
  if (componer(e, medir, 1, null).entra === false) return 1;
  let bajo = 0;
  let alto = 1;
  // 20 pasos dejan el error por debajo de una millonesima de punto: mucho mas
  // fino que cualquier diferencia visible en papel.
  for (let i = 0; i < 20; i++) {
    const medio = (bajo + alto) / 2;
    if (componer(e, medir, medio, null).entra) alto = medio;
    else bajo = medio;
  }
  return alto;
}

/** Cuantos renglones de comentario entran con todo en su piso. */
function renglonesQueEntran(e: Etiqueta, medir: Medir): number {
  const total = componer(e, medir, 1, null).renglonesComentario;
  for (let n = total - 1; n > 0; n--) {
    if (componer(e, medir, 1, n).entra) return n;
  }
  return 0;
}

type Intento = {
  elementos: Elemento[];
  entra: boolean;
  cortado: boolean;
  renglonesComentario: number;
};

/**
 * Arma la hoja para un `ajuste` dado.
 *
 * El contenido fluye desde arriba; **el pie va anclado al borde de abajo**,
 * igual que en `020`. "Entra" significa que lo que baja desde arriba no llega a
 * pisar el pie.
 */
function componer(
  e: Etiqueta,
  medir: Medir,
  ajuste: number,
  maxRenglonesComentario: number | null,
): Intento {
  const elementos: Elemento[] = [];
  const pt = (rol: Rol) => cuerpo(rol, ajuste);

  const texto = (
    rol: Rol,
    contenido: string,
    x: number,
    y: number,
    opciones: { peso?: Peso; gris?: number; alineacion?: Alineacion } = {},
  ): Elemento => {
    const cuerpoPt = pt(rol);
    const peso = opciones.peso ?? "normal";
    const ancho = medir(contenido, cuerpoPt, peso);
    const alineacion = opciones.alineacion ?? "izquierda";
    // La caja siempre se guarda desde su borde izquierdo, cualquiera sea la
    // alineacion: es lo que FR-003 necesita comparar.
    const izquierda =
      alineacion === "centro" ? x - ancho / 2 : alineacion === "derecha" ? x - ancho : x;
    return {
      bloque: BLOQUE_DE[rol],
      rol,
      tipo: "texto",
      x: izquierda,
      y,
      ancho,
      alto: interlineado(cuerpoPt),
      texto: contenido,
      pt: cuerpoPt,
      peso,
      alineacion,
      gris: opciones.gris ?? NEGRO,
    };
  };

  // --- El pie, primero, porque va anclado abajo y define cuanto lugar hay ---
  const altoPie = 1.5 + interlineado(pt("pieRotulo")) + interlineado(pt("pieValor"));
  const pieY = ABAJO - altoPie;

  elementos.push({
    bloque: "pie",
    tipo: "regla",
    x: IZQ,
    y: pieY,
    ancho: UTIL_ANCHO,
    alto: 0.5,
    gris: NEGRO,
  });

  const celda = (rotulo: string, valor: string, x: number) => {
    const y = pieY + 1.5;
    elementos.push(texto("pieRotulo", rotulo, x, y, { gris: GRIS }));
    elementos.push(
      texto("pieValor", valor, x, y + interlineado(pt("pieRotulo")), { peso: "bold" }),
    );
  };

  celda("FECHA DE RETIRO", e.fechaRetiro, IZQ);
  celda(
    "PAQUETES",
    `${e.cantidad} ${e.cantidad === 1 ? "paquete" : "paquetes"}`,
    IZQ + UTIL_ANCHO / 2,
  );

  // --- Lo que fluye desde arriba ---
  let y = ARRIBA;

  // Encabezado: la silueta y el nombre COMPUESTO como texto, nunca el logo a
  // color — sobre papel blanco la mitad de sus elementos son blancos.
  elementos.push({
    bloque: "encabezado",
    tipo: "imagen",
    x: IZQ,
    y,
    ancho: SILUETA_ALTO * SILUETA_PROPORCION,
    alto: SILUETA_ALTO,
    gris: NEGRO,
  });

  const xMarca = IZQ + SILUETA_ALTO * SILUETA_PROPORCION + 2.5;
  const altoMarca = interlineado(pt("marca"));
  elementos.push(
    texto("marca", "FLASH URBANO", xMarca, y + SILUETA_ALTO - altoMarca, { peso: "bold" }),
  );
  elementos.push(
    texto("marcaBajada", "LOGISTICA Y TRANSPORTE", xMarca, y + SILUETA_ALTO, { gris: GRIS }),
  );

  // La regla va debajo de la CAJA ENTERA de la bajada, no a media altura. Con
  // un factor de 0.7 la linea caia en 26.7 y la linea base del texto en 26.94:
  // la regla tachaba "LOGISTICA Y TRANSPORTE". Compilaba perfecto y se veia
  // solo en el papel.
  y += SILUETA_ALTO + interlineado(pt("marcaBajada")) + 0.8;
  elementos.push({
    bloque: "encabezado",
    tipo: "regla",
    x: IZQ,
    y,
    ancho: UTIL_ANCHO,
    alto: 0.5,
    gris: NEGRO,
  });
  y += AIRE.encabezado;

  // El codigo: lo unico que se lee de lejos (FR-010, FR-011).
  const altoNumero = interlineado(pt("codigoNumero"));
  const altoCaja = 1.6 + interlineado(pt("codigoRotulo")) + altoNumero + 1.2;
  elementos.push({
    bloque: "codigo",
    tipo: "recuadro",
    x: IZQ,
    y,
    ancho: UTIL_ANCHO,
    alto: altoCaja,
    gris: NEGRO,
  });
  elementos.push(
    texto("codigoRotulo", "CODIGO DEL PEDIDO", RECORTE.x + RECORTE.ancho / 2, y + 1.6, {
      gris: GRIS,
      alineacion: "centro",
    }),
  );
  elementos.push(
    texto(
      "codigoNumero",
      e.codigo,
      RECORTE.x + RECORTE.ancho / 2,
      y + 1.6 + interlineado(pt("codigoRotulo")),
      { peso: "bold", alineacion: "centro" },
    ),
  );
  y += altoCaja + AIRE.codigo;

  // Las dos direcciones. La entrega pesa mas: es la puerta a la que hay que
  // llegar. El retiro esta para poder devolver el paquete, que es el caso raro.
  y = extremo(
    "ENTREGAR A",
    e.entrega,
    { rotulo: "entregaRotulo", nombre: "entregaNombre", texto: "entregaTexto" },
    y,
    true,
  );
  y += AIRE.entrega;
  y = extremo(
    "RETIRAR DE",
    e.retiro,
    { rotulo: "retiroRotulo", nombre: "retiroNombre", texto: "retiroTexto" },
    y,
    false,
  );
  y += AIRE.retiro;

  function extremo(
    titulo: string,
    b: Etiqueta["entrega"],
    roles: { rotulo: Rol; nombre: Rol; texto: Rol },
    desde: number,
    conZona: boolean,
  ): number {
    let cursor = desde;
    elementos.push(texto(roles.rotulo, titulo, IZQ, cursor, { peso: "bold", gris: GRIS }));

    // La zona **solo aparece si esta**: un pedido anterior a `011` no tiene
    // punto de entrega, y entonces el renglon no existe — ni hueco ni leyenda.
    // Nunca se deduce de la direccion escrita.
    if (conZona && b.zona) {
      elementos.push(
        texto("entregaZona", b.zona.toUpperCase(), DER, cursor, {
          peso: "bold",
          alineacion: "derecha",
        }),
      );
    }

    cursor += interlineado(pt(roles.rotulo));
    elementos.push({
      bloque: BLOQUE_DE[roles.rotulo],
      tipo: "regla",
      x: IZQ,
      y: cursor,
      ancho: UTIL_ANCHO,
      alto: 0.2,
      gris: GRIS,
    });
    cursor += 0.5;

    for (const linea of envolver(b.nombre, pt(roles.nombre), "bold", medir)) {
      elementos.push(texto(roles.nombre, linea, IZQ, cursor, { peso: "bold" }));
      cursor += interlineado(pt(roles.nombre));
    }
    for (const linea of envolver(b.direccion, pt(roles.texto), "normal", medir)) {
      elementos.push(texto(roles.texto, linea, IZQ, cursor));
      cursor += interlineado(pt(roles.texto));
    }
    elementos.push(texto(roles.texto, `Tel. ${b.telefono}`, IZQ, cursor, { gris: GRIS }));
    cursor += interlineado(pt(roles.texto));

    return cursor;
  }

  // El comentario del cliente (026). **Sin comentario no se dibuja NADA**, ni el
  // rotulo ni el espacio: la hoja sale identica a como salia sin el.
  let renglonesComentario = 0;
  let cortado = false;

  if (e.comentario) {
    const renglones = renglonesDelComentario(e.comentario, pt("comentarioTexto"), medir);
    renglonesComentario = renglones.length;

    const limite = maxRenglonesComentario;
    const aDibujar =
      limite === null || limite >= renglones.length
        ? renglones
        : marcarCorte(renglones.slice(0, limite));
    cortado = limite !== null && limite < renglones.length;

    if (aDibujar.length > 0) {
      elementos.push(texto("comentarioRotulo", "COMENTARIO", IZQ, y, { peso: "bold", gris: GRIS }));
      y += interlineado(pt("comentarioRotulo"));
      for (const linea of aDibujar) {
        // Un renglon vacio es una separacion que la persona puso a proposito: se
        // respeta como espacio, sin dibujar un texto vacio.
        if (linea !== "") elementos.push(texto("comentarioTexto", linea, IZQ, y));
        y += interlineado(pt("comentarioTexto"));
      }
    }
  }

  return {
    elementos,
    entra: y <= pieY - AIRE.comentario,
    cortado,
    renglonesComentario,
  };
}

/** Le pone la marca de que sigue al ultimo renglon que sobrevivio. */
function marcarCorte(renglones: string[]): string[] {
  if (renglones.length === 0) return renglones;
  const copia = [...renglones];
  copia[copia.length - 1] = `${copia[copia.length - 1].trimEnd()}…`;
  return copia;
}

/**
 * Los renglones del comentario: se respeta lo que escribio la persona **y
 * ademas** se envuelve por ancho. Tres indicaciones se imprimen en tres
 * bloques, no en un parrafo corrido.
 */
function renglonesDelComentario(comentario: string, pt: number, medir: Medir): string[] {
  const salida: string[] = [];
  for (const renglon of comentario.split("\n")) {
    if (renglon.trim() === "") salida.push("");
    else salida.push(...envolver(renglon, pt, "normal", medir));
  }
  return salida;
}

/**
 * Corta un texto en renglones que entran en el ancho util (FR-012).
 *
 * El corte lo decide el medidor, no un conteo de caracteres. Una palabra sola
 * mas ancha que la linea se deja igual: partirla por la mitad se lee peor que
 * dejarla asomar, y la guarda de FR-003 lo va a marcar si llega a pasar.
 */
function envolver(texto: string, pt: number, peso: Peso, medir: Medir): string[] {
  const palabras = texto.split(/\s+/).filter((p) => p !== "");
  if (palabras.length === 0) return [""];

  const lineas: string[] = [];
  let actual = "";

  for (const palabra of palabras) {
    const tentativa = actual === "" ? palabra : `${actual} ${palabra}`;
    if (medir(tentativa, pt, peso) <= UTIL_ANCHO) {
      actual = tentativa;
    } else {
      if (actual !== "") lineas.push(actual);
      actual = palabra;
    }
  }
  if (actual !== "") lineas.push(actual);
  return lineas;
}

/**
 * Las cuatro escuadras de corte, **afuera del rectangulo** (FR-002).
 *
 * Escuadras y no recuadro: la etiqueta recortada queda sin marco, y un corte
 * 1 mm torcido no deja medio renglon de linea impresa en el borde. Es lo que
 * hace la imprenta, y por eso casi no se ve un marco en una etiqueta real.
 */
function escuadras(): Segmento[] {
  const { x, y, ancho, alto } = RECORTE;
  const s = MARCA.separacion;
  const b = MARCA.brazo;
  const g = MARCA.grosor;
  const esquinas: { ex: number; ey: number; dx: number; dy: number }[] = [
    { ex: x, ey: y, dx: -1, dy: -1 },
    { ex: x + ancho, ey: y, dx: 1, dy: -1 },
    { ex: x, ey: y + alto, dx: -1, dy: 1 },
    { ex: x + ancho, ey: y + alto, dx: 1, dy: 1 },
  ];

  return esquinas.flatMap(({ ex, ey, dx, dy }) => [
    // El brazo horizontal y el vertical, los dos arrancando separados del
    // vertice para que la tijera vea el punto exacto sin que haya tinta encima.
    { x1: ex + dx * s, y1: ey, x2: ex + dx * (s + b), y2: ey, grosor: g },
    { x1: ex, y1: ey + dy * s, x2: ex, y2: ey + dy * (s + b), grosor: g },
  ]);
}

/** Lo que mide la hoja util, expuesto para que la prueba no repita la cuenta. */
export const UTIL = { ancho: UTIL_ANCHO, alto: UTIL_ALTO } as const;
