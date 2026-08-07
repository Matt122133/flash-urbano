"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
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
import type { Zona } from "@/lib/zonas";

type PackageSize = "chico" | "mediano" | "grande";

type FormState = {
  name: string;
  phone: string;
  // Donde hay que retirar el paquete. La direccion y el punto son lo mismo desde
  // 003: el punto sale del cruce de calles, no de tocar el mapa.
  //
  // La zona y el precio NO se guardan acá: se derivan del punto con
  // resolverZona() en cada render, para que no puedan quedar desincronizados de
  // la ubicacion. Son plata.
  retiro: EstadoDireccion;
  // Domicilio de entrega. Tiene autocompletado igual que el retiro, pero no
  // resuelve punto ni afecta al precio: el precio depende solo del retiro
  // (FR-020). Y el autocompletado no bloquea (FR-007b).
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

  const retiro = form.retiro;
  if (!retiro.direccion.calle.trim()) errors.calle = "Elegí la calle.";
  else if (!retiro.direccion.esquina.trim()) errors.esquina = "Elegí la esquina.";
  else if (retiro.candidatos.length > 1) {
    errors.esquina = "Hay más de un cruce con ese nombre: elegí cuál es el tuyo.";
  } else if (!retiro.esquina) {
    errors.esquina = "No encontramos ese cruce. Revisá los nombres.";
  }
  if (retiro.esquina && !retiro.direccion.numero.trim()) {
    errors.numero = "Ingresá el número de puerta.";
  }

  // La ubicacion es obligatoria: de ella sale el precio, y el precio es en firme.
  // Sin punto no hay pedido, y con el mapa caido tampoco — no se cobra sobre un
  // mapa que la persona no pudo ver.
  const punto = retiro.direccion.punto;
  if (estadoMosaicos === "no-disponible") {
    errors.ubicacionRetiro =
      "No podemos cargar el mapa en este momento, así que no podemos calcular el precio. Escribinos y lo resolvemos.";
  } else if (retiro.esquina && !punto) {
    errors.ubicacionRetiro = "Todavía no pudimos ubicar esa dirección.";
  } else if (punto && !resolverZona(punto.lat, punto.lng)) {
    errors.ubicacionRetiro =
      "Ese punto queda fuera de nuestra zona de cobertura. Escribinos y vemos cómo ayudarte.";
  } else if (
    punto &&
    retiro.esquina &&
    !contiene(regionPermitida(retiro.esquina, retiro.cualEsLaCalle), punto)
  ) {
    // Guarda barata, no el control principal: el arrastre ya se clampea al
    // soltar (FR-018). Si esto salta, algo movio el punto por otra via.
    errors.ubicacionRetiro =
      "El punto quedó fuera de la cuadra que indicaste. Movelo de nuevo.";
  }

  // El destino se valida solo por completitud, y contra el texto: NO se exige
  // que la calle exista en el indice. El indice cubre el area de servicio y una
  // entrega fuera de ella es un pedido valido (FR-007b), asi que exigirlo
  // rechazaria entregas reales. Tampoco se comprueba contra las zonas: se cobra
  // por retiro (FR-020).
  const entrega = form.entrega.direccion;
  if (!entrega.calle.trim()) errors.entregaCalle = "Ingresá la calle.";
  if (!entrega.numero.trim())
    errors.entregaNumero = "Ingresá el número de puerta.";
  if (!entrega.esquina.trim()) errors.entregaEsquina = "Ingresá la esquina.";

  if (!form.packageSize) errors.packageSize = "Elegí un tamaño de paquete.";

  if (!form.pickupDate) errors.pickupDate = "Elegí una fecha de retiro.";
  if (!form.pickupTime) errors.pickupTime = "Elegí un horario de retiro.";

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

export function PedidoForm() {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<FormState | null>(null);
  const [estadoMosaicos, setEstadoMosaicos] =
    useState<EstadoMosaicos>("cargando");
  // Se recentra cuando el cruce se resuelve, no en cada cambio del punto: el
  // mapa no debe saltar mientras la persona arrastra el pin.
  const [centrarEn, setCentrarEn] = useState<Punto | null>(null);
  const [salioDeLaCuadra, setSalioDeLaCuadra] = useState(false);

  const punto = form.retiro.direccion.punto ?? null;

  // Derivada, no guardada. Ver el comentario en FormState.
  const zona = punto ? resolverZona(punto.lat, punto.lng) : null;

  const region = form.retiro.esquina
    ? regionPermitida(form.retiro.esquina, form.retiro.cualEsLaCalle)
    : null;

  // Mover el pin puede cruzar de zona y cambiar el precio. Eso se muestra, pero
  // no se frena: la persona reacomoda el pin varias veces hasta encontrar su
  // puerta, y un dialogo de confirmacion en cada cruce de zona pelea con el
  // Principio IV (FR-017). El punto de confirmacion es el resumen previo al
  // envio (FR-017a).
  const zonaPrevia = useRef<Zona | null>(null);
  const [cambioDeZona, setCambioDeZona] = useState<{
    antes: Zona;
    ahora: Zona;
  } | null>(null);

  useEffect(() => {
    const anterior = zonaPrevia.current;
    if (anterior && zona && anterior.id !== zona.id) {
      setCambioDeZona({ antes: anterior, ahora: zona });
    }
    zonaPrevia.current = zona;
  }, [zona]);

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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const nextErrors = validate(form, estadoMosaicos);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      setSubmitted(form);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  if (submitted) {
    return <Confirmation form={submitted} onReset={() => {
      setForm(INITIAL_STATE);
      setErrors({});
      setSubmitted(null);
    }} />;
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
          Escribí la calle y la esquina: con eso ubicamos el punto y de ahí sale
          la zona y el precio del envío.
        </p>

        <BloqueDireccion
          id="retiro"
          valor={form.retiro}
          errors={errors}
          onCambio={(estado) => {
            update("retiro", estado);
            setSalioDeLaCuadra(false);
            // Solo se recentra al resolverse un cruce nuevo, no al arrastrar.
            if (estado.esquina && estado.esquina !== form.retiro.esquina) {
              setCentrarEn(estado.esquina.punto);
            }
          }}
        />

        {/*
          El mapa va DEBAJO de los campos y no arriba (FR-010b): los campos son
          lo primero de la pantalla, y el mapa es la respuesta a lo que la
          persona escribio. Mientras no hay cruce resuelto se reserva el espacio
          en vez de dejar el mapa vacio (FR-010a): asi no salta el layout al
          aparecer, y nadie intenta tocar un mapa que ya no coloca el punto.
        */}
        <div className="mt-4">
          {form.retiro.esquina || form.retiro.candidatos.length > 1 ? (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <MapaZonasDinamico
                interactivo={Boolean(form.retiro.esquina)}
                punto={punto}
                onPunto={(p) =>
                  update("retiro", {
                    ...form.retiro,
                    direccion: { ...form.retiro.direccion, punto: p },
                  })
                }
                region={region}
                onFueraDeRegion={() => setSalioDeLaCuadra(true)}
                candidatos={
                  form.retiro.candidatos.length > 1
                    ? form.retiro.candidatos.map((c) => c.punto)
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
              el mapa y el precio.
            </div>
          )}
        </div>

        {form.retiro.esquina && (
          <p className="mt-2 text-xs text-slate-500">
            Podés arrastrar el punto dentro de la cuadra sombreada para dejarlo
            en tu puerta.
          </p>
        )}

        {salioDeLaCuadra && (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Lo trajimos de vuelta: el punto solo puede moverse dentro de las
            cuadras de {form.retiro.direccion.calle} que tocan la esquina que
            elegiste. Si tu puerta está más lejos, revisá la esquina.
          </p>
        )}

        {cambioDeZona && (
          <p
            role="status"
            className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-950"
          >
            Al mover el punto cambiaste de {cambioDeZona.antes.nombre} a{" "}
            {cambioDeZona.ahora.nombre}: el envío pasa de $&nbsp;
            {cambioDeZona.antes.precio} a $&nbsp;{cambioDeZona.ahora.precio}.
          </p>
        )}

        <ResultadoZona
          estadoMosaicos={estadoMosaicos}
          punto={punto}
          zona={zona}
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
          El lugar de entrega.
        </p>
        <BloqueDireccion
          id="entrega"
          modo="entrega"
          valor={form.entrega}
          onCambio={(estado) => update("entrega", estado)}
          errors={{
            calle: errors.entregaCalle,
            esquina: errors.entregaEsquina,
            numero: errors.entregaNumero,
          }}
        />
      </section>

      <section className={sectionClass}>
        <h2 className="text-base font-semibold text-slate-900">
          ¿Qué envías?
        </h2>
        <div className="mt-4 flex flex-col gap-4">
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
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
          <Field label="Horario de retiro" htmlFor="pickupTime" error={errors.pickupTime}>
            <input
              id="pickupTime"
              type="time"
              className={inputClass}
              value={form.pickupTime}
              onChange={(e) => update("pickupTime", e.target.value)}
            />
          </Field>
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

      <button
        type="submit"
        className="rounded-full bg-accent px-6 py-3.5 text-center text-base font-semibold text-white shadow-lg shadow-orange-900/10 transition-colors hover:bg-orange-600"
      >
        Confirmar pedido
      </button>
    </form>
  );
}

function Confirmation({
  form,
  onReset,
}: {
  form: FormState;
  onReset: () => void;
}) {
  const direccionRetiro = componerDireccion(form.retiro.direccion);
  const direccionEntrega = componerDireccion(form.entrega.direccion);

  const paquete = `Tamaño ${form.packageSize}`;

  const punto = form.retiro.direccion.punto ?? null;

  // Se recalcula desde el punto en vez de arrastrarse en el estado: el punto es
  // la unica fuente de verdad del precio.
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
            ¡Pedido cargado!
          </h2>
          <p className="text-sm text-slate-600">
            Nos pondremos en contacto para confirmar el retiro.
          </p>
        </div>
      </div>

      <dl className="grid w-full gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <SummaryRow label="Cliente" value={form.name} />
        <SummaryRow label="Teléfono" value={form.phone} />
        <SummaryRow label="Dirección de retiro" value={direccionRetiro} />
        <SummaryRow label="Dirección de entrega" value={direccionEntrega} />
        {zona && (
          <SummaryRow
            label="Zona y precio"
            value={`${zona.nombre} · $ ${zona.precio}`}
          />
        )}
        <SummaryRow label="Paquete" value={`${paquete} · x${form.quantity}`} />
        <SummaryRow
          label="Retiro"
          value={`${form.pickupDate} ${form.pickupTime}`}
        />
        {/* Texto fijo, igual en todo pedido: no se deriva del retiro (FR-009a). */}
        <SummaryRow label="Entrega" value={PLAZO_DE_ENTREGA} />
        <SummaryRow
          label="Recibe el paquete"
          value={`${form.receiverName} · ${form.receiverPhone}`}
        />
      </dl>

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
 * Muestra en que zona cayo el punto y cuanto sale el envio.
 *
 * Nunca inventa un precio: fuera de las cinco zonas no hay monto, y no se ofrece
 * "la zona mas cercana" — adivinar una zona es adivinar un precio, y el precio
 * es en firme (FR-012, FR-014).
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
          Sin el mapa no podemos calcular el precio del envío, así que no
          podemos tomar el pedido por acá. Escribinos y lo coordinamos.
        </p>
        <BotonContacto />
      </div>
    );
  }

  if (!punto) {
    return (
      <p className="mt-4 text-sm text-slate-500">
        Todavía no marcaste el punto de retiro.
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
    <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-3">
        <span
          className="h-3.5 w-3.5 shrink-0 rounded-full"
          style={{ backgroundColor: zona.color }}
        />
        <div>
          <p className="text-sm font-semibold text-slate-900">{zona.nombre}</p>
          <p className="text-xs text-slate-500">Precio del envío</p>
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900">$ {zona.precio}</p>
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
