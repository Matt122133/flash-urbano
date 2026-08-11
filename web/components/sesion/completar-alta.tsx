"use client";

import { useState, type FormEvent } from "react";
import { ErrorApi } from "@/lib/api";
import { useLlamadaAutenticada, useSesion, type Usuario } from "./proveedor-sesion";

// Mismas clases que el formulario de pedido. Se repiten en vez de importarse
// porque `pedido-form.tsx` esta fuera del `covers:` de este feature a proposito
// (FR-007b) y extraerlas a un modulo compartido seria tocarlo.
const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";
const errorClass = "mt-1 text-xs font-medium text-red-600";

/**
 * Ultimo paso del alta: nombre y telefono.
 *
 * Lo pide **por los dos caminos de ingreso** (FR-021a). Con Google el nombre
 * viene precargado y editable; con el codigo por mail llega vacio, porque el
 * codigo solo prueba la direccion.
 *
 * Es el mismo `PUT /yo` que despues edita el perfil: no hay un endpoint de
 * "alta" aparte, y no deberia haberlo — dos caminos para escribir lo mismo es
 * como uno de los dos se olvida de marcar el perfil como completo.
 */
export function CompletarAlta({ onListo }: { onListo: () => void }) {
  const { usuario, actualizarUsuario } = useSesion();
  const llamar = useLlamadaAutenticada();

  const [nombre, setNombre] = useState(usuario?.nombre ?? "");
  const [telefono, setTelefono] = useState(usuario?.telefono ?? "");
  const [errores, setErrores] = useState<{ nombre?: string; telefono?: string }>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();

    const nuevos: typeof errores = {};
    if (!nombre.trim()) nuevos.nombre = "Necesitamos tu nombre para saber a quién buscar.";
    // No se valida la forma del telefono, a proposito: los formatos uruguayos
    // conviven —con y sin 0, con y sin espacios, celular y fijo— y rechazar uno
    // valido en el ultimo paso del alta es peor que aceptar uno raro. Diego lo
    // va a marcar por WhatsApp igual.
    if (telefono.trim().length < 6) nuevos.telefono = "Escribí un teléfono donde podamos ubicarte.";

    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    setErrorGeneral(null);
    setGuardando(true);
    try {
      const actualizado = await llamar<Usuario>("/yo", {
        metodo: "PUT",
        cuerpo: { nombre: nombre.trim(), telefono: telefono.trim() },
      });
      actualizarUsuario(actualizado);
      onListo();
    } catch (err) {
      // Una sesion vencida acá la maneja el proveedor, que muestra su propio
      // aviso: repetirlo mostraria dos mensajes distintos para lo mismo.
      if (err instanceof ErrorApi && err.sesionInvalida) return;
      setErrorGeneral(
        err instanceof ErrorApi && err.sinRespuesta
          ? "No pudimos conectarnos con el servicio. Intentá de nuevo en un momento."
          : "No pudimos guardar tus datos. Probá de nuevo.",
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Un paso más</h2>
        <p className="mt-1 text-sm text-slate-600">
          Con esto ya podés pedir sin volver a escribirlo cada vez.
        </p>
      </div>

      <div>
        <label htmlFor="alta-nombre" className={labelClass}>
          Tu nombre
        </label>
        <input
          id="alta-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className={inputClass}
          // Nombre completo, no "given-name": es como lo va a buscar el
          // autocompletado del telefono, que es donde se llena esto.
          autoComplete="name"
          autoFocus
          maxLength={120}
        />
        {errores.nombre && <p className={errorClass}>{errores.nombre}</p>}
      </div>

      <div>
        <label htmlFor="alta-telefono" className={labelClass}>
          Tu teléfono
        </label>
        <input
          id="alta-telefono"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          className={inputClass}
          // `tel` abre el teclado numerico del telefono. Es la diferencia entre
          // escribirlo de un toque y pelear con el teclado (Principio IV).
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="099 123 456"
          maxLength={40}
        />
        {errores.telefono && <p className={errorClass}>{errores.telefono}</p>}
      </div>

      {errorGeneral && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{errorGeneral}</p>
      )}

      <button
        type="submit"
        disabled={guardando}
        className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {guardando ? "Guardando…" : "Listo"}
      </button>
    </form>
  );
}
