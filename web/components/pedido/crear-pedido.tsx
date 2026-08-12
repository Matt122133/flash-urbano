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
import { armarCuerpoPedido, type DatosDelPedido } from "@/lib/pedido";
import { credencial } from "@/lib/sesion";

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

export function CrearPedido() {
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
        claveDelIntento.current = crypto.randomUUID();
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
    return (
      <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        Un momento…
      </p>
    );
  }

  return (
    <>
      {avisoDelPunto && (
        // FR-022. No se cobra en silencio sobre un punto que ya no corresponde:
        // se recoloco en el cruce y se pide que lo revise.
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {avisoDelPunto}
        </p>
      )}
      <PedidoForm onConfirmar={onConfirmar} inicial={inicial} />
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
 */
function usePrecarga() {
  const { usuario, cargando } = useSesion();

  /**
   * Solo la rama ASINCRONA necesita estado.
   *
   * Los otros tres casos —todavia cargando, sin sesion, con sesion y sin
   * direccion guardada— se derivan abajo sin guardar nada. Meterlos en estado
   * obligaria a escribirlo sincronicamente dentro del efecto, que ademas de ser
   * un render de mas es lo que `react-hooks/set-state-in-effect` marca.
   */
  const [resuelto, setResuelto] = useState<{
    inicial: Partial<FormState>;
    aviso: string | null;
  } | null>(null);

  // Corre una sola vez. Si la persona se identifica DESPUES —desde el dialogo, a
  // mitad de formulario— la precarga no vuelve a correr, y es deliberado:
  // FR-007 prohibe que identificarse le reescriba una direccion recien tipeada.
  const yaCorrio = useRef(false);
  const retiro = usuario?.retiro ?? null;
  const nombre = usuario?.nombre ?? "";
  const telefono = usuario?.telefono ?? "";

  useEffect(() => {
    if (cargando || !retiro || yaCorrio.current) return;
    yaCorrio.current = true;

    const base: Partial<FormState> = { name: nombre, phone: telefono };
    let vigente = true;

    rehidratarRetiro(retiro)
      .then((r) => {
        if (!vigente) return;

        // FR-022, y es la razon por la que `rehidratarRetiro` devuelve
        // `puntoEnLaCuadra`. El perfil puede MOSTRAR un punto viejo; el pedido
        // COBRA sobre el, asi que no puede usarlo sin revalidar.
        //
        // El caso no es hipotetico: el indice de calles se regenera, y un punto
        // guardado en agosto puede quedar en otra cuadra —o en otra zona, o sea
        // a otro precio— en octubre, sin que nadie toque nada.
        if (r.ubicable && r.estado.esquina && !r.puntoEnLaCuadra) {
          setResuelto({
            inicial: {
              ...base,
              retiro: {
                ...r.estado,
                direccion: { ...r.estado.direccion, punto: r.estado.esquina.punto },
              },
            },
            aviso:
              "Revisá el punto de retiro en el mapa: lo recolocamos en el cruce porque el que tenías guardado ya no cae en esa cuadra.",
          });
          return;
        }
        setResuelto({ inicial: { ...base, retiro: r.estado }, aviso: null });
      })
      .catch(() => {
        // Que no se pueda reconstruir la direccion no puede dejar sin pedir a
        // quien igual la puede escribir a mano.
        if (vigente) setResuelto({ inicial: base, aviso: null });
      });

    return () => {
      vigente = false;
    };
  }, [cargando, retiro, nombre, telefono]);

  if (cargando) return { listaLaPrecarga: false } as const;

  // Sin sesion: el formulario arranca vacio, como siempre. Cotizar no pide nada.
  if (!usuario) return { listaLaPrecarga: true, avisoDelPunto: null } as const;

  const base: Partial<FormState> = { name: nombre, phone: telefono };

  // FR-025: un perfil sin direccion deja el formulario utilizable y vacio en esa
  // parte, sin errores.
  if (!retiro) {
    return { inicial: base, listaLaPrecarga: true, avisoDelPunto: null } as const;
  }

  if (!resuelto) return { listaLaPrecarga: false } as const;

  return {
    inicial: resuelto.inicial,
    listaLaPrecarga: true,
    avisoDelPunto: resuelto.aviso,
  } as const;
}
