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
 * Dos modos, y **se llaman por lo que hacen, no por la direccion que ocupan**:
 *
 * - `exigente`: de aca sale la zona, y la zona decide si el envio entra. Elegir
 *   de las sugerencias es obligatorio, el cruce se resuelve a un punto, y sin
 *   ese punto no se sigue. Con una calle homonima **pregunta cual**, porque
 *   tomar la primera seria adivinar una zona, o sea adivinar si llegamos.
 * - `oportunista`: el autocompletado es una **ayuda, no una puerta**. Lo tipeado
 *   vale aunque no este en el indice, no hay mapa, y **nunca bloquea nada**. Si
 *   el cruce resuelve solo, guarda el punto **en silencio**; si es ambiguo o no
 *   resuelve, sigue sin punto y sin decir nada.
 *
 * Hasta `010` se llamaban `retiro` y `entrega`, y estaban bien: la zona salia
 * del retiro. Desde `011` sale de la entrega
 * (docs/decisions/pricing-from-delivery-zone.md), asi que los nombres viejos
 * describirian al reves quien usa cada uno. **El nombre dice que hace, no donde
 * se usa**, para que la proxima inversion no vuelva a mentirle a quien lea.
 *
 * **`modo` no tiene valor por defecto, a proposito.** Lo tuvo, y era `retiro`:
 * dos de los tres consumidores vivian del default, asi que renombrar los modos
 * les habria cambiado el comportamiento sin que nadie lo pidiera. Obligatorio,
 * el compilador enumera los sitios y ninguno queda decidido por descarte.
 */

export type ModoDireccion = "exigente" | "oportunista";

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
  modo,
  valor,
  onCambio,
  errors,
}: {
  id: string;
  modo: ModoDireccion;
  valor: EstadoDireccion;
  onCambio: (estado: EstadoDireccion) => void;
  errors: Record<string, string>;
}) {
  const exigente = modo === "exigente";
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
      return exigente ? [] : buscarCalle(indice, texto).map(opcionDe);
    },
    [indice, calle, exigente],
  );

  const calleDe = (opcion: Opcion): Calle | null =>
    indice?.calles[Number(opcion.clave)] ?? null;

  const actualizar = (parcial: Partial<Direccion>) =>
    onCambio({ ...valor, direccion: { ...valor.direccion, ...parcial } });

  /**
   * Escribir en calle o esquina invalida el punto, la zona y los complementos
   * (FR-013). Quedarse con el punto viejo diria que llegamos a una direccion
   * que no es la escrita.
   *
   * **El modo oportunista tambien tiene punto que invalidar, desde `011`.** Se
   * resolvio en silencio, y si la calle cambia deja de corresponder: un punto
   * viejo pegado a una direccion nueva es exactamente el dato que despues manda
   * al repartidor a otro lado. Lo que NO se limpia ahi son los complementos
   * —numero, apto, cooperativa—, que en este modo nunca dependieron de un cruce
   * resuelto.
   */
  function reiniciarCon(parcial: Partial<Direccion>) {
    if (!exigente) {
      onCambio({
        ...valor,
        direccion: { ...valor.direccion, ...parcial, punto: null },
        esquina: null,
        candidatos: [],
      });
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
    // **Los dos modos resuelven el cruce desde `011`**; lo que cambia es que
    // hacen cuando no pueden. Antes el modo no exigente ni lo intentaba.
    if (!indice || !calle || !otra) return;

    const candidatos = buscarEsquina(indice, calle, otra);
    // El modo exigente vacia los complementos al elegir cruce (FR-013). El
    // oportunista los conserva: nunca dependieron del cruce.
    const base: Direccion = {
      ...(exigente ? ESTADO_DIRECCION_VACIO.direccion : valor.direccion),
      calle: calle.nombre,
      esquina: otra.nombre,
      punto: null,
    };

    if (candidatos.length === 1) {
      // Un solo cruce posible: se guarda el punto. En modo oportunista esto
      // pasa **en silencio** — nadie eligio nada y no se muestra nada.
      onCambio({
        direccion: { ...base, punto: candidatos[0].punto },
        esquina: candidatos[0],
        cualEsLaCalle: cualEs(candidatos[0], calle),
        candidatos: [],
      });
      return;
    }

    // Cero candidatos: el cruce no existe. Varios: es una calle homonima, de
    // las ~50 familias que tiene Montevideo.
    //
    // **Que se hace con varios depende del modo, y es la decision de FR-014**:
    //
    //   - `exigente` los ofrece para que elija la persona, **nunca el sitio**
    //     (FR-021). Ahi el punto decide admision: tomar el primero seria
    //     adivinar una zona, o sea adivinar si el envio entra.
    //   - `oportunista` **no pregunta y se queda sin punto**. Sin punto no hay
    //     punto equivocado, y preguntar por una direccion que no decide nada es
    //     friccion sobre la propia casa de quien envia a cambio de nada.
    onCambio({
      direccion: base,
      esquina: null,
      cualEsLaCalle: "A",
      candidatos: exigente ? candidatos : [],
    });
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
  const habilitado = !exigente || valor.esquina !== null;
  const hayQueElegir = exigente && valor.candidatos.length > 1;
  const cruceInexistente =
    exigente && cruzada !== null && !valor.esquina && valor.candidatos.length === 0;

  const motivo = habilitado
    ? undefined
    : "Se habilita cuando completes la calle y la esquina.";

  return (
    <div className="mt-3 flex flex-col gap-4">
      {indiceFallo && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {exigente
            ? "No podemos cargar el listado de calles en este momento, así que no podemos ubicar la dirección ni confirmar que llegamos hasta ahí. Probá de nuevo en un rato, o escribinos y lo resolvemos."
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
          deshabilitado={exigente && indiceFallo}
          error={errors.calle}
          placeholder="Empezá a escribir"
          ayuda={
            exigente
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
          deshabilitado={exigente && (indiceFallo || !calle)}
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
        para ubicar. En modo exigente aparecen recien con el cruce resuelto.
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
