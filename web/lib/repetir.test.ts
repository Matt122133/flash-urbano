import { existsSync, readFileSync } from "node:fs";
import { dirname, join, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { PedidoGuardado } from "./api";
import {
  camposDelPedido,
  huboReajuste,
  precioDeHoy,
  retiroDelPedido,
  tamanoDelPedido,
} from "./repetir";
import { ZONAS } from "./zonas";

/** Un pedido guardado como el que devuelve `GET /pedidos`, para variar encima. */
function unPedido(cambios: Partial<PedidoGuardado> = {}): PedidoGuardado {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    usuarioId: "22222222-2222-4222-8222-222222222222",
    codigo: "FU-0042",
    estado: "creacion",
    remitenteNombre: "Ana Pérez",
    remitenteTelefono: "099111222",
    retiro: {
      calle: "Comercio",
      esquina: "Monte Caseros",
      numero: "1234",
      apto: "301",
      cooperativa: true,
      punto: { lat: -34.872, lng: -56.16 },
    },
    entrega: {
      calle: "Bulevar Artigas",
      esquina: "Rivera",
      numero: null,
      apto: null,
      cooperativa: false,
    },
    paqueteTamano: "mediano",
    cantidad: 2,
    retiroFecha: "2026-08-01",
    retiroHora: "10:30",
    destinatarioNombre: "Juan Gómez",
    destinatarioTelefono: "099333444",
    precio: 150,
    zonaId: 1,
    creadoEn: "2026-08-01T12:00:00Z",
    actualizadoEn: "2026-08-01T12:00:00Z",
    ...cambios,
  };
}

describe("retiroDelPedido", () => {
  it("pasa los campos tal como se guardaron", () => {
    expect(retiroDelPedido(unPedido())).toEqual({
      calle: "Comercio",
      esquina: "Monte Caseros",
      numero: "1234",
      punto: { lat: -34.872, lng: -56.16 },
      apto: "301",
      cooperativa: true,
    });
  });

  it("convierte el numero nulo en texto vacio", () => {
    // `rehidratarRetiro()` espera texto. Nulo llega desde la base y significa
    // "no lo dijo"; el formulario lo representa con el campo en blanco.
    const r = retiroDelPedido(
      unPedido({ retiro: { ...unPedido().retiro, numero: null } }),
    );
    expect(r.numero).toBe("");
  });

  it("deja apto y cooperativa nulables", () => {
    // No se aplanan a "" ni a false: `rehidratarRetiro()` ya distingue "no lo
    // dijo" de "dijo que no", y aplanarlos aca le sacaria esa informacion.
    const r = retiroDelPedido(
      unPedido({
        retiro: { ...unPedido().retiro, apto: null, cooperativa: false },
      }),
    );
    expect(r.apto).toBeNull();
    expect(r.cooperativa).toBe(false);
  });

  it("sin punto guardado devuelve null y no rompe", () => {
    const r = retiroDelPedido(
      unPedido({ retiro: { ...unPedido().retiro, punto: undefined } }),
    );
    expect(r.punto).toBeNull();
  });
});

describe("camposDelPedido", () => {
  it("copia remitente, destinatario, paquete y cantidad", () => {
    const c = camposDelPedido(unPedido());
    // El remitente sale del PEDIDO, no del perfil: decision del 2026-08-22.
    expect(c.name).toBe("Ana Pérez");
    expect(c.phone).toBe("099111222");
    expect(c.receiverName).toBe("Juan Gómez");
    expect(c.receiverPhone).toBe("099333444");
    expect(c.packageSize).toBe("mediano");
    expect(c.quantity).toBe("2");
  });

  it("NO devuelve fecha, hora, precio ni zona", () => {
    // Es el caso que hace observable a FR-014 y FR-015. Sin el, alguien agrega
    // `pickupDate` "para completar el mapeo" y precarga una fecha que ya paso.
    const c = camposDelPedido(unPedido()) as Record<string, unknown>;
    expect(c.pickupDate).toBeUndefined();
    expect(c.pickupTime).toBeUndefined();
    expect(c.precio).toBeUndefined();
    expect(c.zonaId).toBeUndefined();
  });

  it("la entrega viaja como texto, con los nulos en blanco", () => {
    expect(camposDelPedido(unPedido()).entrega).toEqual({
      calle: "Bulevar Artigas",
      esquina: "Rivera",
      numero: "",
      apto: "",
      cooperativa: false,
    });
  });
});

describe("tamanoDelPedido", () => {
  it.each(["chico", "mediano", "grande"])("reconoce %s", (t) => {
    expect(tamanoDelPedido(t)).toBe(t);
  });

  it.each(["", "enorme", "CHICO", "mediano ", "1"])(
    "deja el campo vacio ante %j en vez de aproximar",
    (t) => {
      // FR-017. Un valor que no se puede resolver llega vacio y se ve; uno
      // aproximado se confirma sin que nadie lo mire.
      expect(tamanoDelPedido(t)).toBe("");
    },
  );
});

