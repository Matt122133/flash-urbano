"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { MapaZonasDinamico } from "./mapa-zonas-dinamico";
import type { EstadoMosaicos, Punto } from "./mapa-zonas";
import {
  BloqueDireccion,
  ESTADO_DIRECCION_VACIO,
  type EstadoDireccion,
} from "./bloque-direccion";
import { componerDireccion } from "@/lib/direccion";
import {
  MENSAJE_RETIRO_EN_EL_PASADO,
  PLAZO_DE_ENTREGA,
  hoy,
  retiroEnElPasado,
} from "@/lib/fechas";
import { contiene, regionPermitida } from "@/lib/direcciones";
import { resolverZona } from "@/lib/zona-lookup";
// **El boton de imprimir se importa; `lib/etiqueta-pdf.ts` NO.** El pdf y su
// libreria entran por un import dinamico adentro del boton (FR-014), asi que
// este archivo —una de las ENTRADAS de cotizar-abierto.test.ts— no engorda ni
// gana dependencias de red.
import { BotonImprimir } from "@/components/pedido/boton-imprimir";
import { etiquetaDelFormulario } from "@/lib/etiqueta";

type PackageSize = "chico" | "mediano" | "grande";

/**
 * Lo que el formulario junta.
 *
 * Exportado desde `007` porque es el tipo de lo que viaja por `onConfirmar`:
 * quien compone este formulario necesita nombrarlo para cumplir esa prop.
 */
export type FormState = {
  name: string;
  phone: string;
  // Donde hay que retirar el paquete. Tiene autocompletado, y su punto se
  // resuelve **en silencio** cuando el cruce es inequivoco: no se muestra, no se
  // cobra sobre el, y puede faltar sin trancar el pedido (FR-014, FR-015). Se
  // guarda para la ruta del repartidor.
  retiro: EstadoDireccion;
  // Domicilio de entrega. **De aca sale la zona desde `011`**: el cruce se
  // resuelve a un punto, ese punto decide la zona, y sin el no hay pedido.
  //
  // Desde `013` la zona ya no decide un monto —decide ADMISION: si cae fuera de
  // las cinco, no hay pedido y se encamina al contacto—. La zona NO se guarda
  // acá: se deriva del punto con resolverZona() en cada render, para que no
  // pueda quedar desincronizada de la ubicacion.
  entrega: EstadoDireccion;
  // Única forma de declarar qué se envía. La descripción libre se quitó en
  // `004`: el cliente ya la había marcado como no necesaria en el relevamiento
  // original, y se implementó igual en `001`.
  packageSize: PackageSize | "";
  // Cuando pasamos a buscar el paquete. No hay contraparte de entrega: desde
  // `004` la entrega no se agenda, se promete — PLAZO_DE_ENTREGA, fijo para todo
  // pedido.
  pickupDate: string;
  pickupTime: string;
  // Quien recibe: a nombre de quién va el paquete, y un teléfono para coordinar
  // la entrega con esa persona.
  //
  // `004` había sacado los dos datos que se pedían acá —nombre y cédula— sobre
  // el supuesto de que ambos se capturan en la app Android al entregar. El
  // cliente corrigió en `005`: el nombre sí hace falta al pedir, porque si no el
  // repartidor llega a una puerta sin saber a quién preguntar. **La cédula no
  // vuelve**: al momento de pedir no se usa para nada.
  receiverName: string;
  receiverPhone: string;
  quantity: string;
};

const INITIAL_STATE: FormState = {
  name: "",
  phone: "",
  retiro: ESTADO_DIRECCION_VACIO,
  entrega: ESTADO_DIRECCION_VACIO,
  packageSize: "",
  pickupDate: "",
  pickupTime: "",
  receiverName: "",
  receiverPhone: "",
  quantity: "1",
};

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";
const errorClass = "mt-1 text-xs font-medium text-red-600";
const sectionClass =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6";

function Field({
  label,
  htmlFor,
  error,
  children,
  optional,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
        {optional && (
          <span className="ml-1 text-xs font-normal text-slate-400">
            (opcional)
          </span>
        )}
      </label>
      {children}
      {error && <p className={errorClass}>{error}</p>}
    </div>
  );
}

/**
 * Qué tiene de malo un teléfono, o `null` si está bien.
 *
 * Una sola función para el de quien envía y el de quien recibe: FR-013 pide que
 * se validen igual, y dos copias de la misma regla es la forma más segura de
 * que dejen de validar igual.
 */
function problemaTelefono(valor: string): string | null {
  if (!valor.trim()) return "Ingresá un teléfono.";
  if (valor.replace(/[^0-9]/g, "").length < 8) {
    return "Ingresá un teléfono válido (mínimo 8 dígitos).";
  }
  return null;
}

