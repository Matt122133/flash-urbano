"use client";

// La puerta, encima de `/pedido`. No navega.
//
// **Que no navegue es toda la decision** (clarificacion del 2026-08-12). Es
// posible porque los dos caminos de ingreso funcionan sin abandonar la pagina:
// Google usa Identity Services, que abre un popup, y el codigo por mail es un
// envio al servicio.
//
// Lo que compra: el borrador del formulario **nunca toca el almacenamiento del
// navegador** (FR-006a). Y eso importa por el dato ajeno, no por comodidad — el
// formulario lleva el nombre y el telefono de QUIEN RECIBE, un tercero que no
// consintio nada, y el telefono desde donde se pide puede ser compartido.
// Guardarlo en disco para sobrevivir una navegacion seria dejar dato personal de
// otro donde no hace falta.
//
// Como no se navega, FR-007 (no perder lo cargado) y FR-008 (desistir deja todo
// intacto) salen casi gratis: no hay nada que restaurar porque nunca se fue.

import { useEffect, useRef } from "react";

import { PanelIngreso } from "@/components/sesion/panel-ingreso";

export type DialogoIngresoProps = {
  abierto: boolean;
  /** Se identifico y el alta esta completa: hay que reanudar el envio. */
  onListo: () => void;
  /** Cerro sin identificarse. No es un error (FR-008). */
  onCancelar: () => void;
};

export function DialogoIngreso({ abierto, onListo, onCancelar }: DialogoIngresoProps) {
  const panel = useRef<HTMLDivElement>(null);
  const abridor = useRef<Element | null>(null);

  // Escape cierra, y al cerrar el foco vuelve a donde estaba. Sin esto, quien
  // navega con teclado queda perdido en el fondo de la pagina despues de cerrar.
  useEffect(() => {
    if (!abierto) return;

    abridor.current = document.activeElement;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancelar();
    };
    document.addEventListener("keydown", alTeclear);

    // Se enfoca el panel al abrir para que el lector de pantalla anuncie de que
    // se trata en vez de dejar el foco donde estaba.
    panel.current?.focus();

    // El fondo no se scrollea mientras el dialogo esta abierto.
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = overflowPrevio;
      (abridor.current as HTMLElement | null)?.focus?.();
    };
  }, [abierto, onCancelar]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      // Tocar el fondo cierra. Es lo que espera cualquiera en un telefono.
      onClick={onCancelar}
    >
      {/* z-[1100] y no z-50: Leaflet declara 1000 en sus controles y el mapa
          esta en esta misma pantalla. Es la misma carrera que `002` resolvio
          aislando el mapa; aca se gana por altura porque el dialogo es efimero y
          vive fuera de ese contexto de apilado. */}
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Ingresar para confirmar el pedido"
        tabIndex={-1}
        // Sin esto, tocar adentro del panel lo cerraria por el handler del
        // fondo.
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-5 shadow-xl outline-none sm:rounded-2xl sm:p-6"
      >
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={onCancelar}
            aria-label="Cerrar"
            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <PanelIngreso
          onListo={onListo}
          titulo="Identificate para confirmar"
          // Se dice POR QUE aparecio la puerta justo ahi, y que no se pierde
          // nada. Sin eso, una puerta que aparece despues de llenar quince
          // campos se lee como que el trabajo se perdio.
          bajada="Ya casi. Tu pedido queda como lo cargaste — solo necesitamos saber quién lo envía."
          // Sin el pie que invita a cotizar: quien esta aca ya esta cotizando, y
          // ese enlace navega fuera, que es exactamente lo que haria perder el
          // formulario.
          conSalidaACotizar={false}
        />
      </div>
    </div>
  );
}
