import { existsSync, readFileSync } from "node:fs";
import { dirname, join, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { componerDireccion, type Direccion } from "./direccion";
import {
  etiquetaDelFormulario,
  etiquetaDelPedido,
  nombreDeArchivo,
  type Etiqueta,
  type PedidoParaEtiqueta,
} from "./etiqueta";

// Lo que esta probado aca es lo que la etiqueta DICE, no como se ve. El aspecto
// es del quickstart: una hoja puede tener todos estos campos correctos y ser
// ilegible, y ninguna prueba de este archivo lo notaria.
//
// El caso mas importante del archivo es una PROHIBICION —que no haya ningun
// importe— y una prohibicion sin control positivo no vale nada: queda verde
// tambien cuando deja de mirar donde cree que mira. Por eso cada guarda negativa
// de abajo viene con su control.

// Ciudad de la Costa, el mismo punto interior que verifica zona-lookup.test.ts.
const PUNTO_ZONA_5 = { lat: -34.8349, lng: -55.9861 };

const RETIRO: Direccion = {
  calle: "Bulevar España",
  esquina: "Br. Artigas",
  numero: "2145",
  apto: "302",
  cooperativa: false,
  punto: null,
};

const ENTREGA: Direccion = {
  calle: "Av. Giannattasio",
  esquina: "Calle 20",
  numero: "890",
  apto: "",
  cooperativa: true,
  punto: PUNTO_ZONA_5,
};

/** El mismo pedido, en la forma que tiene la pantalla de confirmacion. */
const DESDE_FORMULARIO = {
  codigo: "FU-1234",
  nombre: "María Fernanda Piñeyro",
  telefono: "099 123 456",
  retiro: RETIRO,
  entrega: ENTREGA,
  destinatarioNombre: "Ñandú Rodríguez",
  destinatarioTelefono: "091 060 320",
  fechaRetiro: "2026-09-08",
  // El formulario lo tiene como texto de un <input>.
  cantidad: "3",
};

/** El MISMO pedido, en la forma que devuelve el servicio. */
const DESDE_SERVICIO: PedidoParaEtiqueta = {
  codigo: "FU-1234",
  remitenteNombre: "María Fernanda Piñeyro",
  remitenteTelefono: "099 123 456",
  destinatarioNombre: "Ñandú Rodríguez",
  destinatarioTelefono: "091 060 320",
  retiro: {
    calle: "Bulevar España",
    esquina: "Br. Artigas",
    numero: "2145",
    apto: "302",
    cooperativa: false,
    punto: null,
  },
  entrega: {
    calle: "Av. Giannattasio",
    esquina: "Calle 20",
    numero: "890",
    apto: null,
    cooperativa: true,
    punto: PUNTO_ZONA_5,
  },
  retiroFecha: "2026-09-08",
  cantidad: 3,
};

/** Todo el texto de una etiqueta, para poder afirmar sobre lo que NO aparece. */
function textoDe(e: Etiqueta): string {
  return JSON.stringify(e);
}

describe("la etiqueta lleva lo que tiene que llevar", () => {
  const etiqueta = etiquetaDelFormulario(DESDE_FORMULARIO);

  it("lleva el codigo del pedido", () => {
    expect(etiqueta.codigo).toBe("FU-1234");
  });

  it("lleva destinatario y remitente completos (FR-005)", () => {
    expect(etiqueta.entrega.nombre).toBe("Ñandú Rodríguez");
    expect(etiqueta.entrega.telefono).toBe("091 060 320");
    expect(etiqueta.retiro.nombre).toBe("María Fernanda Piñeyro");
    expect(etiqueta.retiro.telefono).toBe("099 123 456");
  });

  it("lleva fecha de retiro y cantidad (FR-006)", () => {
    expect(etiqueta.fechaRetiro).toBe("2026-09-08");
    // El formulario la trae como texto; la etiqueta la normaliza a numero.
    expect(etiqueta.cantidad).toBe(3);
  });

  it("compone las direcciones con la misma funcion que la pantalla (FR-010)", () => {
    // No se compara contra un literal a mano: se compara contra `componerDireccion`,
    // que es lo que usa la pantalla. Si alguien escribiera un segundo compositor
    // aca, esto se pondria en rojo — que es el punto de FR-010.
    expect(etiqueta.retiro.direccion).toBe(componerDireccion(RETIRO));
    expect(etiqueta.entrega.direccion).toBe(componerDireccion(ENTREGA));
    // Y que efectivamente componga todas las partes, no solo la calle.
    expect(etiqueta.retiro.direccion).toContain("Bulevar España 2145");
    expect(etiqueta.retiro.direccion).toContain("apto 302");
    expect(etiqueta.retiro.direccion).toContain("esq. Br. Artigas");
    expect(etiqueta.entrega.direccion).toContain("cooperativa");
  });

  it("el nombre del archivo lleva el codigo (FR-016)", () => {
    expect(nombreDeArchivo(etiqueta)).toContain("FU-1234");
    expect(nombreDeArchivo(etiqueta).endsWith(".pdf")).toBe(true);
  });
});

describe("la etiqueta NO lleva lo que no puede llevar", () => {
  const delFormulario = etiquetaDelFormulario(DESDE_FORMULARIO);
  const delServicio = etiquetaDelPedido(DESDE_SERVICIO);

  // FR-007 / Principio V. El caso central del feature.
  //
  // Se afirma sobre la ESTRUCTURA y no sobre el PDF a proposito: aca el texto
  // es inspeccionable, y en el PDF habria que raspar bytes de un stream
  // comprimido. Ese corte es la razon de que `etiqueta.ts` y `etiqueta-pdf.ts`
  // sean dos archivos.
  it.each([
    ["desde el formulario", delFormulario],
    ["desde el servicio", delServicio],
  ])("no tiene ningun importe ni nada que hable de plata (%s)", (_n, e) => {
    const texto = textoDe(e);
    for (const palabra of ["precio", "monto", "total", "costo", "tarifa", "$", "UYU", "pesos"]) {
      expect(texto.toLowerCase(), `la etiqueta menciona "${palabra}"`).not.toContain(
        palabra.toLowerCase(),
      );
    }
    // Y ninguna clave del objeto, a cualquier profundidad, se llama como un precio.
    const claves = [...texto.matchAll(/"([^"]+)":/g)].map((m) => m[1].toLowerCase());
    expect(claves).not.toContain("precio");
    expect(claves).not.toContain("monto");
  });

  it("EL CONTROL POSITIVO de la guarda de importes", () => {
    // Sin esto, la prueba de arriba queda verde tambien el dia que deje de mirar
    // donde cree que mira —una clave renombrada, un objeto que se vacia—. Aca se
    // le da de comer una etiqueta contaminada a proposito y se exige que la
    // detecte. Si este caso falla, la guarda de arriba no esta guardando nada.
    const contaminada = { ...delFormulario, precio: 350 } as unknown as Etiqueta;
    const texto = textoDe(contaminada);
    const claves = [...texto.matchAll(/"([^"]+)":/g)].map((m) => m[1].toLowerCase());
    expect(texto.toLowerCase()).toContain("precio");
    expect(claves).toContain("precio");
  });

  // FR-008. Desde `014` el sitio manda "chico" y "16:00" fijos: son relleno, no
  // datos que alguien haya elegido, y la constitucion 5.1.0 prohibe leerlos.
  it.each([
    ["desde el formulario", delFormulario],
    ["desde el servicio", delServicio],
  ])("no tiene tamaño de paquete ni hora de retiro (%s)", (_n, e) => {
    const texto = textoDe(e).toLowerCase();
    expect(texto).not.toContain("chico");
    expect(texto).not.toContain("mediano");
    expect(texto).not.toContain("grande");
    expect(texto).not.toContain("tamano");
    expect(texto).not.toContain("16:00");
    expect(texto).not.toContain("hora");
  });

  // FR-009. Es estructuralmente imposible —el servicio no le manda la cedula al
  // cliente desde `016`— y se afirma igual, barato, para que siga siendo cierto
  // el dia que alguien amplie el tipo de entrada.
  it("no tiene la cedula de quien recibe (FR-009)", () => {
    const texto = textoDe(delServicio).toLowerCase();
    expect(texto).not.toContain("cedula");
    expect(texto).not.toContain("documento");
    expect(texto).not.toContain("receptor");
  });
});

describe("las dos pantallas producen la misma etiqueta (FR-003)", () => {
  it("el mismo pedido, en sus dos formas, da estructuras identicas", () => {
    // **Esta es la prueba que justifica que exista el tipo neutro.** Sin ella,
    // el boton de la confirmacion y el de Mis pedidos pueden divergir sin que
    // nadie lo note hasta que alguien imprime el mismo pedido dos veces.
    expect(etiquetaDelPedido(DESDE_SERVICIO)).toEqual(
      etiquetaDelFormulario(DESDE_FORMULARIO),
    );
  });

  it("EL CONTROL POSITIVO: la comparacion detecta una diferencia real", () => {
    // Si `toEqual` comparara mal —o las dos funciones devolvieran algo vacio— el
    // caso de arriba pasaria igual. Aca se cambia UN campo y se exige que falle.
    const distinto = { ...DESDE_SERVICIO, destinatarioTelefono: "099 999 999" };
    expect(etiquetaDelPedido(distinto)).not.toEqual(
      etiquetaDelFormulario(DESDE_FORMULARIO),
    );
  });
});

describe("la zona (FR-018)", () => {
  it("sale del punto de entrega, como nombre", () => {
    expect(etiquetaDelFormulario(DESDE_FORMULARIO).entrega.zona).toBe("Zona 5");
  });

  it("no aparece en el retiro: la zona es de la entrega desde `011`", () => {
    expect(etiquetaDelFormulario(DESDE_FORMULARIO).retiro.zona).toBeUndefined();
  });

  it("un pedido sin punto de entrega no trae la clave, y no la trae VACIA", () => {
    // Un pedido anterior a `011`. La clave tiene que estar AUSENTE, para que el
    // dibujo omita el bloque entero en vez de dejar un hueco o una leyenda.
    const viejo: PedidoParaEtiqueta = {
      ...DESDE_SERVICIO,
      entrega: { ...DESDE_SERVICIO.entrega, punto: null },
    };
    const e = etiquetaDelPedido(viejo);
    expect("zona" in e.entrega).toBe(false);
    expect(e.entrega.zona).toBeUndefined();
    // Y el resto de la etiqueta sale igual: perder la zona no cuesta la direccion.
    expect(e.entrega.direccion).toBe(etiquetaDelPedido(DESDE_SERVICIO).entrega.direccion);
  });

  it("un punto fuera de toda zona tampoco inventa una (Principio V)", () => {
    // Rio de la Plata. Nunca la zona mas cercana.
    const fuera: PedidoParaEtiqueta = {
      ...DESDE_SERVICIO,
      entrega: { ...DESDE_SERVICIO.entrega, punto: { lat: -34.96, lng: -56.18 } },
    };
    expect("zona" in etiquetaDelPedido(fuera).entrega).toBe(false);
  });
});

// --- La guarda del grafo de imports (FR-013, FR-017) ------------------------
//
// Misma maquinaria que `lib/cotizar-abierto.test.ts`, por el mismo motivo: lo
// que se rompe sin esto no se rompe de golpe. Alguien agrega un import comodo,
// en desarrollo el servicio esta arriba y nadie lo nota.
//
// **FR-013**: componer la etiqueta no puede depender del servicio. Todo lo que
// necesita ya lo tiene la pantalla en la mano.
// **FR-017**: el producto entrega un archivo y NO intenta imprimir. Nada de
// `window.print()`, ni dialogo de impresion, ni hablar con una impresora.

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..");
const EXTENSIONES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];
const ESPECIFICADOR = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;

