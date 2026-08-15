"use client";

// Compone el formulario de pedido con lo que necesita para llegar al servicio.
//
// **Este archivo existe para poder importar el cliente del API.** El formulario
// no puede: `components/pedido-form.tsx` es una de las ENTRADAS de
// `lib/cotizar-abierto.test.ts`, la guarda que verifica que cotizar no dependa
// del servicio (FR-001, FR-002, FR-004). Importarlo alla pondria esa guarda en
// rojo, con razon.
//
// Asi que la dependencia se invierte: el formulario declara que necesita
// (`onConfirmar`) y esto decide como se cumple. El formulario queda probable sin
// red y sin sesion, y la pieza que habla con el servicio queda aislada en un
// archivo cuyo trabajo es exactamente ese. Ver research D1.
//
// La guarda tiene un control positivo que afirma que ESTE archivo si alcanza
// `lib/api.ts`. Sin el, borrar el envio entero dejaria la prueba en verde.

import { useCallback, useEffect, useRef, useState } from "react";

import { DialogoIngreso } from "@/components/pedido/dialogo-ingreso";
import {
  PedidoForm,
  type FormState,
  type ResultadoConfirmacion,
} from "@/components/pedido-form";
import { useSesion } from "@/components/sesion/proveedor-sesion";
import { rehidratarRetiro } from "@/components/sesion/rehidratar-retiro";
import { ErrorApi, crearPedido } from "@/lib/api";
import { armarCuerpoPedido, claveDeIntento, type DatosDelPedido } from "@/lib/pedido";
import { credencial } from "@/lib/sesion";

/**
 * Lo que la precarga le entrega al formulario.
 *
 * Los tres campos van juntos siempre —en vez de una union por estado— para que
 * quien la consume no tenga que estrechar el tipo antes de leer `inicial`.
 */
type Precarga = {
  /** Falso mientras no se sepa que precargar: el formulario todavia no se monta. */
  listaLaPrecarga: boolean;
  inicial?: Partial<FormState>;
  avisoDelPunto: string | null;
};

/** La respuesta mientras no se sepa. Constante: no hay nada que decidir. */
const ESPERANDO: Precarga = { listaLaPrecarga: false, avisoDelPunto: null };

/** Traduce lo que junto el formulario a lo que el mapeo puro espera. */
function aDatos(form: FormState): DatosDelPedido {
  return {
    nombre: form.name,
    telefono: form.phone,
    retiro: form.retiro.direccion,
    entrega: form.entrega.direccion,
    // El formulario impide enviar sin tamano; el `|| "chico"` es solo para que
    // el tipo cierre, no una decision de negocio.
    tamano: form.packageSize || "chico",
    cantidad: form.quantity,
    fecha: form.pickupDate,
    hora: form.pickupTime,
    destinatarioNombre: form.receiverName,
    destinatarioTelefono: form.receiverPhone,
  };
}

const SIN_RESPUESTA =
  "No pudimos crear el pedido: el servicio no responde. Lo que cargaste sigue acá, probá de nuevo en un momento.";

