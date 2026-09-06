import { describe, expect, it } from "vitest";
import type { PedidoGuardado } from "./api";
import {
  SIN_FILTRO,
  corteDesdeUrl,
  filtrarPedidos,
  hayFiltro,
  type Filtro,
} from "./filtrar-pedidos";

/**
 * Un pedido como el que devuelve `GET /pedidos`, para variar encima.
 *
 * Es una copia de la fabrica de `repetir.test.ts` **a proposito**: aquel archivo
 * esta fuera del `covers:` de este plan, asi que exportarla desde alla seria
 * editarlo. Dos fabricas de prueba independientes es un precio bajo comparado
 * con tocar un archivo que este feature no tiene por que tocar.
 */
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

/** Atajo: solo el corte por estado. */
const corte = (estado: Filtro["estado"]): Filtro => ({ ...SIN_FILTRO, estado });

/** Atajo: solo texto. */
const busca = (texto: string): Filtro => ({ ...SIN_FILTRO, texto });

describe("sin filtro", () => {
  it("devuelve todo", () => {
    const pedidos = [unPedido({ id: "a" }), unPedido({ id: "b" })];
    expect(filtrarPedidos(pedidos, SIN_FILTRO).map((p) => p.id)).toEqual(["a", "b"]);
  });

  // FR-009: el orden lo pone el servicio (`creado_en DESC`) y filtrar quita, no
  // reordena. Si alguna vez alguien mete un `sort` aca, esta prueba lo agarra.
  //
  // **El caso esta armado para que un `sort` lo rompa**, y eso no es un detalle:
  // la primera version de esta prueba entraba en orden `c, a, b` y esperaba
  // `a, b`, o sea exactamente lo que devuelve ordenar por codigo. Pasaba en
  // verde con un `sort` metido adentro a proposito — una guarda que no guardaba
  // nada. Ahora entra al reves del orden natural: el mas nuevo primero, como lo
  // manda el servicio (`creado_en DESC`), y cualquier reordenamiento lo delata.
  it("conserva el orden de entrada", () => {
    const pedidos = [
      unPedido({ id: "nuevo", codigo: "FU-0009", estado: "creacion" }),
      unPedido({ id: "viejo", codigo: "FU-0001", estado: "creacion" }),
      unPedido({ id: "entregado", codigo: "FU-0005", estado: "entrega" }),
    ];
    expect(filtrarPedidos(pedidos, corte("pendientes")).map((p) => p.id)).toEqual([
      "nuevo",
      "viejo",
    ]);
    expect(filtrarPedidos(pedidos, SIN_FILTRO).map((p) => p.id)).toEqual([
      "nuevo",
      "viejo",
      "entregado",
    ]);
  });

  it("hayFiltro es falso solo cuando no hay nada puesto", () => {
    expect(hayFiltro(SIN_FILTRO)).toBe(false);
    expect(hayFiltro(corte("pendientes"))).toBe(true);
    expect(hayFiltro(busca("juan"))).toBe(true);
    // Espacios no son un filtro: no tienen por que decir "1 de 50".
    expect(hayFiltro(busca("   "))).toBe(false);
  });
});

describe("corte por estado", () => {
  const pedidos = [
    unPedido({ id: "pendiente", estado: "creacion" }),
    unPedido({ id: "aceptado", estado: "aceptacion" }),
    unPedido({ id: "entregado", estado: "entrega" }),
  ];

  it("cada corte deja pasar lo suyo", () => {
    expect(filtrarPedidos(pedidos, corte("pendientes")).map((p) => p.id)).toEqual(["pendiente"]);
    expect(filtrarPedidos(pedidos, corte("aceptados")).map((p) => p.id)).toEqual(["aceptado"]);
    expect(filtrarPedidos(pedidos, corte("entregados")).map((p) => p.id)).toEqual(["entregado"]);
  });

  // FR-005. El servicio guarda `estado` como texto con CHECK justamente porque
  // la lista ya cambio una vez: si manana aparece un cuarto estado, el pedido
  // tiene que seguir viendose en la lista completa. Desaparecer en silencio es
  // el modo de falla que esta prueba existe para impedir.
  it("un estado desconocido sigue visible cuando no hay filtro", () => {
    const lista = [...pedidos, unPedido({ id: "raro", estado: "en_transito" })];
    expect(filtrarPedidos(lista, SIN_FILTRO).map((p) => p.id)).toContain("raro");
    // Y no se cuela en ningun corte conocido.
    expect(filtrarPedidos(lista, corte("pendientes")).map((p) => p.id)).toEqual(["pendiente"]);
  });
});

