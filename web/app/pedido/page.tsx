import type { Metadata } from "next";
// Monta la COMPOSICION, no el formulario directo. `CrearPedido` es quien habla
// con el servicio; el formulario no sabe que existe uno. Ver research D1.
import { CrearPedido } from "@/components/pedido/crear-pedido";

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
        {/* Este texto tenia dos cosas falsas, y las dos se corrigen en `007`:

            FR-028 — decia "marcá en el mapa desde dónde retiramos el paquete".
            Dejó de ser cierto en `003`: el punto sale del cruce de calles y sólo
            se puede arrastrar dentro de la cuadra declarada. Marcar libre en el
            mapa es justamente lo que ese feature prohibió, porque un punto libre
            hace el precio manipulable.

            FR-027 — decía "Podés cargarlo como invitado, sin necesidad de crear
            una cuenta". La constitución v3.0.0 dice lo contrario desde el
            2026-08-11: no hay pedido sin cliente identificado.

            Es lo primero que lee quien llega desde un buscador, y el sitio es
            indexable desde `004`. */}
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          Escribí la calle y la esquina de retiro: con eso ubicamos el punto y te
          mostramos el precio al instante, sin necesidad de crear una cuenta.
          Para confirmar el pedido sí vas a tener que identificarte.
        </p>
      </div>
      <CrearPedido />
    </div>
  );
}