function destino(archivo: string, especificador: string): string | null {
  if (especificador.startsWith("@/")) return especificador.slice(2);
  if (especificador.startsWith(".")) {
    const absoluto = resolve(RAIZ, dirname(archivo), especificador);
    return relative(RAIZ, absoluto).split(sep).join(posix.sep);
  }
  return null;
}

const canonico = (r: string) => r.replace(/\.tsx?$/, "").replace(/\/index$/, "");

function resolverArchivo(d: string): string | null {
  if (d.endsWith(".css")) return null;
  for (const ext of EXTENSIONES) {
    const candidato = `${d}${ext}`;
    if (existsSync(join(RAIZ, candidato))) return candidato;
  }
  return null;
}

function recorrer(entradas: string[]) {
  const visto = new Set<string>();
  const pretendidos = new Map<string, string>();
  const pendientes: string[] = [];

  for (const entrada of entradas) {
    const archivo = resolverArchivo(entrada);
    expect(archivo, `no existe la entrada ${entrada}`).not.toBeNull();
    if (archivo && !visto.has(archivo)) {
      visto.add(archivo);
      pendientes.push(archivo);
    }
  }

  while (pendientes.length > 0) {
    const actual = pendientes.pop()!;
    const fuente = readFileSync(join(RAIZ, actual), "utf8");
    for (const c of fuente.matchAll(ESPECIFICADOR)) {
      const pretendido = destino(actual, c[1]);
      if (!pretendido) continue;
      if (!pretendidos.has(canonico(pretendido))) pretendidos.set(canonico(pretendido), actual);
      const archivo = resolverArchivo(pretendido);
      if (!archivo || visto.has(archivo)) continue;
      visto.add(archivo);
      pendientes.push(archivo);
    }
  }

  return { visto, pretendidos };
}

