import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { componerDireccion } from "./direccion";
import { sinComentarios } from "./sin-comentarios";
import { resolverZona } from "./zona-lookup";
import {
  comoDireccion,
  filasDeEnvios,
  generadoEnMontevideo,
  nombreDeArchivo,
  rutaDelReporte,
  textoDelReporte,
  type EnvioDelServicio,
  type Reporte,
} from "./reporte";

// Las guardas de `029`.
//
// **Por que la de la plata existe antes que la logica que prueba.** Sirve
// mientras alguien escribe el codigo que podria violarla, no despues: es el
// momento en que se agrega una columna de total "porque queda raro el hueco".
//
// **Y por que hace falta una nueva.** `sin-precio-a-la-vista.test.ts` escanea
// `app/` y `components/`, y **deja `lib/` afuera a proposito**: ahi el precio
// tiene que seguir viviendo, porque `lib/zonas.ts` lo conserva. O sea que todo
// modulo nuevo de `lib/` nace sin proteccion. Es la tercera vez que este repo lo
// descubre —`tablero.ts`, los modulos de la etiqueta en `028`, y ahora este—.

const AQUI = dirname(fileURLToPath(import.meta.url));

const PLATA = [/precio/i, /monto/i, /importe/i, /costo/i, /\$\s*\d/];

function nombraPlata(fuente: string): boolean {
  // Los comentarios quedan afuera: explicar por que la plata no esta es
  // informacion util, y prohibirlo empujaria a borrar la explicacion junto con
  // el codigo. Este archivo es la prueba de eso.
  return PLATA.some((patron) => patron.test(sinComentarios(fuente)));
}