export function CrearPedido({ encabezado }: { encabezado?: React.ReactNode }) {
  /**
   * Si ya hay un pedido confirmado en pantalla (FR-034).
   *
   * Vive aca y no en el formulario porque el encabezado lo renderiza la
   * PANTALLA: `app/pedido/page.tsx` lo pasa como prop y esta composicion decide
   * si mostrarlo. El formulario no lo conoce, y no tiene por que.
   */
  const [creado, setCreado] = useState(false);
  /**
   * La clave del INTENTO de envio en curso.
   *
   * Un `useRef` y no un estado: cambiarla no tiene que redibujar nada. Se genera
   * al primer intento y **se conserva entre reintentos y a traves del ingreso**,
   * que es lo que hace que un doble toque o la reanudacion posterior a la puerta
   * lleguen al mismo pedido en vez de crear dos (FR-016).
   *
   * Se descarta recien cuando un pedido se creo: a partir de ahi, el proximo
   * envio es un pedido nuevo y merece una clave nueva.
   */
  const claveDelIntento = useRef<string | null>(null);

  const [dialogoAbierto, setDialogoAbierto] = useState(false);

  /**
   * Como `onConfirmar` ESPERA a que la persona termine de ingresar.
   *
   * El diálogo es declarativo —se abre con un estado— pero el envio es una
   * funcion asincrona que necesita saber cuando termino. Se guarda el `resolve`
   * de una promesa y lo llaman los handlers del dialogo. Es el puente entre las
   * dos formas, y sin el la reanudacion automatica de FR-007a no se puede
   * escribir sin llenar el componente de estados intermedios.
   */
  const esperandoIngreso = useRef<((entro: boolean) => void) | null>(null);

  const pedirIngreso = useCallback((): Promise<boolean> => {
    setDialogoAbierto(true);
    return new Promise<boolean>((resolve) => {
      esperandoIngreso.current = resolve;
    });
  }, []);

  const cerrarDialogo = useCallback((entro: boolean) => {
    setDialogoAbierto(false);
    const resolver = esperandoIngreso.current;
    esperandoIngreso.current = null;
    resolver?.(entro);
  }, []);

  const onConfirmar = useCallback(
    async (form: FormState): Promise<ResultadoConfirmacion> => {
      const armado = armarCuerpoPedido(aDatos(form));
      if (!armado.ok) {
        // Los dos motivos deberian estar filtrados por la validacion del
        // formulario. Que igual se traduzcan a un mensaje —en vez de a un
        // throw— es lo que evita una pantalla rota si alguna vez no lo estan.
        return {
          estado: "error",
          mensaje:
            armado.motivo === "fuera-de-zona"
              ? "Ese punto queda fuera de nuestra zona de cobertura. Escribinos y vemos cómo darte una mano."
              : "Marcá el punto de retiro antes de confirmar.",
        };
      }

      if (!claveDelIntento.current) {
        // No es `crypto.randomUUID()` directo a proposito: esa funcion solo
        // existe en contexto seguro y desaparece al probar desde un telefono
        // sobre http. Ver `claveDeIntento` en lib/pedido.ts.
        claveDelIntento.current = claveDeIntento();
      }
      const clave = claveDelIntento.current;

      // FR-003 y FR-006: la puerta esta ACA, en el ultimo paso, y no antes.
      // Todo lo de arriba —cotizar, cargar la direccion, ver el precio— ocurrio
      // sin pedirle nada a nadie.
      if (!credencial()) {
        if (!(await pedirIngreso())) {
          // FR-008: desistir no es un error y no creo nada. La clave se
          // conserva: si vuelve a intentar, es el mismo pedido.
          return { estado: "cancelado" };
        }
      }

      // Un solo reintento, y solo despues de un ingreso. Sin el tope, un 401
      // persistente —una credencial que el servicio rechaza siempre— dejaria a
      // la persona en un bucle de dialogos que se reabren solos.
      for (let intento = 0; intento < 2; intento++) {
        try {
          const pedido = await crearPedido(armado.cuerpo, clave, credencial());
          // Creado: el proximo envio es otro pedido y necesita otra clave.
          claveDelIntento.current = null;
          setCreado(true); // FR-034: con esto se retira el encabezado.
          return { estado: "creado", codigo: pedido.codigo };
        } catch (e) {
          if (!(e instanceof ErrorApi)) {
            return {
              estado: "error",
              mensaje: "No pudimos crear el pedido. Probá de nuevo.",
            };
          }
          if (e.sinRespuesta) {
            // SC-013: se dice la verdad —el pedido NO se creo— y lo cargado
            // sigue en pantalla. La clave se conserva.
            return { estado: "error", mensaje: SIN_RESPUESTA };
          }
          // FR-009: una sesion vencida se comporta igual que no tener sesion. Se
          // abre la puerta y se reanuda, en vez de mostrar un error que la
          // persona no puede resolver desde el formulario.
          if (e.sesionInvalida && intento === 0) {
            if (!(await pedirIngreso())) {
              return { estado: "cancelado" };
            }
            continue;
          }
          return { estado: "error", mensaje: e.message };
        }
      }

      return { estado: "error", mensaje: SIN_RESPUESTA };
    },
    [pedirIngreso],
  );

  const { inicial, listaLaPrecarga, avisoDelPunto } = usePrecarga();

  // El formulario se monta recien cuando la precarga se resolvio.
  //
  // No es prolijidad: `PedidoForm` toma `inicial` UNA vez, al montarse. Montarlo
  // antes y llenarlo despues exigiria rehidratarlo desde afuera —lo que hoy no
  // sabe hacer— o pisar lo que la persona ya escribio, que es justo lo que
  // FR-007 prohibe.
  if (!listaLaPrecarga) {
    // El encabezado va TAMBIEN en esta rama, y no es un detalle: es la que se
    // pre-renderiza al construir el sitio —ahi `cargando` siempre es true— y si
    // el titulo no estuviera aca, el HTML que lee un buscador no tendria `h1`.
    return (
      <>
        {encabezado}
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          Un momento…
        </p>
      </>
    );
  }

  return (
    <>
      {/* FR-034: con el pedido hecho queda solo el comprobante. El titulo y la
          instruccion de escribir la calle invitarian a hacer algo que se acaba
          de hacer. */}
      {!creado && encabezado}
      {avisoDelPunto && (
        // FR-022. No se cobra en silencio sobre un punto que ya no corresponde:
        // se recoloco en el cruce y se pide que lo revise.
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {avisoDelPunto}
        </p>
      )}
      <PedidoForm
        onConfirmar={onConfirmar}
        inicial={inicial}
        onReiniciar={() => setCreado(false)}
      />
      <DialogoIngreso
        abierto={dialogoAbierto}
        onListo={() => cerrarDialogo(true)}
        onCancelar={() => cerrarDialogo(false)}
      />
    </>
  );
}

