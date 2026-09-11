"use client";

import { useEffect, useState } from "react";
import { PanelIngreso } from "@/components/sesion/panel-ingreso";
import { useLlamadaAutenticada, useSesion } from "@/components/sesion/proveedor-sesion";
import { ErrorApi } from "@/lib/api";
import {
  BAJADA_TOTAL,
  fechaEnMontevideo,
  resumir,
  rotuloCliente,
  TEXTO_CLIENTE_SIN_PEDIDOS,
  TEXTO_CORTE,
  TEXTO_ERROR,
  TEXTO_SIN_PEDIDOS,
  TEXTO_SOLO_ADMINISTRACION,
  TEXTO_TOTAL,
  type Corte,
  type RespuestaTablero,
} from "@/lib/tablero";

const sectionClass = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6";

const CORTES: readonly { id: Corte; etiqueta: string }[] = [
  { id: "dia", etiqueta: "Día" },
  { id: "semana", etiqueta: "Semana" },
  { id: "mes", etiqueta: "Mes" },
];

/** Al entrar desde el panel no hay a donde ir: el cambio de sesion re-renderiza. */
const nadaQueHacer = () => {};

/**
 * Lo que contesto el servicio, **atado a quien y a que intento lo pidio**.
 *
 * Guardar la clave junto con la respuesta es lo que evita mostrar la respuesta
 * de otra persona: si alguien sale y entra con otra cuenta, o toca *Reintentar*,
 * la clave cambia y lo guardado deja de valer sin que haga falta limpiarlo desde
 * un efecto — limpiar estado de forma sincronica al entrar a un efecto es lo que
 * el lint de React prohibe y lo que en `007` costo un remonte de mas.
 */
type Resultado =
  | { clave: string; tipo: "listo"; datos: RespuestaTablero }
  | { clave: string; tipo: "denegado" }
  | { clave: string; tipo: "error" };

/**
 * El tablero de Diego (`025`): tres numeros y un filtro, y ningun monto.
 *
 * Los seis estados de specs/025-dashboard-de-diego/contracts/tablero.md §2, en
 * el orden en que se deciden. **Lo que no hay es a proposito**: sin graficos,
 * sin tendencias, sin comparacion con el periodo anterior. Lo pidio Diego asi
 * (Principio III), y si al verlo pide mas, es la conversacion siguiente.
 *
 * **Vive en `components/tablero/` para que la guarda de `013`/`024` lo mire**:
 * esa guarda escanea `app/` y `components/`, y tiene un caso que falla si el
 * tablero sale de ahi. Es la pantalla con mas riesgo de traer plata, porque
 * "dashboard" es donde un total facturado parece natural.
 */
export function Tablero() {
  const { usuario, cargando } = useSesion();
  const llamar = useLlamadaAutenticada();
  const [resultado, setResultado] = useState<Resultado | null>(null);
  // Un contador y no un booleano: reintentar dos veces seguidas tiene que
  // volver a disparar el efecto. Mismo criterio que `historial.tsx`.
  const [intento, setIntento] = useState(0);

  const adentro = Boolean(usuario?.perfilCompleto);

  /**
   * `esAdmin` tiene tres valores, y **`undefined` pide** (research D7).
   *
   * Recien entrado, el usuario sale de la respuesta del ingreso, que no trae el
   * campo. Tratarlo como `false` le decia a Diego que no era administrador justo
   * despues de entrar (analyze C1). Con `undefined` se le pregunta al servicio,
   * y un 403 decide. Solo `false` —lo que contesto `/yo`— se ahorra la llamada.
   */
  const debePedir = adentro && usuario?.esAdmin !== false;
  const clave = `${usuario?.id ?? ""}:${intento}`;

  useEffect(() => {
    if (!debePedir) return;

    let vigente = true;

    // Solo se escribe el estado en las respuestas, nunca al entrar: ver el
    // comentario de `Resultado`.
    llamar<RespuestaTablero>("/admin/tablero")
      .then((datos) => {
        if (vigente) setResultado({ clave, tipo: "listo", datos });
      })
      .catch((e: unknown) => {
        if (!vigente) return;
        // Un 401 ya lo convirtio el hook en sesion vencida: la pantalla va a
        // caer sola en el panel de ingreso, que muestra el aviso.
        if (e instanceof ErrorApi && e.sesionInvalida) return;
        // **Un 403 no es un error: es la respuesta.** Es el camino normal de una
        // cuenta comun recien entrada, cuyo `esAdmin` todavia no se sabe.
        if (e instanceof ErrorApi && e.estado === 403) {
          setResultado({ clave, tipo: "denegado" });
          return;
        }
        setResultado({ clave, tipo: "error" });
      });

    // Cancelar aca es correcto porque el efecto SI vuelve a correr: no hay una
    // guarda de una-sola-vez que lo impida. Con una encima, cancelar colgaria la
    // pantalla para siempre — la leccion de `022` en `crear-pedido.tsx`.
    return () => {
      vigente = false;
    };
  }, [debePedir, llamar, clave]);

  const actual = resultado?.clave === clave ? resultado : null;

  let contenido: React.ReactNode;
  if (cargando) {
    contenido = <Esperando />;
  } else if (!usuario || !usuario.perfilCompleto) {
    // Sin sesion, o con el alta a medias: el panel resuelve las dos cosas ahi
    // mismo (D8). `/ingresar` devolveria al inicio al terminar, y Diego tendria
    // que volver a escribir la URL del tablero.
    contenido = (
      <PanelIngreso
        onListo={nadaQueHacer}
        titulo="Tablero"
        bajada="Ingresá con la cuenta de la administración."
        conSalidaACotizar={false}
      />
    );
  } else if (usuario.esAdmin === false || actual?.tipo === "denegado") {
    contenido = <p className="py-6 text-center text-sm text-slate-600">{TEXTO_SOLO_ADMINISTRACION}</p>;
  } else if (actual?.tipo === "error") {
    contenido = <ErrorDeCarga onReintentar={() => setIntento((n) => n + 1)} />;
  } else if (actual?.tipo === "listo") {
    contenido = <Numeros datos={actual.datos} />;
  } else {
    contenido = <Esperando />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <div className={sectionClass}>{contenido}</div>
    </div>
  );
}

