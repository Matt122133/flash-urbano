import type { Metadata } from "next";
import { Suspense } from "react";
// Monta la COMPOSICION, no el formulario directo. `CrearPedido` es quien habla
// con el servicio; el formulario no sabe que existe uno. Ver research D1.
import { CrearPedido } from "@/components/pedido/crear-pedido";

export const metadata: Metadata = {
  title: "Crear pedido — Flash Urbano",
};

/**
 * El encabezado de la pantalla.
 *
 * Se declara aparte porque lo usan DOS lugares: se le pasa a `CrearPedido`
 * —FR-034: quien sabe si el pedido ya se confirmo es esa composicion, no esta
 * pantalla, y con el pedido hecho el titulo invitaria a hacer algo que se acaba
 * de hacer— y ademas es el fallback del limite de Suspense de abajo.
 *
 * **Que este en el fallback no es decorativo**: desde `010` la composicion lee
 * `?repetir=` con `useSearchParams`, y eso hace que todo el arbol de abajo del
 * limite se renderice en el cliente. Si el fallback no tuviera el encabezado, el
 * `h1` desapareceria del HTML pre-renderizado — que es lo que lee un buscador, y
 * el sitio es indexable desde `004`. El comentario que estaba aca decia que el
 * texto se queda en este archivo justamente para eso; el limite de Suspense
 * podia romperlo en silencio.
 */
const encabezado = (
  <div className="mb-8">
    <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
      Crear pedido
    </h1>
    {/* Este texto tenia dos cosas falsas, y las dos se corrigen en `007`:

        FR-028 — decia "marcá en el mapa desde dónde retiramos el paquete".
        Dejó de ser cierto en `003`: el punto sale del cruce de calles y sólo se
        puede arrastrar dentro de la cuadra declarada. Marcar libre en el mapa
        es justamente lo que ese feature prohibió, porque un punto libre hace el
        precio manipulable.

        FR-027 — decía "Podés cargarlo como invitado, sin necesidad de crear una
        cuenta". La constitución v3.0.0 dice lo contrario desde el 2026-08-11: no
        hay pedido sin cliente identificado.

        Es lo primero que lee quien llega desde un buscador, y el sitio es
        indexable desde `004`. */}
    <p className="mt-2 text-sm text-slate-600 sm:text-base">
      Escribí la calle y la esquina de retiro: con eso ubicamos el punto y te
      mostramos el precio al instante, sin necesidad de crear una cuenta. Para
      confirmar el pedido sí vas a tener que identificarte.
    </p>
  </div>
);

export default function PedidoPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      {/* El limite de Suspense es OBLIGATORIO, no una precaucion: `CrearPedido`
          llama a `useSearchParams()` para leer `?repetir=`, y la documentacion
          de esta version de Next es explicita —"during production builds, a
          static page that calls useSearchParams from a Client Component must be
          wrapped in a Suspense boundary, otherwise the build fails"—. En
          desarrollo funciona sin el, que es la trampa: se rompe recien al
          construir. */}
      <Suspense
        fallback={
          <>
            {encabezado}
            <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
              Un momento…
            </p>
          </>
        }
      >
        <CrearPedido encabezado={encabezado} />
      </Suspense>
    </div>
  );
}
