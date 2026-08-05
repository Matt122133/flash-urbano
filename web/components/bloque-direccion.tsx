"use client";

import { useCallback, useEffect, useState } from "react";
import { CampoAutocompletado, type Opcion } from "./campo-autocompletado";
import type { Direccion } from "@/lib/direccion";
import {
  buscarCalle,
  buscarEsquina,
  buscarEsquinaDe,
  cargarIndice,
  type Calle,
  type Esquina,
  type Indice,
} from "@/lib/direcciones";

/**
 * El bloque de direccion: calle y esquina primero, con autocompletado.
 *
 * Antes se pedia calle, numero y esquina como texto libre y ademas marcar el
 * punto en el mapa: el mismo dato dos veces, y ninguna de las dos mitades
 * validaba a la otra. Aca la esquina **ubica** y el numero **informa**, porque
 * el dato de ejes viales no tiene numeracion domiciliaria.
 *
 * Dos modos, y la diferencia no es cosmetica:
 *
 * - `retiro`: de aca sale el precio. Elegir de las sugerencias es obligatorio,
 *   el cruce se resuelve a un punto y ese punto es el que se cobra.
 * - `entrega`: el autocompletado es una **ayuda, no una puerta** (FR-007b). No
 *   hay punto ni mapa, y lo tipeado vale aunque no este en el indice: el indice
 *   cubre el area de servicio, y una entrega fuera de ella es un pedido valido.
 */

export type ModoDireccion = "retiro" | "entrega";

export type EstadoDireccion = {
  direccion: Direccion;
  /** El cruce resuelto, o null. Siempre null en modo entrega. */
  esquina: Esquina | null;
  /** Cual de las dos calles de la esquina es la calle declarada. */
  cualEsLaCalle: "A" | "B";
  /** Mas de uno significa que hay que elegir: nunca se toma el primero. */
  candidatos: Esquina[];
};

export const ESTADO_DIRECCION_VACIO: EstadoDireccion = {
  direccion: {
    calle: "",
    esquina: "",
    numero: "",
    apto: "",
    cooperativa: false,
    punto: null,
  },
  esquina: null,
  cualEsLaCalle: "A",
  candidatos: [],
};

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

const opcionDe = (calle: Calle): Opcion => ({
  clave: String(calle.id),
  nombre: calle.nombre,
});

const cualEs = (esquina: Esquina, calle: Calle): "A" | "B" =>
  esquina.calleA.id === calle.id ? "A" : "B";

