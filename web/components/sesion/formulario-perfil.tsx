"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ErrorApi } from "@/lib/api";
import {
  BloqueDireccion,
  ESTADO_DIRECCION_VACIO,
  type EstadoDireccion,
} from "@/components/bloque-direccion";
import { MapaZonasDinamico } from "@/components/mapa-zonas-dinamico";
import type { EstadoMosaicos, Punto } from "@/components/mapa-zonas";
import { regionPermitida } from "@/lib/direcciones";
import {
  useLlamadaAutenticada,
  useSesion,
  type Usuario,
} from "./proveedor-sesion";
import { rehidratarRetiro } from "./rehidratar-retiro";

// Mismas clases que el formulario de pedido, repetidas por el mismo motivo que
// en `completar-alta.tsx`: `pedido-form.tsx` esta fuera del `covers:` de este
// feature a proposito (FR-007b), y extraerlas a un modulo compartido seria
// tocarlo.
const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";
const errorClass = "mt-1 text-xs font-medium text-red-600";

/** Como quedo el intento de reconstruir la direccion guardada. */
type Rehidratacion =
  | { estado: "cargando" }
  | { estado: "sin-direccion" }
  | { estado: "listo" }
  /**
   * La direccion esta guardada pero el indice de calles ya no la resuelve.
   * Pasa de verdad: el indice se regenera, y una calle puede cambiar de nombre
   * o desaparecer entre que se guardo y hoy.
   */
  | { estado: "no-ubicable" };

/**
 * Ver y editar el perfil: nombre, telefono y direccion de retiro.
 *
 * Escribe por el **mismo** `PUT /yo` que completa el alta. No hay un endpoint
 * de edicion aparte, y no deberia haberlo.
 *
 * La direccion **va entera o no va** (FR-019a), igual que del lado del
 * servicio: una direccion a medias guardada es peor que ninguna, porque `007`
 * la va a precargar y quien la vea no sabe si tiene que completarla o
 * corregirla.
 */
