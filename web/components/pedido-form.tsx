"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { MapaZonasDinamico } from "./mapa-zonas-dinamico";
import type { EstadoMosaicos, Punto } from "./mapa-zonas";
import { resolverZona } from "@/lib/zona-lookup";

type ClientType = "particular" | "empresa";
type PackageMode = "predefinido" | "libre";
type PackageSize = "chico" | "mediano" | "grande";
type PaymentMethod = "efectivo" | "transferencia";

type FormState = {
  clientType: ClientType;
  name: string;
  phone: string;
  calle: string;
  numero: string;
  apto: string;
  esquina: string;
  cooperativa: boolean;
  // Donde hay que retirar el paquete. La zona y el precio NO se guardan acá: se
  // derivan de este punto con resolverZona() en cada render, para que no puedan
  // quedar desincronizados de la ubicacion. Son plata.
  ubicacionRetiro: Punto | null;
  // Domicilio de entrega. No se marca en el mapa, no resuelve zona y no afecta
  // al precio: el precio depende solo del retiro (FR-024).
  entregaCalle: string;
  entregaNumero: string;
  entregaApto: string;
  entregaEsquina: string;
  entregaCooperativa: boolean;
  packageMode: PackageMode;
  packageSize: PackageSize | "";
  packageDescription: string;
  paymentMethod: PaymentMethod | "";
  deliveryDate: string;
  deliveryTime: string;
  pickupDate: string;
  pickupTime: string;
  recieverName: string;
  recieverCI: string;
  quantity: string;
};