function validate(
  form: FormState,
  estadoMosaicos: EstadoMosaicos,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!form.name.trim()) errors.name = "Ingresá un nombre.";

  const problemaDeTelefono = problemaTelefono(form.phone);
  if (problemaDeTelefono) errors.phone = problemaDeTelefono;

  // ------------------------------------------------------------------
  // El RETIRO se valida solo por completitud, y contra el TEXTO.
  // ------------------------------------------------------------------
  //
  // **Invertido en `011`.** No se exige que la calle exista en el indice, ni que
  // el cruce resuelva, ni que haya punto: si el texto no resuelve —o la calle es
  // homonima— el pedido sigue igual, sin punto y **sin decir nada**
  // (FR-014, FR-015). Rechazarlo seria trancar a alguien por un hueco del indice
  // sobre su propia direccion, que el sabe que esta bien.
  const retiro = form.retiro;
  if (!retiro.direccion.calle.trim()) errors.calle = "Ingresá la calle.";
  if (!retiro.direccion.esquina.trim()) errors.esquina = "Ingresá la esquina.";
  if (!retiro.direccion.numero.trim()) {
    errors.numero = "Ingresá el número de puerta.";
  }

  // La UNICA comprobacion del retiro que puede frenar un pedido (FR-011): si su
  // punto se resolvio y cae fuera de las cinco zonas, no se retira de ahi.
  //
  // **Es de mejor esfuerzo y la asimetria es deliberada**: solo actua cuando hay
  // punto. Un retiro que no resolvio pasa sin control, porque no hay contra que
  // comprobarlo. O sea que el area se cumple casi siempre, no siempre, y esa
  // diferencia es del tamaño de los huecos del indice de calles.
  const puntoRetiro = retiro.direccion.punto;
  if (puntoRetiro && !resolverZona(puntoRetiro.lat, puntoRetiro.lng)) {
    errors.ubicacionRetiro =
      "Esa dirección de retiro queda fuera de nuestra zona de cobertura. Escribinos y vemos cómo ayudarte.";
  }

  // ------------------------------------------------------------------
  // La ENTREGA es la que ubica, y de la que sale la zona.
  // ------------------------------------------------------------------
  const entregaEstado = form.entrega;
  const entrega = entregaEstado.direccion;
  if (!entrega.calle.trim()) errors.entregaCalle = "Elegí la calle.";
  else if (!entrega.esquina.trim()) errors.entregaEsquina = "Elegí la esquina.";
  else if (entregaEstado.candidatos.length > 1) {
    errors.entregaEsquina =
      "Hay más de un cruce con ese nombre: elegí cuál es el de la entrega.";
  } else if (!entregaEstado.esquina) {
    errors.entregaEsquina = "No encontramos ese cruce. Revisá los nombres.";
  }
  if (!entrega.numero.trim())
    errors.entregaNumero = "Ingresá el número de puerta.";

  // La ubicacion de la entrega es obligatoria: de ella sale la zona, y la zona
  // decide si el envio entra. Sin punto no hay pedido, y con el mapa caido
  // tampoco — no se acepta una entrega sobre un mapa que la persona no pudo ver.
  const punto = entrega.punto;
  if (estadoMosaicos === "no-disponible") {
    errors.ubicacionEntrega =
      "No podemos cargar el mapa en este momento, así que no podemos confirmar que llegamos hasta ahí. Escribinos y lo resolvemos.";
  } else if (entregaEstado.esquina && !punto) {
    errors.ubicacionEntrega = "Todavía no pudimos ubicar esa dirección.";
  } else if (punto && !resolverZona(punto.lat, punto.lng)) {
    errors.ubicacionEntrega =
      "Ese punto queda fuera de nuestra zona de cobertura. Escribinos y vemos cómo ayudarte.";
  } else if (
    punto &&
    entregaEstado.esquina &&
    !contiene(
      regionPermitida(entregaEstado.esquina, entregaEstado.cualEsLaCalle),
      punto,
    )
  ) {
    // Guarda barata, no el control principal: el arrastre ya se clampea al
    // soltar (FR-018). Si esto salta, algo movio el punto por otra via.
    errors.ubicacionEntrega =
      "El punto quedó fuera de la cuadra que indicaste. Movelo de nuevo.";
  }

  // EN PAUSA — desactivadas por `014` el 2026-08-30, junto con los dos campos
  // que exigen. **Esta es la mitad que se olvida al reponer**: sin descomentar
  // estas dos lineas, los campos vuelven a la pantalla y nunca se exigen; y sin
  // comentarlas al sacarlos, el formulario rechaza el pedido pidiendo algo que
  // no muestra, con un mensaje que no tiene donde dibujarse.
  //
  // Van con sus bloques de `<Field>`, mas abajo en este archivo, que explican
  // el resto.
  //
  // if (!form.packageSize) errors.packageSize = "Elegí un tamaño de paquete.";
  // if (!form.pickupTime) errors.pickupTime = "Elegí un horario de retiro.";

  // La FECHA se queda, y su validacion tambien. Es lo unico de este bloque que
  // `014` NO toco: Diego necesita saber para que dia es el pedido.
  if (!form.pickupDate) errors.pickupDate = "Elegí una fecha de retiro.";

  // Ya no hay coherencia entre dos fechas que validar: la entrega dejó de
  // agendarse en `004`. Queda la única regla que sobrevive sola — un día que ya
  // terminó no sirve para pasar a buscar nada. La lógica vive en lib/fechas.ts
  // para poder probar los bordes (cambio de mes, cambio de año) sin depender del
  // reloj de quien corra los tests.
  if (retiroEnElPasado(form.pickupDate)) {
    errors.pickupDate = MENSAJE_RETIRO_EN_EL_PASADO;
  }

  // Las claves de abajo tienen que estar escritas IDENTICAS en el render, o el
  // mensaje no se muestra nunca y el formulario se niega a enviarse sin decir
  // por qué. No es hipotético: el campo del nombre de quien recibe cargó
  // exactamente ese defecto durante dos features, con `recieverName` de un lado
  // y `receiverName` del otro.
  if (!form.receiverName.trim()) {
    errors.receiverName = "Ingresá el nombre de quien recibe.";
  }

  const problemaDeTelefonoDestino = problemaTelefono(form.receiverPhone);
  if (problemaDeTelefonoDestino) {
    errors.receiverPhone = problemaDeTelefonoDestino;
  }

  const quantity = Number(form.quantity);
  if (!form.quantity || Number.isNaN(quantity) || quantity < 1) {
    errors.quantity = "La cantidad debe ser 1 o más.";
  }

  return errors;
}

