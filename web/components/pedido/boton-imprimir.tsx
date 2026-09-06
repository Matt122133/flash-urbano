"use client";

// El boton que descarga la etiqueta, compartido por las dos pantallas que la
// ofrecen: la confirmacion y cada tarjeta de Mis pedidos.
//
// **Vive en un solo lugar por el mismo motivo que `lib/etiqueta.ts`** (FR-003):
// si cada pantalla escribiera su propio boton, la carga diferida, el nombre del
// archivo y —sobre todo— el manejo de la falla divergirian, y el modo de fallar
// es justo lo que no se prueba solo.
//
// Recibe una FUNCION que arma la etiqueta, no una etiqueta ya armada. Asi el
// trabajo se hace al tocar y no en cada render de una lista de pedidos, donde
// habria que resolver una zona por tarjeta para un boton que casi nadie toca.
import { useState } from "react";

import type { Etiqueta } from "@/lib/etiqueta";
import { nombreDeArchivo } from "@/lib/etiqueta";

type Estado = "listo" | "generando" | "error";

const ERROR =
  "No pudimos generar el resumen. Probá de nuevo en un momento.";

export function BotonImprimir({
  etiqueta,
  className,
  tamano = "normal",
}: {
  /** Se llama al tocar, no antes: armarla resuelve una zona. */
  etiqueta: () => Etiqueta;
  className?: string;
  /**
   * `compacto` en la tarjeta del historial, donde el boton comparte renglon con
   * *Repetir* y tiene que igualarle el alto. `normal` en la confirmacion, donde
   * va al lado de *Cargar otro pedido*.
   *
   * Es un tamaño y no un `className` suelto **a proposito**: quien lo use no
   * tiene que acertarle a las clases del boton para que dos pastillas queden
   * parejas.
   */
  tamano?: "normal" | "compacto";
}) {
  const [estado, setEstado] = useState<Estado>("listo");

  async function alTocar() {
    setEstado("generando");
    try {
      // **Import dinamico, y es el punto de FR-014.** `etiqueta-pdf` arrastra
      // jsPDF —108 KB comprimidos, medidos— y un import estatico se los cobraria
      // a todo el que abre /pedido o /perfil, imprima o no.
      //
      // Para una LIBRERIA la guia de Next indica exactamente esto —un `await
      // import()` adentro del handler— y no `next/dynamic`, que es para
      // componentes.
      const { dibujarEtiqueta } = await import("@/lib/etiqueta-pdf");
      const datos = etiqueta();
      // `.save()` arma el Blob y dispara la descarga. **Ahi termina el trabajo
      // del producto** (FR-017): no se abre ningun dialogo de impresion ni se
      // habla con una impresora. Que el sistema lo baje a una carpeta, lo abra
      // en un visor o lo mande a compartir son los tres resultados correctos.
      dibujarEtiqueta(datos).save(nombreDeArchivo(datos));
      setEstado("listo");
    } catch (e) {
      // **Sin este catch el boton no haria nada visible**, que es exactamente lo
      // que paso el 2026-08-14 con el boton de confirmar: la excepcion se
      // perdia, la pantalla quedaba igual, y no hay forma de distinguir eso de
      // un boton roto — la persona vuelve a tocar.
      //
      // Un import dinamico es una request, y una request falla. El mensaje dice
      // lo unico seguro; el detalle va a la consola (FR-015).
      console.error("Fallo al generar la etiqueta:", e);
      setEstado("error");
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={alTocar}
        disabled={estado === "generando"}
        className={`inline-flex items-center gap-2 rounded-full border border-slate-300 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 ${
          tamano === "compacto" ? "px-4 py-2" : "px-5 py-2.5"
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zM7 7h10V5a2 2 0 00-2-2H9a2 2 0 00-2 2v2z"
          />
        </svg>
        {estado === "generando" ? "Generando…" : "Imprimir resumen"}
      </button>

      {/* `role="alert"` para que un lector de pantalla lo anuncie: quien no ve
          la pantalla necesita enterarse de que no salio, igual que el resto. */}
      {estado === "error" && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {ERROR}
        </p>
      )}
    </div>
  );
}
