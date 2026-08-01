import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contacto — Flash Urbano",
};

// TODO: reemplazar por el número de WhatsApp y el email reales de la empresa.
const WHATSAPP_NUMBER = "59899000000";
const EMAIL = "contacto@flashurbano.uy";

export default function ContactoPage() {
  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    "Hola! Quiero coordinar un envío con Flash Urbano."
  )}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        Contacto
      </h1>
      <p className="mt-2 max-w-xl text-sm text-slate-600 sm:text-base">
        ¿Tenés una duda que el formulario de pedido no resuelve? Escribinos
        directamente.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors hover:border-green-300 hover:bg-green-50"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="currentColor"
            >
              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39a9.9 9.9 0 0 0 4.75 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.07c-.24.68-1.4 1.3-1.93 1.35-.5.05-.98.24-3.3-.7-2.78-1.13-4.53-3.98-4.67-4.16-.14-.19-1.11-1.48-1.11-2.83 0-1.34.7-2 .95-2.28.24-.27.53-.34.71-.34.18 0 .35 0 .5.01.16.01.38-.06.6.46.24.57.8 1.96.87 2.1.07.15.11.32.02.51-.09.19-.14.31-.28.48-.14.16-.29.36-.42.48-.14.14-.28.29-.12.57.16.28.72 1.19 1.55 1.93 1.06.95 1.96 1.24 2.24 1.38.28.14.44.12.6-.07.16-.19.7-.82.89-1.1.19-.28.37-.23.62-.14.26.09 1.62.77 1.9.91.28.14.46.21.53.33.07.12.07.68-.17 1.36Z" />
            </svg>
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">WhatsApp</h2>
            <p className="mt-1 text-sm text-slate-600">
              La forma más rápida de coordinar tu envío.
            </p>
          </div>
        </a>

        <a
          href={`mailto:${EMAIL}`}
          className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors hover:border-brand/40 hover:bg-brand/5"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2Z"
              />
            </svg>
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Email</h2>
            <p className="mt-1 break-all text-sm text-slate-600">{EMAIL}</p>
          </div>
        </a>
      </div>
    </div>
  );
}