describe("lib/reporte.ts no nombra la plata de un pedido (FR-009, FR-011)", () => {
  it("el fuente del modulo esta limpio", () => {
    const fuente = readFileSync(join(AQUI, "reporte.ts"), "utf8");
    // Guarda contra el falso verde: si el archivo se renombra, esto falla en voz
    // alta en vez de pasar sin mirar nada.
    expect(fuente.length).toBeGreaterThan(0);
    expect(nombraPlata(fuente)).toBe(false);
  });

  it("EL CONTROL POSITIVO: el detector ve un monto cuando esta", () => {
    expect(nombraPlata("const x = zona.precio;")).toBe(true);
    expect(nombraPlata('const fila = ["Total", "$ 250"];')).toBe(true);
    expect(nombraPlata("function formatearImporte(n: number) {}")).toBe(true);
  });

  it("el detector no cuenta un comentario", () => {
    expect(nombraPlata("// aca no va ningun precio\nconst x = 1;")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Las filas
// ---------------------------------------------------------------------------

// Ciudad de la Costa, el mismo punto interior que verifica zona-lookup.test.ts.
const PUNTO_ZONA_5 = { lat: -34.8349, lng: -55.9861 };

const ENVIO: EnvioDelServicio = {
  codigo: "FU-0012",
  retiroFecha: "2026-09-03",
  entrega: {
    calle: "Av. Giannattasio",
    esquina: "Calle 20",
    numero: "890",
    apto: null,
    cooperativa: false,
    punto: PUNTO_ZONA_5,
  },
  entregadoEn: "2026-09-04T17:30:00Z",
  cantidad: 1,
};

describe("las filas del reporte", () => {
  it("compone la direccion con la misma funcion que la pantalla (FR-008)", () => {
    const [f] = filasDeEnvios([ENVIO]);
    expect(f.direccion).toBe(componerDireccion(comoDireccion(ENVIO.entrega)));
    expect(f.direccion).toContain("Av. Giannattasio 890");
    expect(f.direccion).toContain("esq. Calle 20");
  });

  it("resuelve la zona desde el PUNTO, con el mismo resolvedor (FR-007)", () => {
    const [f] = filasDeEnvios([ENVIO]);
    expect(f.zona).toBe(resolverZona(PUNTO_ZONA_5.lat, PUNTO_ZONA_5.lng)?.nombre);
    expect(f.zona).toBe("Zona 5");
  });

  it("sin punto de entrega la zona va VACIA, no deducida de la direccion", () => {
    // Un pedido anterior a `011`. **Vacio no significa "no se cobra"**: significa
    // que no hay punto del cual resolverla. Deducirla del texto seria adivinar
    // una zona, que el Principio V prohibe.
    const [f] = filasDeEnvios([{ ...ENVIO, entrega: { ...ENVIO.entrega, punto: null } }]);
    expect(f.zona).toBe("");
    expect(f.direccion).toContain("Av. Giannattasio");
  });

  it("una fila por PEDIDO, no por paquete (FR-002)", () => {
    const filas = filasDeEnvios([{ ...ENVIO, cantidad: 5 }]);
    expect(filas).toHaveLength(1);
    expect(filas[0].paquetes).toBe(5);
  });

  it("sin marca de entrega la celda va vacia, y el envio APARECE (US2)", () => {
    const sinMarcar: EnvioDelServicio = { ...ENVIO };
    delete sinMarcar.entregadoEn;
    const filas = filasDeEnvios([sinMarcar]);
    expect(filas).toHaveLength(1);
    expect(filas[0].entrega).toBe("");
    // Y lo demas sigue entero: es una fila que Diego tiene que poder cobrar.
    expect(filas[0].codigo).toBe("FU-0012");
    expect(filas[0].zona).toBe("Zona 5");
  });
});

describe("la fecha de entrega es de Montevideo, no UTC (FR-006b, SC-011)", () => {
  // 22:00 del 30 de septiembre en Montevideo son las 01:00 del 1 de octubre en
  // UTC. Leido mal, **el envio se va al reporte del mes siguiente** y Diego lo
  // factura en octubre. Es un error de facturacion, no de prolijidad.
  const INSTANTE = "2026-10-01T01:00:00Z";

  it("un envio de las 22:00 del ultimo dia del mes queda en ESE mes", () => {
    const [f] = filasDeEnvios([{ ...ENVIO, entregadoEn: INSTANTE }]);
    expect(f.entrega).toBe("2026-09-30");
  });

  it("EL CONTROL POSITIVO: leerlo en UTC daria otro dia", () => {
    // Sin esto, la prueba de arriba pasaria por casualidad en cualquier maquina
    // cuya zona coincidiera — y **esta maquina esta en Montevideo**. Aca se
    // demuestra que el caso discrimina: la lectura ingenua da octubre.
    expect(new Date(INSTANTE).toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(filasDeEnvios([{ ...ENVIO, entregadoEn: INSTANTE }])[0].entrega).not.toBe("2026-10-01");
  });
});

// ---------------------------------------------------------------------------
// El texto
// ---------------------------------------------------------------------------

const REPORTE: Reporte = {
  filas: filasDeEnvios([ENVIO]),
  cuenta: "Panaderia del Centro",
  periodo: "septiembre 2026",
  generadoEl: "2026-10-01 09:15",
};

describe("el texto del CSV", () => {
  it("es exactamente esto, byte a byte, con BOM y CRLF", () => {
    // **Se compara el texto entero y no "los campos"**: una prueba que parsee
    // el CSV y compare celdas no ve ni el separador ni la codificacion, que son
    // las dos unicas cosas que deciden si Excel lo abre bien.
    //
    // **La direccion va citada, y no es el caso raro: es TODOS los casos.**
    // `componerDireccion` mete una coma antes de la esquina, asi que cada
    // direccion del archivo la tiene. Un CSV separado por comas partiria en dos
    // cada fila del reporte, y elegir `;` no alcanzaria sin citar: el archivo
    // tiene que hacer las dos cosas.
    const esperado =
      "﻿" +
      "Codigo;Fecha de retiro;Fecha de entrega;Direccion de entrega;Zona;Paquetes\r\n" +
      'FU-0012;2026-09-03;2026-09-04;"Av. Giannattasio 890, esq. Calle 20";Zona 5;1\r\n' +
      "\r\n" +
      "Cuenta;Panaderia del Centro\r\n" +
      "Periodo;septiembre 2026\r\n" +
      "Generado el;2026-10-01 09:15\r\n";
    expect(textoDelReporte(REPORTE)).toBe(esperado);
  });

  it("empieza con el BOM de UTF-8", () => {
    // Sin el, "Piñeyro" sale "PiÃ±eyro" en Excel.
    expect(textoDelReporte(REPORTE).charCodeAt(0)).toBe(0xfeff);
  });

  it("usa punto y coma y no coma", () => {
    // Con coma, una planilla en español abre todo en una sola columna.
    const linea = textoDelReporte(REPORTE).split("\r\n")[0].replace("﻿", "");
    expect(linea.split(";")).toHaveLength(6);
  });

  it("la fila 1 es el encabezado y el contexto va al FINAL (FR-014a)", () => {
    const lineas = textoDelReporte(REPORTE).replace("﻿", "").split("\r\n");
    expect(lineas[0]).toMatch(/^Codigo;/);
    // Un renglon en blanco separa los datos del bloque de contexto, para que
    // ordenar la planilla no se lo lleve puesto.
    expect(lineas[2]).toBe("");
    expect(lineas.slice(3).join("\n")).toContain("Generado el");
  });
});

describe("el citado (FR-016, SC-007)", () => {
  const conDireccion = (direccion: string) =>
    textoDelReporte({ ...REPORTE, filas: [{ ...REPORTE.filas[0], direccion }] });

  it.each([
    ["una coma", "Rivera 1234, apto 2"],
    ["un punto y coma", "Rivera 1234; apto 2"],
    ["comillas", 'Rivera 1234 "el galpon"'],
    ["las tres cosas", 'Rivera 1234, "el galpon"; fondo'],
  ])("una direccion con %s no parte la fila", (_caso, direccion) => {
    const lineas = conDireccion(direccion).replace("﻿", "").split("\r\n");
    // Una sola fila de datos, por mas separadores que tenga la direccion.
    expect(lineas.filter((l) => l.startsWith("FU-"))).toHaveLength(1);
    expect(lineas[1].split(";")[0]).toBe("FU-0012");
    // Y el dato sobrevive entero adentro de las comillas.
    expect(conDireccion(direccion)).toContain(direccion.replace(/"/g, '""'));
  });

  it("EL CONTROL POSITIVO: sin citar, el punto y coma partiria la fila", () => {
    // Si `citar` dejara de citar, esta cuenta cambiaria. Lo que se demuestra es
    // que el caso de arriba sabe distinguir un campo citado de uno que no.
    const crudo = "FU-1;2026-09-03;;Rivera 1234; apto 2;Zona 5;1";
    expect(crudo.split(";")).toHaveLength(7);
    const citado = conDireccion("Rivera 1234; apto 2").replace("﻿", "").split("\r\n")[1];
    expect(citado.split(";")).toHaveLength(7);
    expect(citado).toContain('"Rivera 1234; apto 2"');
  });
});

describe("el nombre del archivo (FR-015)", () => {
  it("lleva periodo y cuenta, para que dos descargas no se pisen", () => {
    const nombre = nombreDeArchivo(REPORTE);
    expect(nombre).toContain("septiembre-2026");
    expect(nombre).toContain("panaderia-del-centro");
    expect(nombre.endsWith(".csv")).toBe(true);
  });

  it("no deja tildes ni espacios en el nombre", () => {
    const nombre = nombreDeArchivo({ ...REPORTE, cuenta: "Almacén Ñandú S.R.L." });
    expect(nombre).toBe("flash-urbano-septiembre-2026-almacen-nandu-s-r-l.csv");
  });
});

describe("cero plata en el archivo (FR-009, SC-006)", () => {
  it("ni en el encabezado, ni en las filas, ni en el pie", () => {
    const texto = textoDelReporte(REPORTE);
    // Guarda contra el falso verde: si el archivo viniera vacio, no habria
    // donde aparecer un importe.
    expect(texto).toContain("FU-0012");
    expect(nombraPlata(texto)).toBe(false);
    for (const palabra of ["total", "tarifa", "uyu", "pesos"]) {
      expect(texto.toLowerCase()).not.toContain(palabra);
    }
  });

  it("EL CONTROL POSITIVO: el detector veria un importe en el pie", () => {
    const contaminado = textoDelReporte({ ...REPORTE, cuenta: "Panaderia $ 4500" });
    expect(nombraPlata(contaminado)).toBe(true);
  });
});

describe("generadoEnMontevideo", () => {
  it("usa la zona de Montevideo, escrita, y no la del proceso", () => {
    // Las 01:00 UTC del 1 de octubre son las 22:00 del 30 de septiembre aca.
    expect(generadoEnMontevideo(new Date("2026-10-01T01:00:00Z"))).toBe("2026-09-30 22:00");
  });
});

describe("rutaDelReporte", () => {
  it("lleva los tres parametros que el servicio exige", () => {
    const ruta = rutaDelReporte("u-123", "2026-09-01", "2026-09-30");
    expect(ruta).toBe("/admin/reporte?cliente=u-123&desde=2026-09-01&hasta=2026-09-30");
  });

  it("escapa lo que haga falta", () => {
    expect(rutaDelReporte("a b&c", "2026-09-01", "2026-09-30")).toContain("cliente=a+b%26c");
  });
});
