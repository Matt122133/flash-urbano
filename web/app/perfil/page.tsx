"use client";

import Link from "next/link";
import { Historial } from "@/components/pedido/historial";
import { FormularioPerfil } from "@/components/sesion/formulario-perfil";
import { useSesion } from "@/components/sesion/proveedor-sesion";

const sectionClass = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6";

/**
 * Mi cuenta.
 *
 * Es lo unico que este feature le **devuelve** al cliente por haberse
 * registrado: hasta acá, identificarse solo mostraba su nombre en la
 * navegacion. El cobro de estos datos —precargar el formulario de pedido— es
 * `007`.
 *
 * **No es una puerta al sitio**: cotizar y pedir siguen sin pedir nada
 * (FR-007b). Esta pantalla si necesita saber quien es, asi que a quien no esta
 * identificado le ofrece entrar en vez de rebotarlo.
 */
export default function PerfilPage() {
  const { usuario, cargando } = useSesion();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <div className={sectionClass}>
        {cargando ? (
          // Igual que en /ingresar: mientras se resuelve la credencial guardada
          // no se muestra nada, porque decirle "entrá" a alguien que ya esta
          // adentro y cambiarlo medio segundo despues se lee como un error.
          <p className="py-6 text-center text-sm text-slate-500">Un momento…</p>
        ) : !usuario ? (
          <SinSesion />
        ) : (
          <>
            <h1 className="text-xl font-semibold text-slate-900">Mi cuenta</h1>
            <p className="mt-1 mb-6 text-sm text-slate-600">
              Lo que guardes acá lo usamos para no pedirte lo mismo en cada envío.
            </p>
            <FormularioPerfil />
            {/* `010`. Va DENTRO de la rama con sesion y despues del formulario:
                sin sesion no existe (FR-008), y arriba estaria lo que la persona
                viene a editar tapado por lo que viene a mirar. */}
            <Historial />
          </>
        )}
      </div>
    </div>
  );
}

function SinSesion() {
  return (
    <div className="flex flex-col items-start gap-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Mi cuenta</h1>
        <p className="mt-1 text-sm text-slate-600">
          Ingresá para ver y editar tus datos.
        </p>
      </div>
      <Link
        href="/ingresar"
        className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600"
      >
        Ingresar
      </Link>
      <p className="border-t border-slate-100 pt-4 text-sm text-slate-500">
        Podés{" "}
        <Link href="/pedido" className="font-medium text-brand hover:underline">
          ver cuánto sale un envío
        </Link>{" "}
        sin ingresar.
      </p>
    </div>
  );
}