/**
 * Lo que el perfil ya sabe, listo para precargar el formulario (FR-023).
 *
 * Es el valor que `006` prometio y todavia no entregaba: la respuesta concreta a
 * "¿para que me registro?".
 *
 * **Solo corre al montar.** Si la persona se identifica DESPUES —desde el
 * dialogo, a mitad de formulario— la precarga no vuelve a correr, y es
 * deliberado: FR-007 prohibe que identificarse le reescriba una direccion que
 * acaba de tipear. El valor de la precarga es ahorrar tipeo, no imponerlo.
 *
 * **2026-08-14 — esa promesa era falsa, y la encontro T039.** El efecto no
 * volvia a correr, es cierto, pero eso no alcanzaba: quien entraba por el
 * dialogo pasaba de `usuario: null` a tener sesion CON direccion guardada, y
 * entonces la rama derivada de abajo devolvia `listaLaPrecarga: false` mientras
 * se rehidrataba. Eso **desmonta `PedidoForm`**, y al volver se monta de cero
 * con el `inicial` del perfil — o sea que todo lo tipeado se perdia y quedaba
 * pisado por la direccion guardada. Justo lo que FR-007 prohibe, por un camino
 * que nadie miro: no "la precarga corre dos veces" sino "el formulario se monta
 * dos veces".
 *
 * Por eso hoy la decision **se congela**: apenas hay algo que entregarle al
 * formulario, ese valor queda fijo y ninguna sesion posterior lo cambia. La
 * garantia deja de depender de que un efecto no vuelva a dispararse.
 *
 * No lo cubre ninguna prueba automatica: `web/` corre en entorno `node` sin DOM
 * y nada de este repo renderiza React. Esta anotado en el tracker.
 */
