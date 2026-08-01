import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import { asset } from "@/lib/asset";

const STEPS = [
  {
    title: "Cargá tu pedido",
    text: "Completá dirección, tipo de paquete y horarios en un formulario simple.",
  },
  {
    title: "Coordinamos el retiro",
    text: "Pasamos a buscar tu paquete en la fecha y horario que elegiste.",
  },
  {
    title: "Entregamos",
    text: "Tu paquete llega a destino dentro de la zona de cobertura.",
  },
];

function Arrow() {
  return (
    <li
      aria-hidden="true"
      className="flex items-center justify-center text-white/40"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="h-5 w-5 rotate-90 sm:rotate-0"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 12h14m0 0l-6-6m6 6l-6 6"
        />
      </svg>
    </li>
  );
}

export default function Home() {
  return (
    <section className="flex flex-1 flex-col justify-center bg-gradient-to-b from-brand-dark to-brand text-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
          <Image
            src={asset("/logo-flash-urbano.png")}
            alt="Flash Urbano — Logística y transporte"
            width={600}
            height={245}
            className="w-44 shrink-0 sm:w-60"
            priority
          />

          <div
            aria-hidden="true"
            className="h-px w-full bg-white/20 sm:h-auto sm:w-px sm:self-stretch"
          />

          <div>
            <h1 className="max-w-xl text-2xl font-bold leading-tight tracking-tight sm:text-4xl">
              Enviá y retirá paquetes de forma rápida, simple y segura
            </h1>

            <p className="mt-3 max-w-xl text-sm text-blue-100 sm:text-base">
              Cargá los datos de tu envío una sola vez y nosotros nos ocupamos
              del resto: retiro, ruta y entrega dentro de la ciudad.
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/pedido"
                className="rounded-full bg-accent px-6 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-orange-900/20 transition-colors hover:bg-orange-600"
              >
                Crear un pedido
              </Link>
              <Link
                href="/sobre-nosotros"
                className="rounded-full border border-white/30 px-6 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Ver zonas y precios
              </Link>
            </div>
          </div>
        </div>

        <ol className="mt-8 flex flex-col gap-2 border-t border-white/15 pt-6 sm:flex-row sm:items-stretch sm:gap-3">
          {STEPS.map((step, i) => (
            <Fragment key={step.title}>
              {i > 0 && <Arrow />}
              <li className="flex-1 rounded-xl bg-white p-4 shadow-lg shadow-blue-950/20">
                <h2 className="text-sm font-semibold text-slate-900">
                  {step.title}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {step.text}
                </p>
              </li>
            </Fragment>
          ))}
        </ol>
      </div>
    </section>
  );
}