describe("corteDesdeUrl", () => {
  it("acepta los cuatro cortes", () => {
    expect(corteDesdeUrl("todos")).toBe("todos");
    expect(corteDesdeUrl("pendientes")).toBe("pendientes");
    expect(corteDesdeUrl("aceptados")).toBe("aceptados");
    expect(corteDesdeUrl("entregados")).toBe("entregados");
  });

  // La URL la escribe cualquiera, y un link viejo puede traer un corte que ya no
  // existe. La respuesta segura es mostrar todo, nunca una lista vacia.
  it("cae en todos ante un valor desconocido o ausente", () => {
    expect(corteDesdeUrl("creacion")).toBe("todos");
    expect(corteDesdeUrl("")).toBe("todos");
    expect(corteDesdeUrl(null)).toBe("todos");
  });
});

describe("busqueda por texto", () => {
  const pedidos = [
    unPedido({ id: "juan", codigo: "FU-0142", destinatarioNombre: "Juan Gómez" }),
    unPedido({ id: "sofia", codigo: "FU-0207", destinatarioNombre: "Sofía Núñez" }),
  ];

  it("encuentra por parte del nombre de quien recibe", () => {
    expect(filtrarPedidos(pedidos, busca("gom")).map((p) => p.id)).toEqual(["juan"]);
  });

  // FR-004. Es la leccion del indice de calles de Montevideo: el mismo nombre
  // aparece escrito con y sin tilde, y la busqueda que no normaliza no encuentra
  // nada. Se prueba en las DOS direcciones porque el dato puede estar de
  // cualquiera de los dos lados.
  it("ignora tildes y mayusculas, en las dos direcciones", () => {
    expect(filtrarPedidos(pedidos, busca("sofia")).map((p) => p.id)).toEqual(["sofia"]);
    expect(filtrarPedidos(pedidos, busca("SOFÍA")).map((p) => p.id)).toEqual(["sofia"]);
    expect(filtrarPedidos(pedidos, busca("nunez")).map((p) => p.id)).toEqual(["sofia"]);
  });

  // FR-003: el codigo se lo pasan por mensaje, escrito de cualquier forma.
  it("encuentra el codigo con o sin prefijo y sin importar la caja", () => {
    for (const q of ["142", "0142", "fu-0142", "FU-0142"]) {
      expect(filtrarPedidos(pedidos, busca(q)).map((p) => p.id)).toEqual(["juan"]);
    }
  });

  it("no encuentra nada cuando no coincide", () => {
    expect(filtrarPedidos(pedidos, busca("zzzz"))).toEqual([]);
  });

  it("combina el corte por estado con el texto", () => {
    const lista = [
      unPedido({ id: "juan-pendiente", estado: "creacion", destinatarioNombre: "Juan Gómez" }),
      unPedido({ id: "juan-entregado", estado: "entrega", destinatarioNombre: "Juan Gómez" }),
    ];
    expect(filtrarPedidos(lista, { estado: "pendientes", texto: "juan" }).map((p) => p.id)).toEqual([
      "juan-pendiente",
    ]);
  });
});

// Las dos guardas negativas del feature. Una prueba que afirma que algo NO pasa
// no vale nada sola: puede estar en verde porque el filtro no encuentra NADA.
// Por eso cada una va con su control positivo — el mismo pedido, encontrado por
// un campo que si se busca.
describe("lo que la busqueda NO mira", () => {
  const pedido = unPedido({
    id: "unico",
    destinatarioNombre: "Juan Gómez",
    codigo: "FU-0142",
    precio: 480,
    entrega: {
      calle: "Rivera",
      esquina: "Soca",
      numero: null,
      apto: null,
      cooperativa: false,
      punto: { lat: -34.9, lng: -56.16 },
    },
  });

  // Decision de Mateo del 2026-09-06, en contra de la recomendacion: el dato ya
  // viaja en la respuesta, asi que dejarlo afuera no es por costo. Una calle
  // aparece en muchos pedidos y ensuciaria los resultados.
  it("no busca sobre las direcciones", () => {
    expect(filtrarPedidos([pedido], busca("rivera"))).toEqual([]);
    expect(filtrarPedidos([pedido], busca("soca"))).toEqual([]);
    // Control positivo: el mismo pedido SI aparece por un campo que se busca.
    expect(filtrarPedidos([pedido], busca("gomez")).map((p) => p.id)).toEqual(["unico"]);
  });

  // Principio V: el producto no dice cuanto cuesta un envio, asi que tampoco se
  // puede filtrar por eso. El `480` del pedido no puede ser una forma de
  // encontrarlo.
  it("no busca sobre el precio ni la zona", () => {
    expect(filtrarPedidos([pedido], busca("480"))).toEqual([]);
    // Control positivo, y ademas la prueba de que la rama de digitos funciona:
    // los digitos del codigo si encuentran.
    expect(filtrarPedidos([pedido], busca("142")).map((p) => p.id)).toEqual(["unico"]);
  });
});