function usePrecarga(): Precarga {
  const { usuario, cargando } = useSesion();

  /**
   * La decision ENTERA, tomada una sola vez.
   *
   * Antes del 2026-08-14 solo la rama asincrona vivia en estado y los otros tres
   * casos se derivaban en cada render. Eso era el defecto: derivar significa
   * volver a mirar la sesion, y la sesion cambia cuando alguien entra por el
   * dialogo. Con todo adentro del estado, lo que se decidio al montar es lo que
   * queda.
   */
  const [precarga, setPrecarga] = useState<Precarga | null>(null);

  // Corre una sola vez, apenas se sabe si hay sesion. Si la persona se identifica
  // DESPUES —desde el dialogo, a mitad de formulario— este efecto vuelve a
  // dispararse y sale por `yaCorrio`: FR-007 prohibe que identificarse le
  // reescriba algo que acaba de tipear.
  const yaCorrio = useRef(false);
  const retiro = usuario?.retiro ?? null;
  const nombre = usuario?.nombre ?? "";
  const telefono = usuario?.telefono ?? "";

  useEffect(() => {
    if (cargando || yaCorrio.current) return;
    yaCorrio.current = true;

    let vigente = true;

    // Todo cuelga de una promesa ya resuelta, igual que en `proveedor-sesion`:
    // el lint prohibe llamar a setState de forma sincrona dentro de un efecto.
    // Aca aplica a los dos casos que se resuelven sin esperar a nadie.
    Promise.resolve()
      .then(async (): Promise<Precarga> => {
        // Sin sesion: el formulario arranca vacio, como siempre. Cotizar no pide
        // nada. **Este es el caso que estaba roto**: se decide ahora y no se
        // vuelve a tocar, aunque despues ingrese desde el dialogo.
        if (!usuario) return { listaLaPrecarga: true, avisoDelPunto: null };

        const base: Partial<FormState> = { name: nombre, phone: telefono };

        // FR-025: un perfil sin direccion deja el formulario utilizable y vacio
        // en esa parte, sin errores.
        if (!retiro) {
          return { listaLaPrecarga: true, inicial: base, avisoDelPunto: null };
        }

        try {
          const r = await rehidratarRetiro(retiro);

          // FR-022, y es la razon por la que `rehidratarRetiro` devuelve
          // `puntoEnLaCuadra`. El perfil puede MOSTRAR un punto viejo; el pedido
          // COBRA sobre el, asi que no puede usarlo sin revalidar.
          //
          // El caso no es hipotetico: el indice de calles se regenera, y un punto
          // guardado en agosto puede quedar en otra cuadra —o en otra zona, o sea
          // a otro precio— en octubre, sin que nadie toque nada.
          if (r.ubicable && r.estado.esquina && !r.puntoEnLaCuadra) {
            return {
              listaLaPrecarga: true,
              inicial: {
                ...base,
                retiro: {
                  ...r.estado,
                  direccion: { ...r.estado.direccion, punto: r.estado.esquina.punto },
                },
              },
              avisoDelPunto:
                "Revisá el punto de retiro en el mapa: lo recolocamos en el cruce porque el que tenías guardado ya no cae en esa cuadra.",
            };
          }

          return {
            listaLaPrecarga: true,
            inicial: { ...base, retiro: r.estado },
            avisoDelPunto: null,
          };
        } catch {
          // Que no se pueda reconstruir la direccion no puede dejar sin pedir a
          // quien igual la puede escribir a mano.
          return { listaLaPrecarga: true, inicial: base, avisoDelPunto: null };
        }
      })
      .then((p) => {
        if (vigente) setPrecarga(p);
      });

    return () => {
      vigente = false;
    };
  }, [cargando, usuario, retiro, nombre, telefono]);

  // Sin ramas derivadas y sin mirar la sesion: lo que se decidio, se devuelve.
  return precarga ?? ESPERANDO;
}
