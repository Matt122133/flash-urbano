import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi, baseDelApi, pedir } from "./api";

const BASE = "https://api.example.test";

// Cada caso arma su propia respuesta. No hay servidor: lo que se prueba es como
// este modulo forma el pedido y como clasifica lo que vuelve.
function conFetch(respuesta: Response | Error) {
  const espia = vi.fn(async () => {
    if (respuesta instanceof Error) throw respuesta;
    return respuesta;
  });
  vi.stubGlobal("fetch", espia);
  return espia;
}

function json(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", BASE);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// FR-024: la direccion del servicio sale de la configuracion de build, no del
// codigo de las pantallas. Es lo que permite mudar el dominio sin tocar codigo.
describe("baseDelApi", () => {
  it("sale de la configuracion, no del codigo", () => {
    expect(baseDelApi()).toBe(BASE);
  });

  it("cambia con la configuracion", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.flashurbano.uy");
    expect(baseDelApi()).toBe("https://api.flashurbano.uy");
  });

  it("tolera una barra final de mas", () => {
    // Es el error de tipeo mas comun al cargar la variable, y sin esto produce
    // rutas con doble barra que el servicio no matchea.
    vi.stubEnv("NEXT_PUBLIC_API_URL", `${BASE}/`);
    expect(baseDelApi()).toBe(BASE);
  });

  it("es cadena vacia si no esta configurada", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    expect(baseDelApi()).toBe("");
  });
});

describe("pedir", () => {
  it("arma la URL sobre la base configurada", async () => {
    const espia = conFetch(json({ estado: "ok" }));

    await pedir("/salud");

    expect(espia).toHaveBeenCalledOnce();
    expect(espia.mock.calls[0][0]).toBe(`${BASE}/salud`);
  });

  // FR-016: la credencial viaja en un header, de una forma que no depende del
  // comportamiento del navegador con cookies entre origenes distintos.
  it("manda la credencial como Bearer en el header", async () => {
    const espia = conFetch(json({ email: "cliente@example.com" }));

    await pedir("/yo", { credencial: "abc123" });

    const opciones = espia.mock.calls[0][1] as RequestInit;
    const cabeceras = opciones.headers as Record<string, string>;
    expect(cabeceras["Authorization"]).toBe("Bearer abc123");
  });

  it("no manda Authorization si no hay credencial", async () => {
    const espia = conFetch(json({ estado: "ok" }));

    await pedir("/salud");

    const opciones = espia.mock.calls[0][1] as RequestInit;
    const cabeceras = opciones.headers as Record<string, string>;
    expect(cabeceras["Authorization"]).toBeUndefined();
  });

  // El ADR eligio header y no cookie a proposito. Mandar credenciales de cookie
  // reintroduciria el problema que la decision evita, sobre todo en Safari.
  it("nunca manda cookies", async () => {
    const espia = conFetch(json({ estado: "ok" }));

    await pedir("/salud");

    const opciones = espia.mock.calls[0][1] as RequestInit;
    expect(opciones.credentials).toBe("omit");
  });

  it("serializa el cuerpo como JSON", async () => {
    const espia = conFetch(json({ ok: true }));

    await pedir("/yo", { metodo: "PUT", cuerpo: { nombre: "Ana" } });

    const opciones = espia.mock.calls[0][1] as RequestInit;
    expect(opciones.method).toBe("PUT");
    expect(opciones.body).toBe('{"nombre":"Ana"}');
    expect((opciones.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("devuelve el cuerpo decodificado", async () => {
    conFetch(json({ nombre: "Ana", perfilCompleto: true }));

    const dato = await pedir<{ nombre: string; perfilCompleto: boolean }>("/yo");

    expect(dato).toEqual({ nombre: "Ana", perfilCompleto: true });
  });

  it("acepta un 204 sin cuerpo", async () => {
    conFetch(new Response(null, { status: 204 }));

    await expect(pedir("/auth/salir", { metodo: "POST" })).resolves.toBeUndefined();
  });
});

// El caso de borde declarado en el spec: el servicio esta caido y alguien
// intenta entrar. Tiene que fallar con un mensaje, no colgarse.
describe("cuando el servicio no contesta", () => {
  it("clasifica un fallo de red como sinRespuesta", async () => {
    conFetch(new TypeError("Failed to fetch"));

    const error = await pedir("/salud").catch((e) => e);

    expect(error).toBeInstanceOf(ErrorApi);
    expect(error.sinRespuesta).toBe(true);
    expect(error.estado).toBe(0);
  });

  // Un 502 de un proxy llega en HTML, no en JSON. Sin esto, "el servicio esta
  // caido" se convierte en un error de parseo indescifrable.
  it("no se rompe si la respuesta no es JSON", async () => {
    conFetch(new Response("<html>502 Bad Gateway</html>", { status: 502 }));

    const error = await pedir("/salud").catch((e) => e);

    expect(error).toBeInstanceOf(ErrorApi);
    expect(error.estado).toBe(502);
    expect(error.sinRespuesta).toBe(false);
  });

  // Es un error de configuracion del build, no del usuario. Decirlo asi ahorra
  // buscar el problema en CORS.
  it("avisa si falta la direccion del servicio", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const espia = conFetch(json({}));

    const error = await pedir("/salud").catch((e) => e);

    expect(error).toBeInstanceOf(ErrorApi);
    expect(espia).not.toHaveBeenCalled();
  });
});

describe("errores del servicio", () => {
  // El servicio responde con un unico campo `error` y mensajes genericos, para
  // no revelar si una direccion esta registrada (FR-014). El cliente muestra lo
  // que vino, sin inventarle detalle.
  it("usa el mensaje que mando el servicio", async () => {
    conFetch(json({ error: "el codigo no es valido o vencio" }, 400));

    const error = await pedir("/auth/codigo/verificar", { metodo: "POST" }).catch((e) => e);

    expect(error.message).toBe("el codigo no es valido o vencio");
    expect(error.estado).toBe(400);
  });

  // La sesion que vence mientras el cliente usa el sitio: quien llama necesita
  // distinguir este caso para descartar la credencial y pedir reingreso, en vez
  // de mostrar una pantalla rota.
  it("marca el 401 como sesion invalida", async () => {
    conFetch(json({ error: "no autorizado" }, 401));

    const error = await pedir("/yo", { credencial: "vieja" }).catch((e) => e);

    expect(error.sesionInvalida).toBe(true);
  });

  it("no marca como sesion invalida cualquier otro error", async () => {
    conFetch(json({ error: "origen no autorizado" }, 403));

    const error = await pedir("/yo").catch((e) => e);

    expect(error.sesionInvalida).toBe(false);
  });
});