describe("componer la etiqueta no depende del servicio (FR-013)", () => {
  const grafo = recorrer(["lib/etiqueta.ts"]);

  it("el recorrido llega a lib/direccion.ts siguiendo imports", () => {
    // Control contra el falso verde: un grafo vacio tampoco contiene lo
    // prohibido. Si esto falla, el caso de abajo no esta probando nada.
    expect(grafo.visto.has("lib/direccion.ts")).toBe(true);
    expect(grafo.visto.has("lib/zona-lookup.ts")).toBe(true);
  });

  it("no alcanza lib/api.ts ni lib/sesion.ts por ningun camino", () => {
    // **`etiqueta.ts` describe la forma del pedido guardado en vez de importarla**
    // (ver `PedidoParaEtiqueta`), justamente para que esto se pueda afirmar sin
    // excepciones: ni siquiera un `import type`, que se borra al compilar pero
    // que esta guarda —que toma de mas a proposito— marcaria igual.
    expect(grafo.pretendidos.get(canonico("lib/api.ts"))).toBeUndefined();
    expect(grafo.pretendidos.get(canonico("lib/sesion.ts"))).toBeUndefined();
  });

  it("EL CONTROL POSITIVO: el detector encuentra api.ts cuando esta", () => {
    // `lib/api.test.ts` importa `./api` a proposito. Si esto no lo detecta, el
    // caso de arriba pasa por no saber mirar.
    const control = recorrer(["lib/api.test.ts"]);
    expect(control.pretendidos.has(canonico("lib/api.ts"))).toBe(true);
  });
});

describe("el producto entrega un archivo, no imprime (FR-017)", () => {
  const ARCHIVOS = [
    "lib/etiqueta.ts",
    "lib/etiqueta-pdf.ts",
    "components/pedido-form.tsx",
    "components/pedido/tarjeta-pedido.tsx",
  ];

  it.each(ARCHIVOS)("%s no llama a window.print()", (archivo) => {
    const ruta = resolverArchivo(archivo);
    expect(ruta, `no existe ${archivo}`).not.toBeNull();
    const fuente = readFileSync(join(RAIZ, ruta!), "utf8");
    // Se busca la llamada, no la palabra: el comentario de arriba dice
    // "window.print()" y no tiene por que poner la prueba en rojo.
    expect(fuente).not.toMatch(/\bwindow\s*\.\s*print\s*\(/);
    expect(fuente).not.toMatch(/\bprint\s*\(\s*\)/);
  });

  it("EL CONTROL POSITIVO: el detector reconoce una llamada a print", () => {
    const falso = "function f() { window.print(); }";
    expect(falso).toMatch(/\bwindow\s*\.\s*print\s*\(/);
  });
});
