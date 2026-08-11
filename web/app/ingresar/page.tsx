"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { BotonGoogle } from "@/components/sesion/boton-google";
import { CompletarAlta } from "@/components/sesion/completar-alta";
import { useSesion } from "@/components/sesion/proveedor-sesion";

const sectionClass = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6";

/**
 * Pantalla de ingreso.
 *
 * Tres estados, y el del medio es el que se olvida: sin sesion (elegir como
 * entrar), con sesion pero sin nombre ni telefono (completar el alta, FR-021a),
 * y adentro.
 *
 * **El camino por mail todavia no existe** — es la Historia 3 — y por eso no
 * aparece. Se decidio no mostrarlo deshabilitado: una opcion muerta hace perder
 * mas tiempo que no ofrecerla. El hueco esta en la estructura, no en la
 * pantalla: US3 agrega su componente debajo del separador.
 */
export default function IngresarPage() {
  const router = useRouter();
  const { usuario, cargando, avisoDeSesion, descartarAviso } = useSesion();
  const [error, setError] = useState<string | null>(null);

  const volverAlInicio = useCallback(() => router.push("/"), [router]);

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10 sm:px-6">
      <div className={sectionClass}>
        {/* Mientras se resuelve la credencial guardada no se muestra ni el
            boton ni el saludo: mostrar "Ingresar" a alguien que ya esta adentro
            y cambiarlo medio segundo despues se lee como un error. */}
        {cargando ? (
          <p className="py-6 text-center text-sm text-slate-500">Un momento…</p>
        ) : !usuario ? (
          <ElegirComoEntrar
            error={error}
            aviso={avisoDeSesion}
            onError={setError}
            onIngreso={() => {
              setError(null);
              descartarAviso();
            }}
          />
        ) : !usuario.perfilCompleto ? (
          <CompletarAlta onListo={volverAlInicio} />
        ) : (
          <YaEstas nombre={usuario.nombre} />
        )}
      </div>
    </div>
  );
}

function ElegirComoEntrar({
  error,
  aviso,
  onError,
  onIngreso,
}: {
  error: string | null;
  aviso: string | null;
  onError: (mensaje: string) => void;
  onIngreso: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Ingresar</h1>
        <p className="mt-1 text-sm text-slate-600">
          Para que no tengas que escribir tus datos cada vez que pedís un envío.
        </p>
      </div>

      {/* El aviso de sesion vencida va acá y no en un cartel global: es el lugar
          donde el mensaje sirve, porque abajo esta el boton que lo resuelve. */}
      {aviso && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">{aviso}</p>
      )}

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <BotonGoogle onIngreso={onIngreso} onError={onError} />

      {/* Cotizar no pide nada, y quien llego acá de mas tiene que poder salir
          sin sentir que choco contra una puerta (FR-001, Principio II). */}
      <p className="border-t border-slate-100 pt-4 text-center text-sm text-slate-500">
        Podés{" "}
        <Link href="/pedido" className="font-medium text-brand hover:underline">
          ver cuánto sale un envío
        </Link>{" "}
        sin ingresar.
      </p>
    </div>
  );
}

function YaEstas({ nombre }: { nombre: string }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Hola{nombre ? `, ${nombre}` : ""}
        </h1>
        <p className="mt-1 text-sm text-slate-600">Ya estás dentro de tu cuenta.</p>
      </div>
      <Link
        href="/pedido"
        className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600"
      >
        Enviar un paquete
      </Link>
    </div>
  );
}