/**
 * Que paso al intentar confirmar.
 *
 * `cancelado` no es un error: es la persona que llego a la puerta de ingreso y
 * decidio no entrar. El formulario tiene que quedar igual que estaba, sin
 * mensaje rojo, porque no hizo nada mal.
 */
export type ResultadoConfirmacion =
  | { estado: "creado"; codigo: string }
  | { estado: "cancelado" }
  | { estado: "error"; mensaje: string };

export type PedidoFormProps = {
  /**
   * Confirma el pedido. **Es la unica forma en que este componente llega al
   * mundo exterior**, y por eso es una prop y no un import.
   *
   * El motivo no es elegancia: `components/pedido-form.tsx` es una de las
   * ENTRADAS de `lib/cotizar-abierto.test.ts`, la guarda que verifica que el
   * formulario no dependa del servicio (FR-001, FR-002, FR-004). Importar el
   * cliente del API desde aca pondria esa guarda en rojo —con razon: seria un
   * formulario que puede terminar necesitando la red antes de confirmar—.
   * Quien monta este componente decide como se cumple.
   *
   * (Y ni siquiera se puede NOMBRAR ese import con su sintaxis en un comentario:
   * la guarda busca por texto y toma de mas a proposito, "hacia el lado
   * seguro". Se comprobo de la peor manera, poniendola en rojo con un
   * comentario.)
   *
   * Ver research D1 en specs/007-pedido-identificado/research.md.
   */
  onConfirmar: (datos: FormState) => Promise<ResultadoConfirmacion>;

  /**
   * Valores iniciales, para precargar desde el perfil (US4). Se combinan sobre
   * los vacios: lo que no venga queda como estaba.
   */
  inicial?: Partial<FormState>;

  /**
   * Avisa que se volvio del comprobante al formulario (FR-034).
   *
   * Existe porque el encabezado de la pantalla lo renderiza quien monta este
   * componente, y necesita saber cuando volver a mostrarlo. Opcional: el
   * formulario sigue sirviendo sin nadie escuchando.
   */
  onReiniciar?: () => void;
};

