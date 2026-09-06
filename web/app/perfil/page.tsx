"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Historial } from "@/components/pedido/historial";
import { FormularioPerfil } from "@/components/sesion/formulario-perfil";
import { useSesion } from "@/components/sesion/proveedor-sesion";

const sectionClass = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6";

/** Las dos vistas de la cuenta. Excluyentes: nunca se ven las dos a la vez. */
type Vista = "datos" | "pedidos";

const VISTAS: readonly { id: Vista; etiqueta: string }[] = [
  { id: "datos", etiqueta: "Mis datos" },
  { id: "pedidos", etiqueta: "Mis pedidos" },
];

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
 *
 * **Dos vistas, no una lista larga** (FR-027, enmienda del 2026-08-22). Antes el
 * historial colgaba debajo del formulario y habia que desplazarse por los ocho
 * campos de la direccion para llegar al primer pedido. Los datos y los pedidos
 * son dos cosas que se vienen a hacer por separado.
 */
/**
 * El limite de Suspense, y **no es decorativo**.
 *
 * `useSearchParams` empuja todo el arbol de abajo al cliente, y sin un limite de
 * Suspense **el build estatico falla directamente**. En desarrollo funciona
 * igual, que es la trampa. Es el mismo motivo por el que `app/pedido/page.tsx`
 * lleva el suyo desde `010`.
 */
export default function PerfilPage() {
  return (
    <Suspense fallback={<Esperando />}>
      <Cuenta />
    </Suspense>
  );
}

function Esperando() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <div className={sectionClass}>
        <p className="py-6 text-center text-sm text-slate-500">Un momento…</p>
      </div>
    </div>
  );
}

function Cuenta() {
  const { usuario, cargando } = useSesion();
  const router = useRouter();
  const parametros = useSearchParams();

  /**
   * En que vista estamos, leido de la URL (`/perfil?ver=pedidos`).
   *
   * **Esto revierte la mitad de FR-027 de `010`**, que decia que la eleccion no
   * se recuerda "ni viaja en la URL" porque "quien entra a Mi cuenta viene, casi
   * siempre, a escribir su direccion". **Ese supuesto lo vencio `022`**: desde
   * que se puede corregir y dar de baja un pedido, a esta pantalla se vuelve a
   * mirar estados, y recargarla mandaba de nuevo a *Mis datos* cada vez.
   *
   * **En la URL y no en `sessionStorage`**, que era la otra opcion: sobrevive la
   * recarga sin guardar nada en el telefono, se puede compartir el enlace, y el
   * boton de atras hace lo que uno espera. Es la misma razon por la que
   * `?repetir=` y `?editar=` viajan por la URL.
   *
   * Cualquier valor que no sea `pedidos` cae en `datos`: no hay estado invalido
   * que manejar, y una URL escrita a mano no puede romper la pantalla.
   */
  const vista: Vista = parametros.get("ver") === "pedidos" ? "pedidos" : "datos";

  // `replace` y no `push`: alternar entre las dos vistas no es navegar, y con
  // `push` el boton de atras se llenaria de pasos que la persona no dio.
  const irA = (id: Vista) =>
    router.replace(id === "pedidos" ? "/perfil?ver=pedidos" : "/perfil", {
      scroll: false,
    });

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

            {/* `aria-pressed` y no el patron de pestañas de ARIA: ese promete
                navegacion con flechas, y prometerla sin implementarla es peor
                que no usarlo. Con esto, Tab llega y Enter o Espacio cambian de
                vista, que es lo que M2 le exige a la pantalla. Es el mismo
                idioma que el conmutador de cooperativa de `bloque-direccion`. */}
            <div className="mt-4 flex gap-3">
              {VISTAS.map(({ id, etiqueta }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={vista === id}
                  onClick={() => irA(id)}
                  className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                    vista === id
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {etiqueta}
                </button>
              ))}
            </div>

            {vista === "datos" ? (
              <>
                <p className="mt-6 mb-6 text-sm text-slate-600">
                  Lo que guardes acá lo usamos para no pedirte lo mismo en cada envío.
                </p>
                <FormularioPerfil />
              </>
            ) : (
              // `010`. Solo dentro de la rama con sesion: sin sesion no existe
              // (FR-008), y por eso tampoco hay conmutador que lo ofrezca.
              <Historial />
            )}
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
          empezar a cargar un pedido
        </Link>{" "}
        sin ingresar.
      </p>
    </div>
  );
}
