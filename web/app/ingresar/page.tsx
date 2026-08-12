"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { PanelIngreso } from "@/components/sesion/panel-ingreso";
import { useSesion } from "@/components/sesion/proveedor-sesion";

const sectionClass = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6";

/**
 * Pantalla de ingreso.
 *
 * **Sigue existiendo despues de `007`** (FR-010a), y no es redundante: es el
 * camino de quien se identifica desde la navegacion, sin estar pidiendo nada. El
 * dialogo que `007` monta sobre `/pedido` se SUMA a este camino, no lo
 * reemplaza.
 *
 * La composicion del ingreso —los tres estados, los dos caminos, el alta a
 * medias— vive en `PanelIngreso` desde `007`. Esta pantalla solo decide donde se
 * muestra y que pasa al terminar: volver al inicio.
 *
 * Tener una sola composicion es lo que evita que diverjan. Dos copias del mismo
 * login terminan distintas, y el arreglo que recibe una no llega a la otra.
 */
export default function IngresarPage() {
  const router = useRouter();
  const { usuario, cargando } = useSesion();

  const volverAlInicio = useCallback(() => router.push("/"), [router]);

  const yaEstaAdentro = !cargando && usuario?.perfilCompleto;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10 sm:px-6">
      <div className={sectionClass}>
        <PanelIngreso onListo={volverAlInicio} />
      </div>

      {/* Para quien ya estaba adentro, el atajo al unico lugar al que va a
          querer ir. Vive en la pantalla y no en el panel porque es navegacion, y
          el panel se usa tambien adentro de un dialogo donde navegar seria
          perder el formulario cargado. */}
      {yaEstaAdentro && (
        <p className="mt-4 text-center text-sm text-slate-500">
          <Link href="/pedido" className="font-medium text-brand hover:underline">
            Enviar un paquete
          </Link>
        </p>
      )}
    </div>
  );
}
