import { describe, expect, it, vi } from "vitest";
import { armarCuerpoPedido, claveDeIntento, type DatosDelPedido } from "./pedido";
import { ZONAS } from "./zonas";
import { resolverZona } from "./zona-lookup";
import type { Direccion } from "./direccion";

// Dos puntos interiores de zonas DISTINTAS, con precios distintos. Son los que
// hacen posible el control positivo de FR-019: sin dos zonas de precios
// distintos, un mapeo que devolviera una constante pasaria igual.
const LA_BLANQUEADA = { lat: -34.872, lng: -56.16 }; // zona 1
const FUERA_DE_TODO = { lat: -34.96, lng: -56.18 };

function direccion(extra: Partial<Direccion> = {}): Direccion {
  return {
    calle: "Doctor Martin Berinduague",
    esquina: "Vicente Yanez Pinzon",
    numero: "1234",
    apto: "301",
    cooperativa: false,
    punto: null,
    ...extra,
  };
}

function datos(extra: Partial<DatosDelPedido> = {}): DatosDelPedido {
  return {
    nombre: "  Ana Perez  ",
    telefono: " 099111222 ",
    retiro: direccion({ punto: LA_BLANQUEADA }),
    entrega: direccion({ calle: "Rivera", esquina: "Comercio", numero: "4567", apto: "" }),
    tamano: "chico",
    cantidad: "2",
    fecha: "2026-08-13",
    hora: "10:30",
    destinatarioNombre: "Juan Gomez",
    destinatarioTelefono: "098765432",
    ...extra,
  };
}

