import type { Metadata } from "next";
import Image from "next/image";
import { asset } from "@/lib/asset";

export const metadata: Metadata = {
  title: "Sobre nosotros — Flash Urbano",
};

const HORARIOS = [
  { dia: "Lunes a viernes", horario: "9:00 – 19:00" },
  { dia: "Sábados", horario: "9:00 – 13:00" },
  { dia: "Domingos", horario: "Cerrado" },
];

export default function SobreNosotrosPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        Sobre nosotros
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
        Flash Urbano es un servicio de paquetería y logística de retiro y
        entrega dentro de la ciudad — sin local físico, solo retiro y envío.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Días y horarios de trabajo
          </h2>
          <ul className="mt-4 flex flex-col gap-2 text-sm text-slate-600">
            {HORARIOS.map((h) => (
              <li key={h.dia} className="flex justify-between border-b border-slate-100 pb-2">
                <span>{h.dia}</span>
                <span className="font-medium text-slate-900">{h.horario}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Paquetes entregados
          </h2>
          <p className="mt-4 text-4xl font-bold text-brand">1.200+</p>
          <p className="mt-1 text-sm text-slate-600">
            entregas realizadas hasta el momento.
          </p>
          <p className="mt-3 text-xs text-slate-400">
            Cifra ilustrativa — se actualizará con datos reales.
          </p>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          Zona de entregas
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Cobertura por zonas dentro de Montevideo. El precio de referencia
          varía según la zona de retiro/entrega — el valor final se
          confirma según la dirección exacta.
        </p>
        <div className="relative mt-4 aspect-video w-full overflow-hidden rounded-xl border border-slate-200">
          <Image
            src={asset("/mapa-zonas-flash-urbano.jpeg")}
            alt="Mapa de Montevideo con las cinco zonas de entrega de Flash Urbano pintadas y su precio de referencia: Zona 1 $150, Zona 2 $200, Zona 3 $250, Zona 4 $250 y Zona 5 $350"
            fill
            className="object-cover"
            sizes="(min-width: 1024px) 896px, 100vw"
          />
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Los límites son de referencia. Escribinos si tu dirección queda
          sobre el borde entre dos zonas.
        </p>
      </section>
    </div>
  );
}
