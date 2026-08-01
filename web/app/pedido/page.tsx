import type { Metadata } from "next";
import { PedidoForm } from "@/components/pedido-form";

export const metadata: Metadata = {
  title: "Crear pedido — Flash Urbano",
};

export default function PedidoPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Crear pedido
        </h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          Completá los datos de tu envío. Podés cargarlo como invitado, sin
          necesidad de crear una cuenta.
        </p>
      </div>
      <PedidoForm />
    </div>
  );
}
