"use client";

// La composicion del ingreso, sin decidir donde vive.
//
// Se factorizo de `app/ingresar/page.tsx` en `007`, cuando la puerta del
// formulario de pedido necesito el mismo ingreso adentro de un dialogo. El
// motivo es evitar que DIVERJAN: dos composiciones del mismo login terminan
// distintas, la de `/pedido` recibe un arreglo que la de `/ingresar` no, y el
// defecto aparece en el camino que nadie prueba.
//
// Lo que este componente NO decide: donde se muestra, y que pasa al terminar.
// Las dos cosas las pone quien lo monta.

import Link from "next/link";
import { useState } from "react";

import { BotonGoogle } from "@/components/sesion/boton-google";
import { CompletarAlta } from "@/components/sesion/completar-alta";
import { IngresoPorCodigo } from "@/components/sesion/ingreso-por-codigo";
import { useSesion } from "@/components/sesion/proveedor-sesion";

export type PanelIngresoProps = {
  /**
   * Que hacer cuando la persona quedo adentro **y con el alta completa**.
   *
   * En `/ingresar` es volver al inicio; en el dialogo de `/pedido` es cerrarlo y
   * reanudar el envio. Que sea una prop es lo que permite que sea el mismo
   * componente en los dos lados.
   */
  onListo: () => void;

  /** Titulo y bajada. `/pedido` explica por que aparecio la puerta justo ahi. */
  titulo?: string;
  bajada?: string;

  /**
   * Si se muestra el pie con "podés ver cuánto sale un envío sin ingresar".
   *
   * Se oculta en el dialogo de `/pedido`: quien ya esta ahi no necesita que lo
   * inviten a la pantalla en la que esta, y un enlace que navega fuera seria
   * justo lo que hace perder el formulario cargado.
   */
  conSalidaACotizar?: boolean;
};

export function PanelIngreso({
  onListo,
  titulo = "Ingresar",
  bajada = "Para que no tengas que escribir tus datos cada vez que pedís un envío.",
  conSalidaACotizar = true,
}: PanelIngresoProps) {
  const { usuario, cargando, avisoDeSesion, descartarAviso } = useSesion();
  const [error, setError] = useState<string | null>(null);

  // Mientras se resuelve la credencial guardada no se muestra ni el boton ni el
  // saludo: mostrar "Ingresar" a alguien que ya esta adentro y cambiarlo medio
  // segundo despues se lee como un error.
  if (cargando) {
    return <p className="py-6 text-center text-sm text-slate-500">Un momento…</p>;
  }

  // El estado del medio, que es el que se olvida: con sesion pero sin nombre ni
  // telefono (FR-021a). Quien entra por codigo llega siempre asi —el codigo solo
  // prueba que la direccion es suya— y quien entra con Google tambien, si no
  // completo el alta antes.
  if (usuario && !usuario.perfilCompleto) {
    return <CompletarAlta onListo={onListo} />;
  }

  if (usuario) {
    // Ya estaba adentro cuando se monto el panel. No hay nada que pedirle.
    return <YaEstabaAdentro nombre={usuario.nombre} onListo={onListo} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">{titulo}</h2>
        <p className="mt-1 text-sm text-slate-600">{bajada}</p>
      </div>

      {/* El aviso de sesion vencida va aca y no en un cartel global: es el lugar
          donde el mensaje sirve, porque abajo esta el boton que lo resuelve. */}
      {avisoDeSesion && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {avisoDeSesion}
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <BotonGoogle
        onIngreso={() => {
          setError(null);
          descartarAviso();
        }}
        onError={setError}
      />

      {/* El separador no es adorno: marca que abajo hay OTRA forma de entrar a
          la misma cuenta, no un paso siguiente del de arriba. */}
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          o
        </span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <IngresoPorCodigo
        onIngreso={() => {
          setError(null);
          descartarAviso();
        }}
      />

      {conSalidaACotizar && (
        // Cotizar no pide nada, y quien llego aca de mas tiene que poder salir
        // sin sentir que choco contra una puerta (FR-001, Principio II).
        <p className="border-t border-slate-100 pt-4 text-center text-sm text-slate-500">
          Podés{" "}
          <Link href="/pedido" className="font-medium text-brand hover:underline">
            ver cuánto sale un envío
          </Link>{" "}
          sin ingresar.
        </p>
      )}
    </div>
  );
}

function YaEstabaAdentro({
  nombre,
  onListo,
}: {
  nombre: string;
  onListo: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Hola{nombre ? `, ${nombre}` : ""}
        </h2>
        <p className="mt-1 text-sm text-slate-600">Ya estás dentro de tu cuenta.</p>
      </div>
      <button
        type="button"
        onClick={onListo}
        className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600"
      >
        Continuar
      </button>
    </div>
  );
}