describe("el cuerpo del pedido se arma desde el punto (FR-019)", () => {
  it("deriva zona y precio del punto de retiro", () => {
    const r = armarCuerpoPedido(datos());
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const zona1 = ZONAS.find((z) => z.id === 1)!;
    expect(r.cuerpo.cobro.zonaId).toBe(1);
    expect(r.cuerpo.cobro.precio).toBe(zona1.precio);
    expect(r.cuerpo.cobro.precio).toBeGreaterThan(0);
  });

  // EL CONTROL POSITIVO. Sin este caso, un mapeo que devolviera siempre la zona
  // 1 y su precio pasaria la prueba de arriba con nota perfecta.
  //
  // Se busca en las zonas reales una cuyo precio DIFIERA del de la zona 1, y se
  // toma un punto interior suyo. Si algun dia todas las zonas costaran lo mismo,
  // esta prueba se saltea sola con un mensaje en vez de dar un falso verde.
  it("mover el punto a otra zona cambia el precio del cuerpo", () => {
    const zona1 = ZONAS.find((z) => z.id === 1)!;
    const otra = ZONAS.find((z) => z.precio !== zona1.precio);
    if (!otra) {
      // No es un skip silencioso: si esto pasa, el control positivo dejo de
      // existir y hay que enterarse.
      throw new Error(
        "todas las zonas tienen el mismo precio: este control positivo ya no controla nada",
      );
    }

    // Se busca un punto interior barriendo una grilla, en vez de calcular el
    // centroide del anillo: **el centroide de un poligono concavo puede caer
    // afuera**, y las zonas lo son. El barrido no depende de la forma.
    const paso = 0.004;
    let sonda: { lat: number; lng: number } | null = null;
    for (let lat = -34.95; lat <= -34.7 && !sonda; lat += paso) {
      for (let lng = -56.45; lng <= -55.9; lng += paso) {
        const z = resolverZona(lat, lng);
        if (z && z.precio !== zona1.precio) {
          sonda = { lat, lng };
          break;
        }
      }
    }
    if (!sonda) {
      throw new Error("no se encontro ningun punto de una zona con otro precio");
    }

    const r = armarCuerpoPedido(datos({ retiro: direccion({ punto: sonda }) }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.cuerpo.cobro.precio).not.toBe(zona1.precio);
    expect(r.cuerpo.cobro.zonaId).not.toBe(1);
  });

  it("sin punto no arma cuerpo", () => {
    const r = armarCuerpoPedido(datos({ retiro: direccion({ punto: null }) }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toBe("sin-punto");
  });

  // FR-020: sin zona no hay precio, y sin precio no hay pedido. El flujo
  // termina en contacto directo, no en un pedido con precio inventado.
  it("un punto fuera de toda zona no arma cuerpo", () => {
    const r = armarCuerpoPedido(datos({ retiro: direccion({ punto: FUERA_DE_TODO }) }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toBe("fuera-de-zona");
  });
});

describe("la forma del cuerpo", () => {
  it("recorta los espacios y copia los campos donde van", () => {
    const r = armarCuerpoPedido(datos());
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.cuerpo.remitente).toEqual({ nombre: "Ana Perez", telefono: "099111222" });
    expect(r.cuerpo.destinatario).toEqual({ nombre: "Juan Gomez", telefono: "098765432" });
    expect(r.cuerpo.retiroCuando).toEqual({ fecha: "2026-08-13", hora: "10:30" });
    expect(r.cuerpo.paquete).toEqual({ tamano: "chico", cantidad: 2 });
    expect(r.cuerpo.retiro.punto).toEqual(LA_BLANQUEADA);
  });

  // La entrega NO lleva punto. El servicio lo rechaza con 400 por campos
  // desconocidos, asi que mandarlo romperia el envio entero.
  it("la entrega no lleva punto", () => {
    const r = armarCuerpoPedido(
      datos({ entrega: direccion({ punto: LA_BLANQUEADA }) }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.cuerpo.entrega).not.toHaveProperty("punto");
  });

  it("una cantidad no numerica cae a 1 en vez de mandar NaN", () => {
    for (const mala of ["", "abc", "0", "-3"]) {
      const r = armarCuerpoPedido(datos({ cantidad: mala }));
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.cuerpo.paquete.cantidad).toBe(1);
    }
  });
});

// FR-001/FR-002 en el plano dinamico: este modulo esta en el camino de cerrar un
// pedido, pero armar el cuerpo NO puede depender de la red — el precio sale de
// los datos que el sitio ya sirve.
describe("armar el cuerpo no toca la red", () => {
  it("funciona con fetch roto", () => {
    const espia = vi.fn(() => {
      throw new Error("armar el cuerpo toco la red");
    });
    vi.stubGlobal("fetch", espia);

    const r = armarCuerpoPedido(datos());

    expect(r.ok).toBe(true);
    expect(espia).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

// El defecto del 2026-08-14: `crypto.randomUUID()` solo existe en contexto
// seguro, y probar el sitio desde un telefono contra `http://<ip>:3000` no lo
// es. La llamada tiraba y el boton de confirmar quedaba mudo.
describe("claveDeIntento", () => {
  const UUID_V4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it("usa randomUUID cuando el navegador la tiene", () => {
    const espia = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValue("11111111-2222-4333-8444-555555555555");

    expect(claveDeIntento()).toBe("11111111-2222-4333-8444-555555555555");
    expect(espia).toHaveBeenCalled();
    espia.mockRestore();
  });

  // El caso que importa: es exactamente lo que ve un telefono sobre http.
  it("sigue dando un UUID v4 valido sin randomUUID (contexto no seguro)", () => {
    const original = crypto.randomUUID;
    // @ts-expect-error se simula el navegador que NO la expone
    crypto.randomUUID = undefined;
    try {
      expect(claveDeIntento()).toMatch(UUID_V4);
    } finally {
      crypto.randomUUID = original;
    }
  });

  // El control positivo: sin esto, un respaldo que devolviera siempre la misma
  // constante pasaria la prueba de arriba — y dos pedidos distintos quedarian
  // con la misma clave, o sea que el segundo se descartaria como duplicado.
  it("no repite la clave entre intentos", () => {
    const original = crypto.randomUUID;
    // @ts-expect-error se simula el navegador que NO la expone
    crypto.randomUUID = undefined;
    try {
      const claves = new Set(Array.from({ length: 200 }, () => claveDeIntento()));
      expect(claves.size).toBe(200);
    } finally {
      crypto.randomUUID = original;
    }
  });
});
