"use client";

import { FormEvent, useState } from "react";

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

function validate(form: FormState): Record<string, string> {
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

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const nextErrors = validate(form);
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
        <h2 className="text-base font-semibold text-slate-900">Dirección</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Calle" htmlFor="calle" error={errors.calle}>
            <input
              id="calle"
              className={inputClass}
              value={form.calle}
              onChange={(e) => update("calle", e.target.value)}
            />
          </Field>
          <Field label="Número de puerta" htmlFor="numero" error={errors.numero}>
            <input
              id="numero"
              className={inputClass}
              value={form.numero}
              onChange={(e) => update("numero", e.target.value)}
            />
          </Field>
          <Field label="Apto" htmlFor="apto" optional>
            <input
              id="apto"
              className={inputClass}
              value={form.apto}
              onChange={(e) => update("apto", e.target.value)}
            />
          </Field>
          <Field label="Esquina" htmlFor="esquina" error={errors.esquina}>
            <input
              id="esquina"
              className={inputClass}
              value={form.esquina}
              onChange={(e) => update("esquina", e.target.value)}
            />
          </Field>
          <div>
            <span className={labelClass}>¿Es una cooperativa?</span>
            <div className="flex gap-3">
              <button
                type="button"
                aria-pressed={form.cooperativa}
                onClick={() => update("cooperativa", true)}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  form.cooperativa
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Sí
              </button>
              <button
                type="button"
                aria-pressed={!form.cooperativa}
                onClick={() => update("cooperativa", false)}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  !form.cooperativa
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                No
              </button>
            </div>
          </div>
        </div>
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
  const direccion = [
    `${form.calle} ${form.numero}`,
    form.apto && `apto ${form.apto}`,
    form.esquina && `esq. ${form.esquina}`,
    form.cooperativa && "cooperativa",
  ]
    .filter(Boolean)
    .join(", ");

  const paquete =
    form.packageMode === "predefinido"
      ? `Tamaño ${form.packageSize}`
      : form.packageDescription;

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
        <SummaryRow label="Dirección" value={direccion} />
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
