"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ErrorApi, pedir, type OpcionesPedido } from "@/lib/api";
import { borrar, credencial as credencialGuardada, guardar, suscribirse, type Sesion } from "@/lib/sesion";

/**
 * La direccion de retiro guardada, tal como viaja en `usuarios.VistaRetiro`.
 *
 * Son cuatro campos y no seis: **`apto` y `cooperativa` NO se guardan** en el
 * perfil (FR-019a los deja afuera). El formulario de pedido los sigue pidiendo
 * en cada envio.
 *
 * El `punto` es el ya ajustado dentro de la cuadra, no el del cruce: precargar
 * tiene que restituir el arrastre que la persona hizo, o le estariamos pidiendo
 * que lo repita.
 */
export type RetiroGuardado = {
  calle: string;
  esquina: string;
  numero: string;
  punto: { lat: number; lng: number } | null;
};

/**
 * El usuario tal como lo devuelve el servicio.
 *
 * Se sincroniza a mano con `usuarios.Vista` del backend — el ADR lo decidio asi
 * para una superficie de este tamaño. Si pasa de unas veinte operaciones,
 * corresponde revisarlo.
 */
export type Usuario = {
  id: string;
  email: string;
  nombre: string;
  telefono: string;
  perfilCompleto: boolean;
  /** Null mientras no haya guardado ninguna. */
  retiro: RetiroGuardado | null;
};

/** Lo que devuelven los dos caminos de ingreso. */
export type RespuestaSesion = {
  credencial: string;
  expiraEn: string;
  usuario: Usuario;
};

export const AVISO_SESION_VENCIDA = "Tu sesión venció. Volvé a ingresar para continuar.";

type EstadoSesion = {
  usuario: Usuario | null;
  /** true mientras se resuelve la credencial guardada, al abrir el sitio. */
  cargando: boolean;
  /**
   * Mensaje del caso de borde declarado en el spec: la sesion vencio o se
   * revoco mientras el cliente estaba usando el sitio. Null el resto del tiempo.
   */
  avisoDeSesion: string | null;
  entrar: (respuesta: RespuestaSesion) => void;
  actualizarUsuario: (usuario: Usuario) => void;
  /** Salida a pedido del cliente: sin aviso, porque ya sabe que salio. */
  salir: () => Promise<void>;
  /** La credencial dejo de servir sola: sin POST, y CON aviso. */
  vencio: () => void;
  descartarAviso: () => void;
};

const Contexto = createContext<EstadoSesion | null>(null);

export function ProveedorSesion({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [avisoDeSesion, setAviso] = useState<string | null>(null);

  /**
   * Resuelve quien esta adentro al abrir el sitio.
   *
   * **Si no hay credencial guardada, NO se llama al servicio.** Es la linea que
   * sostiene FR-001 en tiempo de ejecucion: un desconocido que entra a cotizar
   * no dispara ni un pedido de red, asi que el precio sigue saliendo con el
   * backend caido. La guarda de `cotizar-abierto.test.ts` cubre el grafo de
   * imports; esta cubre el comportamiento.
   */
  useEffect(() => {
    let vigente = true;

    // Todo el cuerpo cuelga de una promesa ya resuelta, y no es adorno: el lint
    // de React prohibe llamar a setState de forma sincrona dentro de un efecto,
    // porque provoca un segundo render antes de pintar. Aca aplica al caso "no
    // hay credencial", que se resuelve sin esperar a nadie.
    Promise.resolve()
      .then(() => {
        const token = credencialGuardada();
        if (!token) return null;
        return pedir<Usuario>("/yo", { credencial: token });
      })
      .then((u) => {
        if (vigente && u) setUsuario(u);
      })
      .catch((err: unknown) => {
        if (!vigente) return;
        // 401 es credencial muerta: se descarta, en silencio. Es la apertura del
        // sitio, no una accion interrumpida — no hay nada que avisar.
        //
        // Cualquier otra cosa —servicio caido, sin red— NO borra la credencial:
        // reingresar tocaria el mismo servicio que acaba de fallar, y se
        // perderia una sesion que probablemente sirva.
        if (err instanceof ErrorApi && err.sesionInvalida) {
          borrar();
          setUsuario(null);
        }
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, []);

  /**
   * Escucha lo que pase en las otras pestañas.
   *
   * Cerrar sesion en una tiene que dejar a las demas sin identidad: si no, la
   * otra sigue mostrando el nombre de alguien que ya no esta adentro y
   * ofreciendo acciones que van a fallar.
   */
  useEffect(() => {
    return suscribirse((sesion: Sesion | null) => {
      if (sesion) return; // entro en otra pestaña; esta se entera al recargar
      setUsuario(null);
      setAviso(null);
    });
  }, []);

  const entrar = useCallback((respuesta: RespuestaSesion) => {
    guardar({ credencial: respuesta.credencial, expiraEn: respuesta.expiraEn });
    setUsuario(respuesta.usuario);
    setAviso(null);
  }, []);

  const vencio = useCallback(() => {
    borrar();
    setUsuario(null);
    setAviso(AVISO_SESION_VENCIDA);
  }, []);

  const salir = useCallback(async () => {
    const token = credencialGuardada();

    // Se limpia el estado local ANTES de esperar la respuesta. Si el servicio no
    // contesta, el cliente igual queda afuera de este navegador; la sesion del
    // servidor sigue viva hasta que venza, y eso es preferible a dejarlo mirando
    // su nombre despues de tocar "salir".
    borrar();
    setUsuario(null);
    setAviso(null);

    if (!token) return;
    try {
      await pedir<void>("/auth/salir", { metodo: "POST", credencial: token });
    } catch {
      // El intento se hizo. No hay nada util que decirle a alguien que ya salio.
    }
  }, []);

  const actualizarUsuario = useCallback((u: Usuario) => setUsuario(u), []);
  const descartarAviso = useCallback(() => setAviso(null), []);

  const valor = useMemo<EstadoSesion>(
    () => ({ usuario, cargando, avisoDeSesion, entrar, actualizarUsuario, salir, vencio, descartarAviso }),
    [usuario, cargando, avisoDeSesion, entrar, actualizarUsuario, salir, vencio, descartarAviso],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/**
 * Estado de sesion compartido.
 *
 * Lanza si se lo usa fuera del proveedor, en vez de devolver un estado vacio: un
 * componente que crea que nadie esta identificado porque olvidaron montar el
 * proveedor es un bug silencioso que se descubre en produccion.
 */
export function useSesion(): EstadoSesion {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useSesion se uso fuera de <ProveedorSesion>");
  return ctx;
}

/**
 * Llama al API con la credencial, y convierte un 401 en el aviso de sesion
 * vencida en vez de en una pantalla rota.
 *
 * Es **el unico camino** por el que las pantallas identificadas deberian hablar
 * con el servicio. Usar `pedir` directo funciona igual hasta que la sesion
 * vence, y ahi la pantalla se queda con un error sin salida.
 */
export function useLlamadaAutenticada() {
  const { vencio } = useSesion();

  return useCallback(
    async <T,>(ruta: string, opciones: Omit<OpcionesPedido, "credencial"> = {}): Promise<T> => {
      const token = credencialGuardada();
      if (!token) {
        vencio();
        throw new ErrorApi(AVISO_SESION_VENCIDA, 401);
      }

      try {
        return await pedir<T>(ruta, { ...opciones, credencial: token });
      } catch (err) {
        if (err instanceof ErrorApi && err.sesionInvalida) {
          vencio();
          throw new ErrorApi(AVISO_SESION_VENCIDA, 401);
        }
        throw err;
      }
    },
    [vencio],
  );
}