const INITIAL_STATE: FormState = {
  clientType: "particular",
  name: "",
  phone: "",
  calle: "",
  numero: "",
  apto: "",
  esquina: "",
  cooperativa: false,
  ubicacionRetiro: null,
  entregaCalle: "",
  entregaNumero: "",
  entregaApto: "",
  entregaEsquina: "",
  entregaCooperativa: false,
  packageMode: "predefinido",
  packageSize: "",
  packageDescription: "",
  paymentMethod: "",
  deliveryDate: "",
  deliveryTime: "",
  pickupDate: "",
  pickupTime: "",
  recieverName: "",
  recieverCI: "",
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
 * Que claves de FormState usa cada bloque de direccion. Los dos domicilios
 * tienen los mismos campos (FR-023), asi que se renderizan con el mismo
 * componente y lo unico que cambia es a donde escribe.
 */
type CamposDireccionMap = {
  calle: "calle" | "entregaCalle";
  numero: "numero" | "entregaNumero";
  apto: "apto" | "entregaApto";
  esquina: "esquina" | "entregaEsquina";
  cooperativa: "cooperativa" | "entregaCooperativa";
};

const CAMPOS_RETIRO: CamposDireccionMap = {
  calle: "calle",
  numero: "numero",
  apto: "apto",
  esquina: "esquina",
  cooperativa: "cooperativa",
};

const CAMPOS_ENTREGA: CamposDireccionMap = {
  calle: "entregaCalle",
  numero: "entregaNumero",
  apto: "entregaApto",
  esquina: "entregaEsquina",
  cooperativa: "entregaCooperativa",
};

function CamposDireccion({
  id,
  form,
  errors,
  update,
  campos,
}: {
  /** Prefijo de los `id`/`htmlFor`, para que los dos bloques no colisionen. */
  id: string;
  form: FormState;
  errors: Record<string, string>;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  campos: CamposDireccionMap;
}) {
  const texto = (
    label: string,
    campo: "calle" | "numero" | "apto" | "esquina",
    optional?: boolean,
  ) => {
    const clave = campos[campo];
    return (
      <Field
        label={label}
        htmlFor={`${id}-${campo}`}
        error={errors[clave]}
        optional={optional}
      >
        <input
          id={`${id}-${campo}`}
          className={inputClass}
          value={form[clave] as string}
          onChange={(e) => update(clave, e.target.value)}
        />
      </Field>
    );
  };

  const cooperativa = form[campos.cooperativa] as boolean;

  return (
    <div className="mt-3 grid gap-4 sm:grid-cols-2">
      {texto("Calle", "calle")}
      {texto("Número de puerta", "numero")}
      {texto("Apto", "apto", true)}
      {texto("Esquina", "esquina")}
      <div>
        <span className={labelClass}>¿Es una cooperativa?</span>
        <div className="flex gap-3">
          {([true, false] as const).map((valor) => (
            <button
              key={String(valor)}
              type="button"
              aria-pressed={cooperativa === valor}
              onClick={() => update(campos.cooperativa, valor)}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                cooperativa === valor
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {valor ? "Sí" : "No"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function validate(
  form: FormState,
  estadoMosaicos: EstadoMosaicos,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!form.name.trim()) errors.name = "Ingresá un nombre.";

  const phoneDigits = form.phone.replace(/[^0-9]/g, "");
  if (!form.phone.trim()) {
    errors.phone = "Ingresá un teléfono.";
  } else if (phoneDigits.length < 8) {
    errors.phone = "Ingresá un teléfono válido (mínimo 8 dígitos).";
  }

  if (!form.calle.trim()) errors.calle = "Ingresá la calle.";
  if (!form.numero.trim()) errors.numero = "Ingresá el número de puerta.";
  if (!form.esquina.trim()) errors.esquina = "Ingresá la esquina.";

  // La ubicacion es obligatoria: de ella sale el precio, y el precio es en firme.
  // Sin punto no hay pedido, y con el mapa caido tampoco — marcar sin calles de
  // fondo no es base confiable para cobrar.
  if (estadoMosaicos === "no-disponible") {
    errors.ubicacionRetiro =
      "No podemos cargar el mapa en este momento, así que no podemos calcular el precio. Escribinos y lo resolvemos.";
  } else if (!form.ubicacionRetiro) {
    errors.ubicacionRetiro = "Marcá en el mapa desde dónde retiramos el paquete.";
  } else if (
    !resolverZona(form.ubicacionRetiro.lat, form.ubicacionRetiro.lng)
  ) {
    errors.ubicacionRetiro =
      "Ese punto queda fuera de nuestra zona de cobertura. Escribinos y vemos cómo ayudarte.";
  }

  // El destino se valida solo por completitud. NO se comprueba contra las zonas
  // de cobertura: se cobra por retiro, asi que una entrega fuera de las cinco
  // zonas es un pedido valido (FR-024).
  if (!form.entregaCalle.trim()) errors.entregaCalle = "Ingresá la calle.";
  if (!form.entregaNumero.trim())
    errors.entregaNumero = "Ingresá el número de puerta.";
  if (!form.entregaEsquina.trim()) errors.entregaEsquina = "Ingresá la esquina.";

  if (form.packageMode === "predefinido" && !form.packageSize) {
    errors.packageSize = "Elegí un tamaño de paquete.";
  }
  if (form.packageMode === "libre" && !form.packageDescription.trim()) {
    errors.packageDescription = "Contanos qué es el paquete.";
  }

  if (!form.paymentMethod) errors.paymentMethod = "Elegí una forma de pago.";

  if (!form.deliveryDate) errors.deliveryDate = "Elegí una fecha de entrega.";
  if (!form.deliveryTime) errors.deliveryTime = "Elegí un horario de entrega.";
  if (!form.pickupDate) errors.pickupDate = "Elegí una fecha de retiro.";
  if (!form.pickupTime) errors.pickupTime = "Elegí un horario de retiro.";

  if (!form.recieverName.trim())
    errors.recieverName = "Ingresá el nombre de quien recibe.";
  if (!form.recieverCI.trim())
    errors.recieverCI = "Ingresá la cédula de quien recibe.";

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
  // Solo se setea cuando la posicion llega del GPS, para que el mapa no salte
  // cada vez que el usuario toca en otro lado.
  const [centrarEn, setCentrarEn] = useState<Punto | null>(null);
  const [geoEstado, setGeoEstado] = useState<
    "inactivo" | "buscando" | "rechazado" | "error"
  >("inactivo");

  function usarMiUbicacion() {
    if (!navigator.geolocation) {
      setGeoEstado("error");
      return;
    }
    setGeoEstado("buscando");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        update("ubicacionRetiro", p);
        setCentrarEn(p);
        setGeoEstado("inactivo");
      },
      (err) => {
        // Se distingue el rechazo del permiso de la falla tecnica: el mensaje
        // util es distinto. En los dos casos el marcado manual sigue disponible,
        // asi que nada se rompe (US3, escenario 2).
        setGeoEstado(err.code === err.PERMISSION_DENIED ? "rechazado" : "error");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function quitarUbicacion() {
    update("ubicacionRetiro", null);
    setCentrarEn(null);
    setGeoEstado("inactivo");
  }

  // Derivada, no guardada. Ver el comentario en FormState.
  const zona = form.ubicacionRetiro
    ? resolverZona(form.ubicacionRetiro.lat, form.ubicacionRetiro.lng)
    : null;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
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
          <div className="flex gap-3">
            {(["particular", "empresa"] as ClientType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => update("clientType", type)}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
                  form.clientType === type
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {type}
              </button>
            ))}
          </div>

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
          Marcá el punto en el mapa: de ahí sale la zona y el precio del envío.
        </p>

        {estadoMosaicos !== "no-disponible" && (
          <div className="mt-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={usarMiUbicacion}
                disabled={geoEstado === "buscando"}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
              >
                {geoEstado === "buscando"
                  ? "Buscando tu ubicación…"
                  : form.ubicacionRetiro
                    ? "Volver a mi ubicación"
                    : "Usar mi ubicación"}
              </button>
              {form.ubicacionRetiro && (
                <button
                  type="button"
                  onClick={quitarUbicacion}
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50"
                >
                  Quitar ubicación
                </button>
              )}
            </div>
            {geoEstado === "rechazado" && (
              <p className="mt-2 text-xs text-slate-500">
                No nos diste permiso para acceder a tu ubicación. No hay
                problema: marcá el punto en el mapa a mano.
              </p>
            )}
            {geoEstado === "error" && (
              <p className="mt-2 text-xs text-slate-500">
                No pudimos obtener tu ubicación. Marcá el punto en el mapa a
                mano.
              </p>
            )}
          </div>
        )}

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <MapaZonasDinamico
            interactivo
            punto={form.ubicacionRetiro}
            onPunto={(p) => update("ubicacionRetiro", p)}
            centrarEn={centrarEn}
            onEstadoMosaicos={setEstadoMosaicos}
            className="h-[340px] w-full sm:h-[420px]"
          />
        </div>

        <ResultadoZona
          estadoMosaicos={estadoMosaicos}
          punto={form.ubicacionRetiro}
          zona={zona}
        />
        {errors.ubicacionRetiro && (
          <p className={errorClass}>{errors.ubicacionRetiro}</p>
        )}

        <h3 className="mt-6 text-sm font-semibold text-slate-900">
          Dirección de retiro
        </h3>
        <CamposDireccion
          id="retiro"
          form={form}
          errors={errors}
          update={update}
          campos={CAMPOS_RETIRO}
        />
      </section>

      <section className={sectionClass}>
        <h2 className="text-base font-semibold text-slate-900">
          ¿A dónde lo llevamos?
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          El domicilio de entrega. No cambia el precio: el envío se cobra según
          la zona desde la que retiramos.
        </p>
        <CamposDireccion
          id="entrega"
          form={form}
          errors={errors}
          update={update}
          campos={CAMPOS_ENTREGA}
        />
      </section>

      <section className={sectionClass}>
        <h2 className="text-base font-semibold text-slate-900">
          ¿Qué envías?
        </h2>
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => update("packageMode", "predefinido")}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                form.packageMode === "predefinido"
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Tamaño predefinido
            </button>
            <button
              type="button"
              onClick={() => update("packageMode", "libre")}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                form.packageMode === "libre"
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Describir el paquete
            </button>
          </div>

          {form.packageMode === "predefinido" ? (
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
          ) : (
            <Field
              label="Descripción del paquete"
              htmlFor="packageDescription"
              error={errors.packageDescription}
            >
              <textarea
                id="packageDescription"
                rows={3}
                className={inputClass}
                placeholder="Contanos qué es y cómo viene embalado"
                value={form.packageDescription}
                onChange={(e) => update("packageDescription", e.target.value)}
              />
            </Field>
          )}

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
          Fechas y forma de pago
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Fecha de retiro" htmlFor="pickupDate" error={errors.pickupDate}>
            <input
              id="pickupDate"
              type="date"
              className={inputClass}
              value={form.pickupDate}
              onChange={(e) => update("pickupDate", e.target.value)}
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
          <Field label="Fecha de entrega" htmlFor="deliveryDate" error={errors.deliveryDate}>
            <input
              id="deliveryDate"
              type="date"
              className={inputClass}
              value={form.deliveryDate}
              onChange={(e) => update("deliveryDate", e.target.value)}
            />
          </Field>
          <Field label="Horario de entrega" htmlFor="deliveryTime" error={errors.deliveryTime}>
            <input
              id="deliveryTime"
              type="time"
              className={inputClass}
              value={form.deliveryTime}
              onChange={(e) => update("deliveryTime", e.target.value)}
            />
          </Field>
          <Field
            label="Forma de pago"
            htmlFor="paymentMethod"
            error={errors.paymentMethod}
          >
            <select
              id="paymentMethod"
              className={inputClass}
              value={form.paymentMethod}
              onChange={(e) =>
                update("paymentMethod", e.target.value as PaymentMethod)
              }
            >
              <option value="">Seleccioná una opción</option>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </Field>
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className="text-base font-semibold text-slate-900">
          ¿Quién recibe el paquete?
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label="Nombre de quien recibe"
            htmlFor="receiverName"
            error={errors.receiverName}
          >
            <input
              id="receiverName"
              className={inputClass}
              value={form.recieverName}
              onChange={(e) => update("recieverName", e.target.value)}
            />
          </Field>
          <Field label="Cédula (CI)" htmlFor="receiverCI" error={errors.recieverCI}>
            <input
              id="receiverCI"
              className={inputClass}
              value={form.recieverCI}
              onChange={(e) => update("recieverCI", e.target.value)}
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
  const componerDireccion = (
    calle: string,
    numero: string,
    apto: string,
    esquina: string,
    cooperativa: boolean,
  ) =>
    [
      `${calle} ${numero}`,
      apto && `apto ${apto}`,
      esquina && `esq. ${esquina}`,
      cooperativa && "cooperativa",
    ]
      .filter(Boolean)
      .join(", ");

  const direccionRetiro = componerDireccion(
    form.calle,
    form.numero,
    form.apto,
    form.esquina,
    form.cooperativa,
  );
  const direccionEntrega = componerDireccion(
    form.entregaCalle,
    form.entregaNumero,
    form.entregaApto,
    form.entregaEsquina,
    form.entregaCooperativa,
  );

  const paquete =
    form.packageMode === "predefinido"
      ? `Tamaño ${form.packageSize}`
      : form.packageDescription;

  // Se recalcula desde el punto en vez de arrastrarse en el estado: el punto es
  // la unica fuente de verdad del precio.
  const zona = form.ubicacionRetiro
    ? resolverZona(form.ubicacionRetiro.lat, form.ubicacionRetiro.lng)
    : null;

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
        <SummaryRow label="Cliente" value={`${form.name} (${form.clientType})`} />
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
        <SummaryRow
          label="Entrega"
          value={`${form.deliveryDate} ${form.deliveryTime}`}
        />
        <SummaryRow
          label="Forma de pago"
          value={form.paymentMethod === "efectivo" ? "Efectivo" : "Transferencia"}
        />
        <SummaryRow
          label="Recibe el paquete"
          value={`${form.recieverName} (CI ${form.recieverCI})`}
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
