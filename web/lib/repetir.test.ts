import { existsSync, readFileSync } from "node:fs";
import { dirname, join, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { PedidoGuardado } from "./api";
import {
  camposDelPedido,
  entregaParaRehidratar,
  retiroDelPedido,
  tamanoDelPedido,
} from "./repetir";

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
      // El punto que cobra desde `011`.
      punto: { lat: -34.872, lng: -56.16 },
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

describe("entregaParaRehidratar", () => {
  it("pasa los campos tal como se guardaron", () => {
    expect(entregaParaRehidratar(unPedido())).toEqual({
      calle: "Bulevar Artigas",
      esquina: "Rivera",
      numero: "",
      punto: { lat: -34.872, lng: -56.16 },
      apto: null,
      cooperativa: false,
    });
  });

  it("convierte el numero nulo en texto vacio", () => {
    // `rehidratarRetiro()` espera texto. Nulo llega desde la base y significa
    // "no lo dijo"; el formulario lo representa con el campo en blanco.
    expect(entregaParaRehidratar(unPedido()).numero).toBe("");
  });

  it("deja apto y cooperativa nulables", () => {
    // No se aplanan a "" ni a false: `rehidratarRetiro()` ya distingue "no lo
    // dijo" de "dijo que no", y aplanarlos aca le sacaria esa informacion.
    const r = entregaParaRehidratar(unPedido());
    expect(r.apto).toBeNull();
    expect(r.cooperativa).toBe(false);
  });

  it("sin punto guardado devuelve null y no rompe", () => {
    // **Es el pedido anterior a `011`** (FR-013): la entrega nunca tuvo punto.
    // Tiene que llegar `null` y no romper, porque de ahi cuelga la precarga que
    // deja el formulario usable en vez de a medio cargar.
    const r = entregaParaRehidratar(
      unPedido({ entrega: { ...unPedido().entrega, punto: undefined } }),
    );
    expect(r.punto).toBeNull();
  });
});

describe("retiroDelPedido", () => {
  it("pasa los campos tal como se guardaron, con los nulos en blanco", () => {
    expect(retiroDelPedido(unPedido())).toEqual({
      calle: "Comercio",
      esquina: "Monte Caseros",
      numero: "1234",
      apto: "301",
      cooperativa: true,
      punto: { lat: -34.872, lng: -56.16 },
    });
  });

  it("sin punto de retiro devuelve null y no rompe", () => {
    // El pedido se creo con una calle homonima o fuera del indice (FR-014,
    // FR-015). Repetirlo tiene que funcionar igual.
    const r = retiroDelPedido(
      unPedido({ retiro: { ...unPedido().retiro, punto: undefined } }),
    );
    expect(r.punto).toBeNull();
    expect(r.calle).toBe("Comercio");
  });

  it("aplana apto nulo a texto vacio", () => {
    // A diferencia de la entrega, este NO pasa por `rehidratarRetiro()`: va
    // derecho a los campos del formulario, que son texto.
    const r = retiroDelPedido(
      unPedido({ retiro: { ...unPedido().retiro, apto: null } }),
    );
    expect(r.apto).toBe("");
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

  // **Esta prueba no es sobre repetir: es sobre no BORRAR.**
  //
  // Al editar, el pedido se guarda ENTERO, asi que un campo que el formulario
  // no trajo se pisa con lo que este vacio. Sin esta linea en
  // `camposDelPedido`, abrir un pedido para cambiarle la direccion le borraria
  // el comentario sin decir nada. Es el mismo defecto que se vio el 2026-09-06
  // con la fecha de retiro, y la unica diferencia es que este no se nota: el
  // cliente no ve que perdio lo que habia escrito.
  it("arrastra el comentario, que es lo que evita que editar lo borre", () => {
    const c = camposDelPedido(unPedido({ comentario: "Tocar timbre del 2" }));
    expect(c.comentario).toBe("Tocar timbre del 2");
  });

  // El servicio OMITE la clave cuando no hay comentario, asi que lo que llega
  // es `undefined` y no `null` ni `""`. El formulario necesita una cadena.
  it("deja el comentario vacio cuando el pedido no trae la clave", () => {
    const c = camposDelPedido(unPedido());
    expect(c.comentario).toBe("");
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

  it("el retiro viaja como texto, con los nulos en blanco", () => {
    expect(camposDelPedido(unPedido()).retiro).toEqual({
      calle: "Comercio",
      esquina: "Monte Caseros",
      numero: "1234",
      apto: "301",
      cooperativa: true,
      punto: { lat: -34.872, lng: -56.16 },
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

// Aca vivian los casos de `precioDeHoy` y `huboReajuste`. Se fueron el
// 2026-08-30 con `013`, junto con las funciones que probaban: sin monto en
// pantalla no hay reajuste que avisar (FR-007).
//
// **Lo que decidia si el envio entra no estaba aca y sigue vivo**: la
// revalidacion del punto guardado, mas abajo, y `resolverZona()` con sus
// propios casos en `zona-lookup.test.ts`.

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