export function BloqueDireccion({
  id,
  modo = "retiro",
  valor,
  onCambio,
  errors,
}: {
  id: string;
  modo?: ModoDireccion;
  valor: EstadoDireccion;
  onCambio: (estado: EstadoDireccion) => void;
  errors: Record<string, string>;
}) {
  const ubica = modo === "retiro";
  const [indice, setIndice] = useState<Indice | null>(null);
  const [indiceFallo, setIndiceFallo] = useState(false);
  const [calle, setCalle] = useState<Calle | null>(null);
  const [cruzada, setCruzada] = useState<Calle | null>(null);

  useEffect(() => {
    let vigente = true;
    cargarIndice()
      .then((i) => {
        if (vigente) setIndice(i);
      })
      .catch(() => {
        // Que el formulario lo diga. Mudo es fallar: la persona se queda
        // escribiendo en un campo que nunca le va a sugerir nada.
        if (vigente) setIndiceFallo(true);
      });
    return () => {
      vigente = false;
    };
  }, []);

  const buscarCalles = useCallback(
    (texto: string) => (indice ? buscarCalle(indice, texto).map(opcionDe) : []),
    [indice],
  );

  // Con la calle elegida, solo se ofrecen las que la cruzan de verdad (FR-009).
  // En entrega la calle puede no estar en el indice: ahi se cae a sugerir
  // cualquier calle, porque negarle sugerencias no ayudaria a nadie.
  const buscarCruces = useCallback(
    (texto: string) => {
      if (!indice) return [];
      if (calle) return buscarEsquinaDe(indice, calle, texto).map(opcionDe);
      return ubica ? [] : buscarCalle(indice, texto).map(opcionDe);
    },
    [indice, calle, ubica],
  );

  const calleDe = (opcion: Opcion): Calle | null =>
    indice?.calles[Number(opcion.clave)] ?? null;

  const actualizar = (parcial: Partial<Direccion>) =>
    onCambio({ ...valor, direccion: { ...valor.direccion, ...parcial } });

  /**
   * Escribir en calle o esquina invalida el punto, la zona, el precio y los
   * complementos (FR-013). Quedarse con el punto viejo mostraria un precio que
   * ya no corresponde a la direccion escrita.
   *
   * En entrega no hay nada que invalidar: no hay punto ni precio.
   */
  function reiniciarCon(parcial: Partial<Direccion>) {
    if (!ubica) {
      actualizar(parcial);
      return;
    }
    onCambio({
      ...ESTADO_DIRECCION_VACIO,
      direccion: { ...ESTADO_DIRECCION_VACIO.direccion, ...parcial },
    });
  }

  function alTipearCalle(texto: string) {
    setCalle(null);
    setCruzada(null);
    reiniciarCon({ calle: texto });
  }

  function alElegirCalle(opcion: Opcion) {
    setCalle(calleDe(opcion));
    setCruzada(null);
  }

  function alTipearEsquina(texto: string) {
    setCruzada(null);
    reiniciarCon({ calle: valor.direccion.calle, esquina: texto });
  }

  function alElegirCruzada(opcion: Opcion) {
    const otra = calleDe(opcion);
    setCruzada(otra);
    if (!ubica || !indice || !calle || !otra) return;

    const candidatos = buscarEsquina(indice, calle, otra);
    const base: Direccion = {
      ...ESTADO_DIRECCION_VACIO.direccion,
      calle: calle.nombre,
      esquina: otra.nombre,
    };

    if (candidatos.length === 1) {
      onCambio({
        direccion: { ...base, punto: candidatos[0].punto },
        esquina: candidatos[0],
        cualEsLaCalle: cualEs(candidatos[0], calle),
        candidatos: [],
      });
      return;
    }

    // Cero: el cruce no existe. Varios: elige la persona, nunca el sitio
    // (FR-021) — tomar el primero seria adivinar una zona, o sea un precio.
    onCambio({ direccion: base, esquina: null, cualEsLaCalle: "A", candidatos });
  }

  function elegirCandidato(esquina: Esquina) {
    if (!calle) return;
    onCambio({
      ...valor,
      direccion: { ...valor.direccion, punto: esquina.punto },
      esquina,
      cualEsLaCalle: cualEs(esquina, calle),
      candidatos: [],
    });
  }

  // En entrega los complementos estan siempre disponibles: no dependen de
  // ningun cruce resuelto porque no hay punto que resolver.
  const habilitado = !ubica || valor.esquina !== null;
  const hayQueElegir = ubica && valor.candidatos.length > 1;
  const cruceInexistente =
    ubica && cruzada !== null && !valor.esquina && valor.candidatos.length === 0;

  const motivo = habilitado
    ? undefined
    : "Se habilita cuando completes la calle y la esquina.";

  return (
    <div className="mt-3 flex flex-col gap-4">
      {indiceFallo && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {ubica
            ? "No podemos cargar el listado de calles en este momento, así que no podemos ubicar la dirección ni calcular el precio. Probá de nuevo en un rato, o escribinos y lo resolvemos."
            : "No podemos cargar el listado de calles, así que no vas a ver sugerencias. Escribí la dirección a mano: se envía igual."}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <CampoAutocompletado
          id={`${id}-calle`}
          label="Calle"
          valor={valor.direccion.calle}
          buscar={buscarCalles}
          onTexto={alTipearCalle}
          onElegir={alElegirCalle}
          deshabilitado={ubica && indiceFallo}
          error={errors.calle}
          placeholder="Empezá a escribir"
          ayuda={
            ubica
              ? "Elegí una de las sugerencias."
              : "Podés elegir una sugerencia o escribirla a mano."
          }
        />

        <CampoAutocompletado
          id={`${id}-esquina`}
          label="Esquina"
          valor={valor.direccion.esquina}
          buscar={buscarCruces}
          onTexto={alTipearEsquina}
          onElegir={alElegirCruzada}
          deshabilitado={ubica && (indiceFallo || !calle)}
          motivoDeshabilitado="Elegí primero la calle."
          error={errors.esquina}
          placeholder="La calle que cruza"
          ayuda={
            calle
              ? "Solo mostramos calles que cruzan la que elegiste."
              : undefined
          }
        />
      </div>

      {cruceInexistente && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          No encontramos el cruce de {valor.direccion.calle} y{" "}
          {cruzada?.nombre}. Revisá los nombres, o escribinos y lo resolvemos.
        </p>
      )}

      {hayQueElegir && (
        <fieldset className="rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-sm font-medium text-slate-700">
            Encontramos {valor.candidatos.length} cruces con ese nombre. ¿Cuál es
            el tuyo?
          </legend>
          <ul className="mt-1 flex flex-col gap-2">
            {valor.candidatos.map((candidato, i) => (
              <li key={`${candidato.punto.lat},${candidato.punto.lng}`}>
                <button
                  type="button"
                  onClick={() => elegirCandidato(candidato)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Opción {i + 1} — {candidato.calleA.nombre} y{" "}
                  {candidato.calleB.nombre}
                  <span className="ml-1 text-xs text-slate-400">
                    ({candidato.punto.lat.toFixed(4)},{" "}
                    {candidato.punto.lng.toFixed(4)})
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      {/*
        Numero, apto y cooperativa NO mueven el punto (FR-011): no hay dato de
        numeracion domiciliaria, asi que son informacion para el repartidor, no
        para ubicar. En retiro aparecen recien con el cruce resuelto.
      */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-numero`} className={labelClass}>
            Número de puerta
          </label>
          <input
            id={`${id}-numero`}
            className={inputClass}
            disabled={!habilitado}
            value={valor.direccion.numero}
            onChange={(e) => actualizar({ numero: e.target.value })}
            aria-describedby={`${id}-numero-ayuda`}
          />
          <p id={`${id}-numero-ayuda`} className="mt-1 text-xs text-slate-500">
            {motivo ?? "Para que el repartidor toque el timbre correcto."}
          </p>
          {errors.numero && (
            <p className="mt-1 text-xs font-medium text-red-600">
              {errors.numero}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={`${id}-apto`} className={labelClass}>
            Apto
            <span className="ml-1 text-xs font-normal text-slate-400">
              (opcional)
            </span>
          </label>
          <input
            id={`${id}-apto`}
            className={inputClass}
            disabled={!habilitado}
            value={valor.direccion.apto}
            onChange={(e) => actualizar({ apto: e.target.value })}
          />
        </div>

        <div>
          <span className={labelClass}>¿Es una cooperativa?</span>
          <div className="flex gap-3">
            {([true, false] as const).map((opcion) => (
              <button
                key={String(opcion)}
                type="button"
                disabled={!habilitado}
                aria-pressed={valor.direccion.cooperativa === opcion}
                onClick={() => actualizar({ cooperativa: opcion })}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  valor.direccion.cooperativa === opcion
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {opcion ? "Sí" : "No"}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
