"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ErrorApi, pedir } from "@/lib/api";
import { useSesion, type RespuestaSesion } from "./proveedor-sesion";

// Mismas clases que el resto de las pantallas de sesion, repetidas por el mismo
// motivo que en `completar-alta.tsx`.
const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";
const errorClass = "mt-1 text-xs font-medium text-red-600";

/** Cuanto hay que esperar para volver a pedir un codigo. */
const ESPERA_REENVIO_S = 30;

/** Los digitos que tiene el codigo. Espejo de `digitosDelCodigo` del backend. */
const DIGITOS = 6;

/**
 * Ingreso por codigo enviado al mail. Dos pasos.
 *
 * **Nunca dice si la direccion esta registrada** (FR-014). El servicio responde
 * 204 pase lo que pase —exista el usuario o no, este el limite excedido o no,
 * falle el proveedor o no— y esta pantalla se comporta igual: siempre pasa al
 * paso del codigo. Decir "esa direccion no existe" convertiria el ingreso en un
 * verificador de cuentas.
 *
 * El precio, que es real y hay que asumirlo en el copy: cuando el mail **no
 * llega**, el sitio no puede explicar por que. Por eso el segundo paso lleva una
 * ayuda concreta —revisar spam, esperar, corregir la direccion— en vez de un
 * "revisá tu correo" que deja a la persona sin nada que hacer.
 */
export function IngresoPorCodigo({
  onIngreso,
}: {
  onIngreso: (respuesta: RespuestaSesion) => void;
}) {
  const { entrar } = useSesion();

  const [paso, setPaso] = useState<"email" | "codigo">("email");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [espera, setEspera] = useState(0);

  const campoCodigo = useRef<HTMLInputElement>(null);

  // La cuenta regresiva del reenvio. Existe para que la persona no gaste sus
  // tres pedidos cada quince minutos tocando el boton mientras el mail viaja:
  // el limite del servicio no se puede ver desde afuera —responde igual—, asi
  // que si no lo frenamos aca se queda sin intentos sin enterarse.
  useEffect(() => {
    if (espera <= 0) return;
    const reloj = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(reloj);
  }, [espera]);

  const pedirCodigo = useCallback(
    async (direccion: string) => {
      setError(null);
      setEnviando(true);
      try {
        await pedir<void>("/auth/codigo", {
          metodo: "POST",
          cuerpo: { email: direccion.trim() },
        });
        setPaso("codigo");
        setEspera(ESPERA_REENVIO_S);
        return true;
      } catch (err) {
        // El unico error que el servicio devuelve acá es 400 por forma
        // invalida, y ese SI se puede decir: que "hola" no sea una direccion no
        // depende de quien este registrado.
        setError(
          err instanceof ErrorApi && err.sinRespuesta
            ? "No pudimos conectarnos con el servicio. Intentá de nuevo en un momento."
            : "Revisá la dirección: no parece un correo válido.",
        );
        return false;
      } finally {
        setEnviando(false);
      }
    },
    [],
  );

  async function enviarEmail(e: FormEvent) {
    e.preventDefault();
    if (await pedirCodigo(email)) {
      // El foco va al campo del codigo: en un telefono, tener que buscarlo y
      // tocarlo es un paso de mas justo cuando la persona vuelve del mail.
      setTimeout(() => campoCodigo.current?.focus(), 0);
    }
  }

  async function verificar(e: FormEvent) {
    e.preventDefault();

    const limpio = codigo.replace(/\D/g, "");
    if (limpio.length !== DIGITOS) {
      setError(`El código tiene ${DIGITOS} dígitos.`);
      return;
    }

    setError(null);
    setVerificando(true);
    try {
      const sesion = await pedir<RespuestaSesion>("/auth/codigo/verificar", {
        metodo: "POST",
        cuerpo: { email: email.trim(), codigo: limpio },
      });
      entrar(sesion);
      onIngreso(sesion);
    } catch (err) {
      if (err instanceof ErrorApi && err.sinRespuesta) {
        setError("No pudimos conectarnos con el servicio. Intentá de nuevo en un momento.");
      } else {
        // **Un solo mensaje para las cuatro causas**, igual que el servicio:
        // incorrecto, vencido, agotado y "nunca se pidió" salen iguales. Decir
        // "venció" le confirmaria a quien prueba codigos que esa direccion pidio
        // uno.
        setError("Ese código no sirve. Revisá que sea el último que te llegó, o pedí otro.");
      }
    } finally {
      setVerificando(false);
    }
  }

  if (paso === "email") {
    return (
      <form onSubmit={enviarEmail} noValidate className="flex flex-col gap-3">
        <div>
          <label htmlFor="ingreso-email" className={labelClass}>
            Tu correo
          </label>
          <input
            id="ingreso-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="vos@ejemplo.com"
            maxLength={254}
          />
          {error && <p className={errorClass}>{error}</p>}
        </div>

        <button
          type="submit"
          disabled={enviando || !email.trim()}
          className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {enviando ? "Enviando…" : "Enviarme un código"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={verificar} noValidate className="flex flex-col gap-3">
      <div>
        <p className="text-sm text-slate-600">
          Te mandamos un código a{" "}
          <span className="font-medium text-slate-900">{email.trim()}</span>.
        </p>

        <label htmlFor="ingreso-codigo" className={`${labelClass} mt-3`}>
          Código de {DIGITOS} dígitos
        </label>
        <input
          id="ingreso-codigo"
          ref={campoCodigo}
          value={codigo}
          // Solo digitos: pegar el codigo desde el mail suele arrastrar espacios.
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, DIGITOS))}
          className={`${inputClass} text-center text-lg tracking-[0.4em]`}
          type="text"
          inputMode="numeric"
          // Deja que el teclado del telefono lo ofrezca para autocompletar.
          autoComplete="one-time-code"
          placeholder="000000"
          maxLength={DIGITOS}
        />
        {error && <p className={errorClass}>{error}</p>}
      </div>

      <button
        type="submit"
        disabled={verificando || codigo.length !== DIGITOS}
        className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {verificando ? "Entrando…" : "Entrar"}
      </button>

      {/*
        La ayuda concreta del caso "no me llegó". Es lo unico que el sitio puede
        ofrecer, porque el servicio no le dice —ni le puede decir— por que no
        llego. Se nombra el spam explicitamente: hoy, con el dominio recien
        estrenado, es donde el codigo termina en algunos proveedores.
      */}
      <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <p className="font-medium text-slate-700">¿No te llegó?</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li>Puede tardar un minuto.</li>
          <li>Fijate en <span className="font-medium">correo no deseado</span> o spam.</li>
          <li>Revisá que la dirección esté bien escrita.</li>
        </ul>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void pedirCodigo(email)}
            disabled={enviando || espera > 0}
            className="font-medium text-brand hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
          >
            {espera > 0 ? `Reenviar en ${espera}s` : enviando ? "Enviando…" : "Reenviar el código"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPaso("email");
              setCodigo("");
              setError(null);
            }}
            className="font-medium text-slate-500 hover:underline"
          >
            Usar otra dirección
          </button>
        </div>
      </div>
    </form>
  );
}