function Esperando() {
  return <p className="py-6 text-center text-sm text-slate-500">Un momento…</p>;
}

/**
 * FR-016: si los datos no llegaron, se dice. **Nunca ceros en su lugar**: un
 * cero falso con aire de dato real es peor que un error visible.
 */
function ErrorDeCarga({ onReintentar }: { onReintentar: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <p className="text-sm text-red-700">{TEXTO_ERROR}</p>
      <button
        type="button"
        onClick={onReintentar}
        className="rounded-full border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
      >
        Reintentar
      </button>
    </div>
  );
}

function Numeros({ datos }: { datos: RespuestaTablero }) {
  /**
   * El corte elegido es estado del componente y no va a la URL (research D11):
   * FR-010 solo pide que sacar el filtro no lo pierda. **Mes por defecto**: la
   * pregunta que Diego hizo es "cuantos este mes".
   *
   * Cambiar de corte **no** vuelve a llamar al servicio (research D1): es
   * recalcular sobre lo que ya llego, sin un "cargando" ni un error posible.
   */
  const [corte, setCorte] = useState<Corte>("mes");

  /**
   * El cliente elegido, **separado del corte**: volver a "Todos" no toca el
   * corte (FR-010). "" es todos. Es la CUENTA (FR-009), por id.
   */
  const [clienteId, setClienteId] = useState("");

  // "Hoy" en Montevideo, calculado aca y pasado a la funcion pura: `resumir` no
  // mira el reloj, y por eso su prueba no depende del dia en que corre.
  const hoy = fechaEnMontevideo(new Date().toISOString());
  const { registrados: total, filas } = resumir(datos.pedidos, {
    corte,
    hoy,
    clienteId: clienteId || undefined,
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-slate-900">Tablero</h1>

      <div>
        <label htmlFor="tablero-cliente" className="block text-sm font-medium text-slate-700">
          Cliente
        </label>
        <select
          id="tablero-cliente"
          value={clienteId}
          onChange={(e) => setClienteId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        >
          <option value="">Todos los clientes</option>
          {datos.clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {rotuloCliente(c)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="text-sm font-medium text-slate-600">{TEXTO_TOTAL}</p>
        <p className="mt-1 text-4xl font-bold tracking-tight text-slate-900">{total}</p>
        <p className="mt-1 text-sm text-slate-500">{BAJADA_TOTAL}</p>
        {total === 0 && (
          <p className="mt-3 text-sm text-slate-600">
            {clienteId ? TEXTO_CLIENTE_SIN_PEDIDOS : TEXTO_SIN_PEDIDOS}
          </p>
        )}
      </div>

      <div className="border-t border-slate-100 pt-6">
        {/* `aria-pressed` y no el patron de pestañas de ARIA, igual que en
            /perfil: ese promete navegacion con flechas, y prometerla sin
            implementarla es peor que no usarlo. */}
        <div className="flex gap-2">
          {CORTES.map(({ id, etiqueta }) => (
            <button
              key={id}
              type="button"
              aria-pressed={corte === id}
              onClick={() => setCorte(id)}
              className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                corte === id
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">{TEXTO_CORTE}</p>

        {/* La tabla es lo unico que puede ser mas ancho que un telefono, y
            desplaza ella sola en vez de empujar la pagina. */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-600">
                <th scope="col" className="py-2 pr-4 font-medium">Período</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Pedidos</th>
                <th scope="col" className="py-2 text-right font-medium">Paquetes</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.periodo.clave} className="border-b border-slate-100 last:border-0">
                  <th scope="row" className="py-2 pr-4 text-left font-normal text-slate-800">
                    {fila.periodo.rotulo}
                  </th>
                  <td className="py-2 pr-4 text-right tabular-nums text-slate-900">{fila.pedidos}</td>
                  <td className="py-2 text-right tabular-nums text-slate-900">{fila.paquetes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