describe("precioDeHoy", () => {
  it("resuelve el precio del punto", () => {
    // La Blanqueada, el mismo punto interior que usa zona-lookup.test.ts.
    const esperado = ZONAS.find((z) => z.id === 1)?.precio;
    expect(precioDeHoy({ lat: -34.872, lng: -56.16 })).toBe(esperado);
  });

  it("fuera de toda zona devuelve null, no la zona mas cercana", () => {
    // Principio V: adivinar una zona es adivinar un precio.
    expect(precioDeHoy({ lat: -34.96, lng: -56.18 })).toBeNull();
  });

  it("sin punto devuelve null", () => {
    expect(precioDeHoy(null)).toBeNull();
  });
});

describe("huboReajuste", () => {
  it("no avisa cuando el precio es el mismo", () => {
    expect(huboReajuste(150, 150)).toBe(false);
  });

  it("avisa cuando subio", () => {
    expect(huboReajuste(150, 190)).toBe(true);
  });

  it("avisa igual cuando bajo", () => {
    // FR-015c. Una pantalla que solo habla cuando la noticia es mala se nota.
    expect(huboReajuste(150, 120)).toBe(true);
  });

  it("sin precio de hoy no hay reajuste que avisar", () => {
    // Ese caso es el de FR-016: no hay precio ni pedido, y corta antes.
    expect(huboReajuste(150, null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// La guarda de la direccion de dependencia
// ---------------------------------------------------------------------------
//
// `lib/` no puede importar de `components/`. Si `repetir.ts` lo hiciera, dejaria
// de poder probarse en el entorno `node` que este repo tiene —el unico lugar
// donde este feature tiene pruebas automaticas, porque las pantallas no las
// tienen— y ademas invertiria la dependencia que ARCHITECTURE fija.
//
// **Es una version chica de la maquinaria de `cotizar-abierto.test.ts`**, no una
// copia por descuido: aquel archivo esta fuera del `covers:` de este plan, asi
// que sus ayudantes no se pueden exportar para reusarlos. Esta recorre el grafo
// igual, con menos casos de borde, porque parte de un modulo que solo alcanza
// `lib/`.

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..");
const EXTENSIONES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];
const ESPECIFICADOR = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;

/** Todo lo que se alcanza desde un archivo siguiendo imports, transitivamente. */
function alcanzados(entrada: string): Set<string> {
  const vistos = new Set<string>();
  const pendientes = [entrada];

  while (pendientes.length > 0) {
    const actual = pendientes.pop()!;
    const fuente = readFileSync(join(RAIZ, actual), "utf8");

    for (const m of fuente.matchAll(ESPECIFICADOR)) {
      const spec = m[1];
      let pretendido: string | null = null;
      if (spec.startsWith("@/")) pretendido = spec.slice(2);
      else if (spec.startsWith("."))
        pretendido = relative(RAIZ, resolve(RAIZ, dirname(actual), spec))
          .split(sep)
          .join(posix.sep);
      if (!pretendido) continue;

      // Se registra el destino PRETENDIDO, resuelva o no a un archivo: un
      // import a un componente que todavia no existe tiene que fallar el dia
      // que se escribe, no el dia que el archivo aparece.
      vistos.add(pretendido);

      for (const ext of EXTENSIONES) {
        const candidato = `${pretendido}${ext}`;
        if (existsSync(join(RAIZ, candidato))) {
          if (!vistos.has(candidato)) {
            vistos.add(candidato);
            pendientes.push(candidato);
          }
          break;
        }
      }
    }
  }

  return vistos;
}

const tocaComponentes = (rutas: Set<string>) =>
  [...rutas].filter((r) => r.startsWith("components/"));

describe("lib/repetir.ts no depende de components/", () => {
  it("el detector encuentra un import a components/ cuando existe", () => {
    // El control positivo. Sin el, esta guarda queda verde tambien el dia que
    // el recorrido deje de recorrer —un alias que cambia, una extension nueva—,
    // porque un grafo vacio tampoco contiene lo prohibido.
    //
    // Se usa el historial, que importa `@/components/...` a proposito, en vez de
    // ensuciar un archivo con un import de mentira.
    const control = alcanzados("components/pedido/historial.tsx");
    expect(tocaComponentes(control).length).toBeGreaterThan(0);
  });

  it("no alcanza ningun componente por ningun camino", () => {
    const rutas = alcanzados("lib/repetir.ts");
    // Guarda contra el falso verde por el otro lado: si el recorrido no
    // encontro nada, no esta probando nada.
    expect(rutas.size).toBeGreaterThan(0);
    expect(tocaComponentes(rutas)).toEqual([]);
  });
});