export function PedidoForm({ onConfirmar, inicial, onReiniciar }: PedidoFormProps) {
  const [form, setForm] = useState<FormState>({ ...INITIAL_STATE, ...inicial });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [errorDeEnvio, setErrorDeEnvio] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<
    { form: FormState; codigo: string } | null
  >(null);
  const [estadoMosaicos, setEstadoMosaicos] =
    useState<EstadoMosaicos>("cargando");
  // Se recentra cuando el cruce se resuelve, no en cada cambio del punto: el
  // mapa no debe saltar mientras la persona arrastra el pin.
  const [centrarEn, setCentrarEn] = useState<Punto | null>(null);
  const [salioDeLaCuadra, setSalioDeLaCuadra] = useState(false);

  // **El punto que cobra es el de ENTREGA desde `011`.** El del retiro existe,
  // se resuelve en silencio y puede faltar, pero no entra en ningun calculo de
  // plata: ver docs/decisions/pricing-from-delivery-zone.md.
  const punto = form.entrega.direccion.punto ?? null;

  // Derivada, no guardada. Ver el comentario en FormState.
  const zona = punto ? resolverZona(punto.lat, punto.lng) : null;

  const region = form.entrega.esquina
    ? regionPermitida(form.entrega.esquina, form.entrega.cualEsLaCalle)
    : null;

  // El aviso de cambio de zona al mover el pin se fue en `013` (FR-005), y con
  // el su estado entero. Existia por una sola razon: cruzar de zona cambiaba el
  // monto, y cambiarle a alguien el precio sin decirselo es lo que no se podia
  // hacer. Sin monto, cruzar entre dos zonas que las dos se cubren no le cambia
  // nada a la persona, y el bloque de abajo ya le dice en cual quedo.
  //
  // Lo que SI sigue avisando es el caso que importa: que el punto quede fuera de
  // toda zona. Eso no pasa por aca — lo dice `ResultadoZona` y lo frena la
  // validacion.

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /**
   * Revisa la fecha de retiro al salir del campo, en vez de esperar al envio
   * (FR-030). Enterarse al final obliga a volver a subir por todo el
   * formulario, que en un telefono es varias pantallas.
   *
   * Solo toca el error de fecha pasada: si habia un "Elegí una fecha" de un
   * intento de envio anterior, se respeta. Por eso el borrado se hace
   * comparando contra el mensaje conocido y no vaciando la clave.
   */
  function revisarFechaDeRetiro() {
    const enElPasado = retiroEnElPasado(form.pickupDate);

    setErrors((prev) => {
      const siguiente = { ...prev };
      if (siguiente.pickupDate === MENSAJE_RETIRO_EN_EL_PASADO) {
        delete siguiente.pickupDate;
      }
      if (enElPasado) siguiente.pickupDate = MENSAJE_RETIRO_EN_EL_PASADO;
      return siguiente;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // Doble envio: el guard es lo que evita que un doble toque dispare dos
    // llamadas. La clave de idempotencia lo cubre del lado del servicio, pero
    // no hay motivo para mandar la segunda.
    if (enviando) return;

    const nextErrors = validate(form, estadoMosaicos);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setErrorDeEnvio(null);
    setEnviando(true);
    try {
      const r = await onConfirmar(form);
      if (r.estado === "creado") {
        setSubmitted({ form, codigo: r.codigo });
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (r.estado === "error") {
        setErrorDeEnvio(r.mensaje);
      }
      // `cancelado` no deja mensaje: desistir del ingreso no es un error, y lo
      // cargado sigue en pantalla (FR-008).
    } catch (e) {
      // Este `catch` no existia hasta el 2026-08-14, y su ausencia produjo el
      // peor sintoma posible: **el boton de confirmar no hacia nada**.
      //
      // Quien implementa `onConfirmar` traduce a un resultado todo lo que
      // ANTICIPA —red caida, 401, datos invalidos—. Lo que no anticipa tira, y
      // sin catch el `finally` apagaba `enviando`, la excepcion se perdia, y la
      // pantalla quedaba exactamente igual que antes de tocar. La persona no
      // tiene forma de distinguir eso de un boton roto, y vuelve a tocar.
      //
      // Paso de verdad probando desde un telefono: `crypto.randomUUID()` no
      // existe fuera de contexto seguro y tiraba antes de llegar a la red. Esa
      // causa esta arreglada, pero **la clase no**: cualquier throw futuro
      // volveria a caer aca. Por eso la red va debajo del arreglo puntual.
      //
      // El mensaje dice lo unico que se sabe con certeza —que el pedido NO se
      // creo— y no inventa un motivo. El detalle va a la consola: al cliente no
      // le sirve y a quien depura le hace falta.
      console.error("Fallo inesperado al confirmar el pedido:", e);
      setErrorDeEnvio(
        "No pudimos crear el pedido. Lo que cargaste sigue acá, probá de nuevo en un momento.",
      );
    } finally {
      setEnviando(false);
    }
  }

  if (submitted) {
    return (
      <Confirmation
        form={submitted.form}
        codigo={submitted.codigo}
        onReset={() => {
          // FR-035. Se conserva lo que identifica a QUIEN ENVIA —su nombre, su
          // telefono y su direccion de retiro con el punto— y se vacia todo lo
          // que pertenece al envio que se acaba de cerrar: a donde va, cuando,
          // quien recibe y que se manda.
          //
          // El corte no es estetico: lo de arriba es la misma persona pidiendo
          // otra vez desde el mismo lugar —el caso normal— y lo de abajo cambia
          // en cada pedido. Hacerle retipear su propia direccion para mandar un
          // segundo paquete es exactamente el tipeo que el Principio II existe
          // para sacar.
          //
          // Sale del pedido RECIEN CONFIRMADO y no de `inicial`, y esa
          // diferencia importa: quien entro por la puerta a mitad de formulario
          // nunca tuvo precarga —corre solo al montar, por FR-007— asi que
          // `inicial` esta vacio justo en el camino mas comun. Ademas el punto
          // ya se valido en esta sesion, asi que no hay nada que revalidar.
          setForm({
            ...INITIAL_STATE,
            name: submitted.form.name,
            phone: submitted.form.phone,
            retiro: submitted.form.retiro,
          });
          setErrors({});
          setSubmitted(null);
          onReiniciar?.();
        }}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <section className={sectionClass}>
        <h2 className="text-base font-semibold text-slate-900">
          ¿Quién envía?
        </h2>
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" htmlFor="name" error={errors.name}>
              <input
                id="name"
                className={inputClass}
                placeholder="Nombre y apellido, o razón social"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
              />
            </Field>
            <Field label="Teléfono" htmlFor="phone" error={errors.phone}>
              <input
                id="phone"
                type="tel"
                className={inputClass}
                placeholder="09X XXX XXX"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
              />
            </Field>
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className="text-base font-semibold text-slate-900">
          ¿De dónde retiramos el paquete?
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Escribí la dirección de dónde pasamos a buscar el paquete.
        </p>

        <BloqueDireccion
          id="retiro"
          // El retiro dejo de cobrar en `011`: su punto se resuelve en silencio,
          // no se muestra, y puede faltar sin trancar el pedido.
          modo="oportunista"
          valor={form.retiro}
          errors={errors}
          // Sin recentrar ni limpiar el aviso de cuadra: los dos son del mapa, y
          // el mapa se fue a la entrega en `011`.
          onCambio={(estado) => update("retiro", estado)}
        />

        {errors.ubicacionRetiro && (
          <p className={errorClass}>{errors.ubicacionRetiro}</p>
        )}

      </section>

      <section className={sectionClass}>
        <h2 className="text-base font-semibold text-slate-900">
          ¿A dónde lo llevamos?
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Escribí la calle y la esquina: con eso ubicamos el punto y confirmamos
          que llegamos hasta ahí.
        </p>
        <BloqueDireccion
          id="entrega"
          // De aca sale la zona desde `011`, y la zona decide si el envio entra.
          modo="exigente"
          valor={form.entrega}
          onCambio={(estado) => {
            update("entrega", estado);
            setSalioDeLaCuadra(false);
            // Solo se recentra al resolverse un cruce nuevo, no al arrastrar.
            if (estado.esquina && estado.esquina !== form.entrega.esquina) {
              setCentrarEn(estado.esquina.punto);
            }
          }}
          errors={{
            calle: errors.entregaCalle,
            esquina: errors.entregaEsquina,
            numero: errors.entregaNumero,
          }}
        />

        {/*
          El mapa va DEBAJO de los campos y no arriba (FR-010b): los campos son
          lo primero de la pantalla, y el mapa es la respuesta a lo que la
          persona escribio. **Desde `011` cuelga de la ENTREGA**, que es la que
          decide la zona. Mientras no hay cruce resuelto se reserva el espacio
          en vez de dejar el mapa vacio (FR-010a): asi no salta el layout al
          aparecer, y nadie intenta tocar un mapa que ya no coloca el punto.
        */}
        <div className="mt-4">
          {form.entrega.esquina || form.entrega.candidatos.length > 1 ? (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <MapaZonasDinamico
                interactivo={Boolean(form.entrega.esquina)}
                punto={punto}
                onPunto={(p) =>
                  update("entrega", {
                    ...form.entrega,
                    direccion: { ...form.entrega.direccion, punto: p },
                  })
                }
                region={region}
                onFueraDeRegion={() => setSalioDeLaCuadra(true)}
                candidatos={
                  form.entrega.candidatos.length > 1
                    ? form.entrega.candidatos.map((c) => c.punto)
                    : undefined
                }
                centrarEn={centrarEn}
                onEstadoMosaicos={setEstadoMosaicos}
                className="h-[340px] w-full sm:h-[420px]"
              />
            </div>
          ) : (
            <div className="flex h-[340px] w-full items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm text-slate-500 sm:h-[420px]">
              Cuando elijas la calle y la esquina, acá te mostramos el punto en
              el mapa.
            </div>
          )}
        </div>

        {form.entrega.esquina && (
          <p className="mt-2 text-xs text-slate-500">
            Podés arrastrar el punto dentro de la cuadra sombreada para dejarlo
            en tu puerta.
          </p>
        )}

        {salioDeLaCuadra && (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Lo trajimos de vuelta: el punto solo puede moverse dentro de las
            cuadras de {form.entrega.direccion.calle} que tocan la esquina que
            elegiste. Si tu puerta está más lejos, revisá la esquina.
          </p>
        )}

        <ResultadoZona
          estadoMosaicos={estadoMosaicos}
          punto={punto}
          zona={zona}
        />
        {errors.ubicacionEntrega && (
          <p className={errorClass}>{errors.ubicacionEntrega}</p>
        )}
      </section>

      <section className={sectionClass}>
        <h2 className="text-base font-semibold text-slate-900">
          ¿Qué envías?
        </h2>
        <div className="mt-4 flex flex-col gap-4">
          {/*
            EN PAUSA — desactivado por `014` el 2026-08-30, decision del cliente.

            Diego no usa hoy el tamaño del paquete: no cambia la ruta, no cambia
            nada. **Dijo que en el futuro si lo va a usar**, y por eso esto esta
            comentado y no borrado. Sin esa frase, esto seria codigo muerto y
            habria que borrarlo.

            PARA REPONERLO hay que descomentar TRES cosas, no una:

              1. este bloque;
              2. la linea de `validate()` que exige el tamaño — vive mas arriba
                 en este mismo archivo, cerca de `errors.quantity`, y **es la
                 que se olvida**: sin ella el campo vuelve a mostrarse pero
                 nunca se exige;
              3. el valor fijo de `components/pedido/crear-pedido.tsx`, que hoy
                 manda `"chico"` sin mirar el formulario. Si no se revierte, el
                 campo pregunta y el pedido viaja con `chico` igual.

            `FormState.packageSize`, `INITIAL_STATE` y el tipo `PackageSize`
            siguen vivos a proposito: reponerlos seria reescribirlos.

            <Field
              label="Tamaño del paquete"
              htmlFor="packageSize"
              error={errors.packageSize}
            >
              <select
                id="packageSize"
                className={inputClass}
                value={form.packageSize}
                onChange={(e) =>
                  update("packageSize", e.target.value as PackageSize)
                }
              >
                <option value="">Seleccioná un tamaño</option>
                <option value="chico">Chico</option>
                <option value="mediano">Mediano</option>
                <option value="grande">Grande</option>
              </select>
            </Field>
          */}

          <Field label="Cantidad de paquetes" htmlFor="quantity" error={errors.quantity}>
            <input
              id="quantity"
              type="number"
              min={1}
              className={`${inputClass} max-w-[10rem]`}
              value={form.quantity}
              onChange={(e) => update("quantity", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className="text-base font-semibold text-slate-900">
          ¿Cuándo pasamos a buscarlo?
        </h2>
        <div className="mt-4 grid gap-4">
          <Field label="Fecha de retiro" htmlFor="pickupDate" error={errors.pickupDate}>
            <input
              id="pickupDate"
              type="date"
              className={inputClass}
              min={hoy()}
              value={form.pickupDate}
              onChange={(e) => update("pickupDate", e.target.value)}
              onBlur={revisarFechaDeRetiro}
            />
          </Field>
          {/*
            EN PAUSA — desactivado por `014` el 2026-08-30, decision del cliente.

            **Y tiene un motivo de negocio que conviene entender antes de
            reponerlo**: Diego pasa a una hora fija y coordina el resto en
            persona. Si una empresa necesita otra franja, lo habla el, **y ahi
            el precio puede subir**. O sea que la hora no desaparecio del
            negocio: salio del sitio para entrar en una conversacion donde
            tambien se negocia la plata. Es la misma decision que `013` tomo con
            el precio, aplicada al dato que lo mueve.

            Diego dijo que en el futuro si lo va a usar. Por eso esta comentado
            y no borrado.

            PARA REPONERLO hay que descomentar TRES cosas, no una:

              1. este bloque, y devolverle a la grilla su `sm:grid-cols-2` —hoy
                 quedo en una sola columna porque quedaba un campo solo—;
              2. la linea de `validate()` que exige el horario, mas arriba en
                 este mismo archivo. **Es la que se olvida.**
              3. el valor fijo de `components/pedido/crear-pedido.tsx`, que hoy
                 manda `"16:00"` sin mirar el formulario.

            Ademas hay que decidir que hace la tarjeta de `Mis pedidos`, que
            dejo de mostrar la hora con este mismo feature (FR-006a).

            <Field label="Horario de retiro" htmlFor="pickupTime" error={errors.pickupTime}>
              <input
                id="pickupTime"
                type="time"
                className={inputClass}
                value={form.pickupTime}
                onChange={(e) => update("pickupTime", e.target.value)}
              />
            </Field>
          */}
        </div>
        {/*
          El plazo de entrega es un aviso, no un campo: la persona ya no elige
          cuándo se entrega (FR-009a). El texto es fijo y no se calcula desde el
          retiro — mostrar un momento concreto volvería a convertir una promesa
          en un horario pactado.
        */}
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
          {PLAZO_DE_ENTREGA}
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className="text-base font-semibold text-slate-900">
          ¿Quién recibe el paquete?
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          A nombre de quién va el paquete, y un teléfono para coordinar la
          entrega con esa persona.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label="Nombre de quien recibe"
            htmlFor="receiverName"
            error={errors.receiverName}
          >
            <input
              id="receiverName"
              className={inputClass}
              placeholder="Nombre y apellido"
              value={form.receiverName}
              onChange={(e) => update("receiverName", e.target.value)}
            />
          </Field>
          <Field
            label="Teléfono de quien recibe"
            htmlFor="receiverPhone"
            error={errors.receiverPhone}
          >
            <input
              id="receiverPhone"
              type="tel"
              className={inputClass}
              placeholder="09X XXX XXX"
              value={form.receiverPhone}
              onChange={(e) => update("receiverPhone", e.target.value)}
            />
          </Field>
        </div>
      </section>

      {errorDeEnvio && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {errorDeEnvio}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        aria-busy={enviando}
        className="rounded-full bg-accent px-6 py-3.5 text-center text-base font-semibold text-white shadow-lg shadow-orange-900/10 transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {/* FR-007a: la reanudacion no puede ser silenciosa. Que el boton diga
            que esta enviando es lo que evita el "¿se mando o no?" despues de
            cerrarse el dialogo de ingreso. */}
        {enviando ? "Enviando…" : "Confirmar pedido"}
      </button>
    </form>
  );
}

function Confirmation({
  form,
  codigo,
  onReset,
}: {
  form: FormState;
  codigo: string;
  onReset: () => void;
}) {
  const direccionRetiro = componerDireccion(form.retiro.direccion);
  const direccionEntrega = componerDireccion(form.entrega.direccion);


  // **La ENTREGA, no el retiro.** Hasta `013` esta linea leia
  // `form.retiro.direccion.punto`, que quedo mal desde `011`: aquel feature
  // movio la zona al punto de entrega y esta pantalla se le paso. Venia
  // mostrando la zona equivocada —la del retiro— y, desde que el punto de
  // retiro dejo de ser obligatorio, a veces ninguna.
  //
  // Se arregla acá porque `013` toca esta misma fila para sacarle el monto, y
  // dejar una fila corregida a medias —sin plata pero con la zona equivocada—
  // seria peor que no tocarla.
  const punto = form.entrega.direccion.punto ?? null;

  // Se recalcula desde el punto en vez de arrastrarse en el estado: el punto es
  // la unica fuente de verdad de la zona.
  const zona = punto ? resolverZona(punto.lat, punto.lng) : null;

  return (
    <div className={`${sectionClass} flex flex-col items-start gap-6`}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Pedido registrado
          </h2>
          {/* FR-029. Hasta `007` esto decia "¡Pedido cargado! Nos pondremos en
              contacto para confirmar el retiro" — y **no se guardaba nada, no
              se le avisaba a nadie, y nadie se iba a poner en contacto**. Era
              una promesa que el producto le hacia a una persona real y no podia
              cumplir.

              Ahora el pedido existe de verdad y tiene codigo. Lo que sigue sin
              existir es el aviso a Diego: vive en la app Android, que todavia no
              se construyo. Por eso el texto dice por donde se coordina DE VERDAD
              mientras tanto, en vez de prometer un contacto que nadie va a
              hacer. Cambiarlo por otra frase optimista seria cambiar una promesa
              falsa por otra.

              2026-08-14: hasta hoy esto ademas enlazaba a /contacto —"y
              escribinos por WhatsApp con ese codigo para coordinar el retiro"—.
              Lo saco el dueño del proyecto al verlo andando: la coordinacion la
              arranca Diego desde la app, que va a tener el contacto del cliente,
              y empujar al cliente a WhatsApp es reponer justo el canal manual
              que este producto existe para reemplazar. FR-029 quedo enmendado
              con el motivo.

              Lo que queda dicho y no se puede perder: mientras la app no exista,
              nada le avisa a Diego de un pedido. La frase de abajo es CIERTA
              —el pedido quedo registrado y ese es su codigo— y por eso puede
              quedarse sola; lo que falta no es texto, es el aviso. Esta como
              fila en el tracker y bloquea promocionar el sitio. */}
          <p className="text-sm text-slate-600">
            Anotá tu código{" "}
            <strong className="font-semibold text-slate-900">{codigo}</strong>.
          </p>
        </div>
      </div>

      <dl className="grid w-full gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <SummaryRow label="Cliente" value={form.name} />
        <SummaryRow label="Teléfono" value={form.phone} />
        <SummaryRow label="Dirección de retiro" value={direccionRetiro} />
        <SummaryRow label="Dirección de entrega" value={direccionEntrega} />
        {zona && <SummaryRow label="Zona de entrega" value={zona.nombre} />}
        {/* `014`: se fue el tamaño y **queda la cantidad**, que la persona si
            eligio. Lo mismo abajo con la fecha, de la que se fue la hora. */}
        <SummaryRow
          label="Paquete"
          value={`${form.quantity} ${form.quantity === "1" ? "paquete" : "paquetes"}`}
        />
        <SummaryRow label="Retiro" value={form.pickupDate} />
        {/* Texto fijo, igual en todo pedido: no se deriva del retiro (FR-009a). */}
        <SummaryRow label="Entrega" value={PLAZO_DE_ENTREGA} />
        <SummaryRow
          label="Recibe el paquete"
          value={`${form.receiverName} · ${form.receiverPhone}`}
        />
      </dl>

      {/* FR-001: el motivo entero del feature. Hasta aca el pedido existia con
          un codigo en pantalla y el paquete no llevaba nada encima; Diego
          llegaba a una puerta, recibia un bulto y tenia que preguntar de que
          pedido era.

          La etiqueta se arma AL TOCAR, no aca: `etiquetaDelFormulario` resuelve
          una zona, y no hay por que hacerlo en cada render de esta pantalla. */}
      <BotonImprimir
        etiqueta={() =>
          etiquetaDelFormulario({
            codigo,
            nombre: form.name,
            telefono: form.phone,
            retiro: form.retiro.direccion,
            entrega: form.entrega.direccion,
            destinatarioNombre: form.receiverName,
            destinatarioTelefono: form.receiverPhone,
            fechaRetiro: form.pickupDate,
            cantidad: form.quantity,
          })
        }
      />

      <button
        type="button"
        onClick={onReset}
        className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
      >
        Cargar otro pedido
      </button>
    </div>
  );
}

// Se enlaza a /contacto en vez de repetir el numero de WhatsApp: el numero vive
// en app/contacto/page.tsx y duplicarlo obligaria a acordarse de los dos lugares
// el dia que cambie.
function BotonContacto() {
  return (
    <Link
      href="/contacto"
      className="mt-3 inline-block rounded-full bg-amber-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-800"
    >
      Escribinos
    </Link>
  );
}

/**
 * Dice si el punto entra en la cobertura, y en cual de las cinco zonas cayo.
 *
 * **Hasta `013` este bloque mostraba un monto**, y ese monto hacia dos trabajos
 * a la vez: decia cuanto salia, y —solo por aparecer— confirmaba que la
 * direccion estaba dentro del area. El primero se fue; el segundo hay que
 * seguir haciendolo, porque si no el formulario habla nada mas que para decir
 * que no (FR-003a).
 *
 * Nunca inventa una zona: fuera de las cinco no hay pedido, y no se ofrece "la
 * zona mas cercana". El mapa le promete a la persona donde se trabaja, y tomar
 * un pedido de afuera convierte esa promesa en mentira (FR-013, FR-014).
 */
function ResultadoZona({
  estadoMosaicos,
  punto,
  zona,
}: {
  estadoMosaicos: EstadoMosaicos;
  punto: Punto | null;
  zona: ReturnType<typeof resolverZona>;
}) {
  if (estadoMosaicos === "no-disponible") {
    return (
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-900">
          No pudimos cargar el mapa
        </p>
        <p className="mt-1 text-sm text-amber-800">
          Sin el mapa no podemos confirmar que llegamos hasta esa dirección, así
          que no podemos tomar el pedido por acá. Escribinos y lo coordinamos.
        </p>
        <BotonContacto />
      </div>
    );
  }

  if (!punto) {
    return (
      <p className="mt-4 text-sm text-slate-500">
        Todavía no ubicamos la dirección de entrega.
      </p>
    );
  }

  if (!zona) {
    return (
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-900">
          Ese punto queda fuera de nuestra zona de cobertura
        </p>
        <p className="mt-1 text-sm text-amber-800">
          Todavía no llegamos hasta ahí. Escribinos y vemos cómo darte una mano.
        </p>
        <BotonContacto />
      </div>
    );
  }

  return (
    <div
      role="status"
      className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"
    >
      <span
        aria-hidden="true"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: zona.color }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <div>
        <p className="text-sm font-semibold text-emerald-900">
          Llegamos hasta acá
        </p>
        <p className="text-xs text-emerald-800">
          La entrega queda en {zona.nombre}.
        </p>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-slate-800">{value}</dd>
    </div>
  );
}