export function FormularioPerfil() {
  const { usuario, actualizarUsuario } = useSesion();
  const llamar = useLlamadaAutenticada();

  const [nombre, setNombre] = useState(usuario?.nombre ?? "");
  const [telefono, setTelefono] = useState(usuario?.telefono ?? "");
  const [retiro, setRetiro] = useState<EstadoDireccion>(ESTADO_DIRECCION_VACIO);
  const [rehidratacion, setRehidratacion] = useState<Rehidratacion>({
    estado: usuario?.retiro ? "cargando" : "sin-direccion",
  });

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const [estadoMosaicos, setEstadoMosaicos] = useState<EstadoMosaicos>("cargando");
  const [centrarEn, setCentrarEn] = useState<Punto | null>(null);
  const [salioDeLaCuadra, setSalioDeLaCuadra] = useState(false);

  const guardadoRetiro = usuario?.retiro ?? null;

  useEffect(() => {
    let vigente = true;

    // Todo cuelga de una promesa ya resuelta por el mismo motivo que en
    // `proveedor-sesion.tsx`: el lint de React prohibe setState sincrono dentro
    // de un efecto. Aca aplica al caso "no hay direccion guardada", que se
    // resuelve sin esperar a nadie.
    Promise.resolve()
      .then(() => (guardadoRetiro ? rehidratarRetiro(guardadoRetiro) : null))
      .then((resultado) => {
        if (!vigente) return;
        if (!resultado) {
          setRehidratacion({ estado: "sin-direccion" });
          return;
        }
        setRetiro(resultado.estado);
        setCentrarEn(resultado.estado.direccion.punto ?? null);
        setRehidratacion({ estado: resultado.ubicable ? "listo" : "no-ubicable" });
      });

    return () => {
      vigente = false;
    };
  }, [guardadoRetiro]);

  const punto = retiro.direccion.punto ?? null;
  const region = retiro.esquina
    ? regionPermitida(retiro.esquina, retiro.cualEsLaCalle)
    : null;

  // Vacia del todo es valido: se puede guardar nombre y telefono sin direccion.
  // A medias no.
  const direccionVacia =
    !retiro.direccion.calle.trim() &&
    !retiro.direccion.esquina.trim() &&
    !retiro.direccion.numero.trim() &&
    !punto;
  const direccionCompleta = Boolean(
    retiro.esquina &&
      punto &&
      retiro.direccion.calle.trim() &&
      retiro.direccion.esquina.trim() &&
      retiro.direccion.numero.trim(),
  );

  function validar(): Record<string, string> {
    const nuevos: Record<string, string> = {};
    if (!nombre.trim()) nuevos.nombre = "Necesitamos tu nombre para saber a quién buscar.";
    // Misma decision que en el alta: no se valida la forma del telefono.
    if (telefono.trim().length < 6) nuevos.telefono = "Escribí un teléfono donde podamos ubicarte.";

    if (direccionVacia || direccionCompleta) return nuevos;

    // Incompleta: se dice exactamente que falta, en vez de un "revisá la
    // dirección" que obliga a adivinar.
    if (retiro.candidatos.length > 1) {
      nuevos.esquina = "Hay más de un cruce con ese nombre: elegí cuál es el tuyo.";
    } else if (!retiro.esquina) {
      nuevos.esquina = "Elegí la calle y la esquina de las sugerencias para que podamos ubicarla.";
    } else if (!retiro.direccion.numero.trim()) {
      nuevos.numero = "Ingresá el número de puerta.";
    } else if (!punto) {
      nuevos.ubicacionRetiro = "Todavía no pudimos ubicar esa dirección.";
    }
    return nuevos;
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setGuardado(false);

    const nuevos = validar();
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    setErrorGeneral(null);
    setGuardando(true);
    try {
      const actualizado = await llamar<Usuario>("/yo", {
        metodo: "PUT",
        cuerpo: {
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          // Se **omite** cuando no esta completa, y eso conserva la guardada
          // (el servicio hace COALESCE). Mandar una direccion a medias la
          // rechazaria entera, y mandar null no borra nada: hoy no hay forma de
          // borrar la direccion guardada, solo de reemplazarla.
          ...(direccionCompleta && punto
            ? {
                retiro: {
                  calle: retiro.direccion.calle.trim(),
                  esquina: retiro.direccion.esquina.trim(),
                  numero: retiro.direccion.numero.trim(),
                  punto: { lat: punto.lat, lng: punto.lng },
                  apto: retiro.direccion.apto.trim(),
                  cooperativa: retiro.direccion.cooperativa,
                },
              }
            : {}),
        },
      });
      actualizarUsuario(actualizado);
      setGuardado(true);
    } catch (err) {
      // La sesion vencida la maneja el proveedor con su propio aviso.
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
    <form onSubmit={enviar} noValidate className="flex flex-col gap-6">
      <section>
        <h2 className="text-base font-semibold text-slate-900">Tus datos</h2>
        <p className="mt-1 text-sm text-slate-600">
          Son los que usamos para coordinar el retiro.
        </p>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="perfil-nombre" className={labelClass}>
              Tu nombre
            </label>
            <input
              id="perfil-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={inputClass}
              autoComplete="name"
              maxLength={120}
            />
            {errores.nombre && <p className={errorClass}>{errores.nombre}</p>}
          </div>

          <div>
            <label htmlFor="perfil-telefono" className={labelClass}>
              Tu teléfono
            </label>
            <input
              id="perfil-telefono"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className={inputClass}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="099 123 456"
              maxLength={40}
            />
            {errores.telefono && <p className={errorClass}>{errores.telefono}</p>}
          </div>
        </div>

        {usuario?.email && (
          <p className="mt-3 text-xs text-slate-500">
            Entrás con <span className="font-medium text-slate-700">{usuario.email}</span>. Esa
            dirección no se puede cambiar desde acá.
          </p>
        )}
      </section>

      <section className="border-t border-slate-100 pt-5">
        <h2 className="text-base font-semibold text-slate-900">
          Tu dirección de retiro
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          La guardás una vez y no la volvés a escribir. Es opcional: podés dejarla
          para más adelante.
        </p>

        {rehidratacion.estado === "cargando" ? (
          <p className="mt-4 rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Buscando tu dirección guardada…
          </p>
        ) : (
          <>
            {rehidratacion.estado === "no-ubicable" && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Tenemos tu dirección guardada pero no pudimos ubicarla en el mapa.
                Volvé a elegir la calle y la esquina de las sugerencias para poder
                ajustar el punto.
              </p>
            )}

            <BloqueDireccion
              id="perfil-retiro"
              valor={retiro}
              errors={errores}
              onCambio={(estado) => {
                setRetiro(estado);
                setSalioDeLaCuadra(false);
                setGuardado(false);
                // Solo se recentra al resolverse un cruce nuevo, no al arrastrar.
                if (estado.esquina && estado.esquina !== retiro.esquina) {
                  setCentrarEn(estado.esquina.punto);
                }
              }}
            />

            {/* El mapa va debajo de los campos, igual que en el pedido (FR-010b):
                los campos son la pregunta y el mapa es la respuesta. */}
            <div className="mt-4">
              {retiro.esquina || retiro.candidatos.length > 1 ? (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <MapaZonasDinamico
                    interactivo={Boolean(retiro.esquina)}
                    punto={punto}
                    onPunto={(p) =>
                      setRetiro({
                        ...retiro,
                        direccion: { ...retiro.direccion, punto: p },
                      })
                    }
                    region={region}
                    onFueraDeRegion={() => setSalioDeLaCuadra(true)}
                    candidatos={
                      retiro.candidatos.length > 1
                        ? retiro.candidatos.map((c) => c.punto)
                        : undefined
                    }
                    centrarEn={centrarEn}
                    onEstadoMosaicos={setEstadoMosaicos}
                    className="h-[300px] w-full sm:h-[380px]"
                  />
                </div>
              ) : (
                <div className="flex h-[300px] w-full items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm text-slate-500 sm:h-[380px]">
                  Cuando elijas la calle y la esquina, acá te mostramos el punto
                  en el mapa.
                </div>
              )}
            </div>

            {retiro.esquina && (
              <p className="mt-2 text-xs text-slate-500">
                Podés arrastrar el punto dentro de la cuadra sombreada para
                dejarlo en tu puerta. Se guarda donde lo dejes.
              </p>
            )}

            {salioDeLaCuadra && (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Trajimos el punto de vuelta: sólo se puede mover dentro de la
                cuadra que indicaste.
              </p>
            )}

            {estadoMosaicos === "no-disponible" && (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                No podemos cargar el mapa en este momento, así que no vas a poder
                ajustar el punto. Podés guardar tu nombre y tu teléfono igual.
              </p>
            )}

            {errores.ubicacionRetiro && (
              <p className={errorClass}>{errores.ubicacionRetiro}</p>
            )}

          </>
        )}
      </section>

      {errorGeneral && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{errorGeneral}</p>
      )}

      {guardado && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Guardado.
        </p>
      )}

      <button
        type="submit"
        disabled={guardando}
        className="self-start rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {guardando ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
