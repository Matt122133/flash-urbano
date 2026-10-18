"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PanelIngreso } from "@/components/sesion/panel-ingreso";
import { useLlamadaAutenticada, useSesion } from "@/components/sesion/proveedor-sesion";
import { ErrorApi } from "@/lib/api";
import {
  filasDeEnvios,
  generadoEnMontevideo,
  nombreDeArchivo,
  rutaDelReporte,
  rutaDelReporteDeRepartidor,
  textoDelReporte,
  type RespuestaReporte,
} from "@/lib/reporte";
import {
  BAJADA_TOTAL,
  fechaEnMontevideo,
  resumir,
  resumirPorRepartidor,
  rotuloCliente,
  rotuloRepartidor,
  TEXTO_BAJAR_REPORTE,
  TEXTO_CLIENTE_SIN_PEDIDOS,
  TEXTO_CORTE,
  TEXTO_CORTE_REPARTIDOR,
  TEXTO_REPARTIDOR_SIN_ENTREGAS,
  TEXTO_REPARTIDORES,
  TEXTO_SIN_REPARTIDORES,
  motivoSinReporte,
  TEXTO_ELEGI_CUENTA,
  TEXTO_ERROR,
  TEXTO_ERROR_REPORTE,
  TEXTO_PERIODO_SIN_ENVIOS,
  TEXTO_REPORTE_NO_POR_DIA,
  TEXTO_SIN_PEDIDOS,
  TEXTO_SOLO_ADMINISTRACION,
  TEXTO_TOTAL,
  type Corte,
  type Fila,
  type Periodo,
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
/**
 * El limite de Suspense, y **no es decorativo**: `useSearchParams` —con el que
 * se recuerda la seccion elegida— hace fallar el build estatico sin uno. Es el
 * mismo motivo que en `app/perfil/page.tsx`. Va aca y no en la pagina para que
 * la pagina siga siendo de servidor, por su `metadata`.
 */
export function Tablero() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
          <div className={sectionClass}>
            <Esperando />
          </div>
        </div>
      }
    >
      <TableroConSesion />
    </Suspense>
  );
}

function TableroConSesion() {
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

/** Las dos secciones del tablero (`031`). Excluyentes, como las de Mi cuenta. */
type Vista = "clientes" | "repartidores";

const VISTAS: readonly { id: Vista; etiqueta: string }[] = [
  { id: "clientes", etiqueta: "Clientes" },
  { id: "repartidores", etiqueta: TEXTO_REPARTIDORES },
];

function Numeros({ datos }: { datos: RespuestaTablero }) {
  const router = useRouter();
  const parametros = useSearchParams();

  /**
   * La seccion, en la URL (`/tablero?ver=repartidores`), **igual que Mi
   * cuenta** (Mateo, 2026-10-18): recargar vuelve a donde estaba. Cualquier
   * otro valor cae en clientes, que es la de partida y no deja rastro.
   */
  const vista: Vista = parametros.get("ver") === "repartidores" ? "repartidores" : "clientes";

  /** Mismo patron que `irA` de `app/perfil/page.tsx`: `replace`, sin pisar otros parametros. */
  const irA = (id: Vista) => {
    const siguientes = new URLSearchParams(parametros.toString());
    if (id === "repartidores") siguientes.set("ver", "repartidores");
    else siguientes.delete("ver");
    const qs = siguientes.toString();
    router.replace(qs ? `/tablero?${qs}` : "/tablero", { scroll: false });
  };

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
  // El nombre de la cuenta elegida, para el pie del archivo. Vacio con "Todos",
  // que es justo cuando no hay descarga (FR-006a).
  const rotuloDeLaCuenta =
    datos.clientes.find((c) => c.id === clienteId)?.nombre?.trim() ||
    datos.clientes.find((c) => c.id === clienteId)?.email ||
    "";

  const hoy = fechaEnMontevideo(new Date().toISOString());
  const { registrados: total, filas } = resumir(datos.pedidos, {
    corte,
    hoy,
    clienteId: clienteId || undefined,
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-slate-900">Tablero</h1>

      {/* `aria-pressed`, como el resto de los conmutadores del sitio: ver el
          comentario de /perfil. */}
      <div className="flex gap-3">
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

      {/* **Las dos secciones quedan montadas** y solo se oculta la que no se
          ve: asi el corte y el cliente o repartidor elegidos no se pierden al
          ir y volver. Con clase y no con el atributo `hidden`, que la clase
          `flex` taparia. */}
      <div className={vista === "clientes" ? "flex flex-col gap-6" : "hidden"}>
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
          {motivoSinReporte(corte, clienteId) === "cuenta" && (
            <p className="mt-2 text-xs text-slate-500">{TEXTO_ELEGI_CUENTA}</p>
          )}
          {motivoSinReporte(corte, clienteId) === "corte" && (
            <p className="mt-2 text-xs text-slate-500">{TEXTO_REPORTE_NO_POR_DIA}</p>
          )}

          <Cuadro
            filas={filas}
            boton={(fila) => (
              <BotonReporte
                periodo={fila.periodo}
                corte={corte}
                clienteId={clienteId}
                cuenta={rotuloDeLaCuenta}
                hayEnvios={fila.pedidos > 0}
              />
            )}
          />
        </div>
      </div>

      <div className={vista === "repartidores" ? "block" : "hidden"}>
        <SeccionRepartidores datos={datos} />
      </div>
    </div>
  );
}

/**
 * El cuadro por periodo, comun a las dos secciones: lo que cambia es de donde
 * salen las filas y que reporte baja cada boton.
 */
function Cuadro({ filas, boton }: { filas: Fila[]; boton: (fila: Fila) => React.ReactNode }) {
  return (
    // La tabla es lo unico que puede ser mas ancho que un telefono, y desplaza
    // ella sola en vez de empujar la pagina.
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-600">
            <th scope="col" className="py-2 pr-4 font-medium">Período</th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">Pedidos</th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">Paquetes</th>
            <th scope="col" className="py-2 text-right font-medium">
              <span className="sr-only">Reporte</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.periodo.clave} className="border-b border-slate-100 last:border-0">
              <th scope="row" className="py-2 pr-4 text-left font-normal text-slate-800">
                {fila.periodo.rotulo}
              </th>
              <td className="py-2 pr-4 text-right tabular-nums text-slate-900">{fila.pedidos}</td>
              <td className="py-2 pr-4 text-right tabular-nums text-slate-900">{fila.paquetes}</td>
              <td className="py-2 text-right">{boton(fila)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * La seccion Repartidores (`031`): cuantos pedidos y paquetes **entrego** cada
 * repartidor por periodo, y su reporte por semana o mes.
 *
 * **Corta por la fecha de entrega, no por la de carga**, y lo dice en pantalla
 * (research D8): al repartidor se le paga por paquete entregado. Tiene su
 * propio corte y su propio selector: mirar a un repartidor no cambia lo que se
 * esta mirando en el cuadro de clientes.
 *
 * Siempre hay un repartidor elegido —el primero, al entrar—, asi que aca no
 * existe el "todos": el reporte de un repartidor se le pasa a esa persona.
 */
function SeccionRepartidores({ datos }: { datos: RespuestaTablero }) {
  const repartidores = datos.repartidores ?? [];
  const [corte, setCorte] = useState<Corte>("mes");
  const [elegido, setElegido] = useState("");

  // El elegido tiene que seguir en la lista; si no, el primero.
  const actual = repartidores.find((r) => r.email === elegido) ?? repartidores[0];

  if (actual === undefined) {
    return (
      <section>
        <p className="text-sm text-slate-600">{TEXTO_SIN_REPARTIDORES}</p>
      </section>
    );
  }

  const hoy = fechaEnMontevideo(new Date().toISOString());
  const { registrados: total, filas } = resumirPorRepartidor(datos.pedidos, {
    corte,
    hoy,
    repartidor: actual.email,
  });

  return (
    <section className="flex flex-col gap-4">

      <div>
        <label htmlFor="tablero-repartidor" className="block text-sm font-medium text-slate-700">
          Repartidor
        </label>
        <select
          id="tablero-repartidor"
          value={actual.email}
          onChange={(e) => setElegido(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        >
          {repartidores.map((r) => (
            <option key={r.email} value={r.email}>
              {rotuloRepartidor(r)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="text-sm font-medium text-slate-600">Pedidos entregados</p>
        <p className="mt-1 text-4xl font-bold tracking-tight text-slate-900">{total}</p>
        {total === 0 && <p className="mt-3 text-sm text-slate-600">{TEXTO_REPARTIDOR_SIN_ENTREGAS}</p>}
      </div>

      <div>
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
        <p className="mt-2 text-xs text-slate-500">{TEXTO_CORTE_REPARTIDOR}</p>
        {motivoSinReporte(corte, actual.email) === "corte" && (
          <p className="mt-2 text-xs text-slate-500">{TEXTO_REPORTE_NO_POR_DIA}</p>
        )}

        <Cuadro
          filas={filas}
          boton={(fila) => (
            <BotonReporte
              periodo={fila.periodo}
              corte={corte}
              clienteId=""
              repartidor={actual.email}
              cuenta={actual.nombre?.trim() || actual.email}
              hayEnvios={fila.pedidos > 0}
            />
          )}
        />
      </div>
    </section>
  );
}

/**
 * El boton que baja el reporte de UN periodo de UNA cuenta (`029`).
 *
 * **Uno por fila del cuadro, y no un selector de periodo aparte**: el cuadro ya
 * lista los periodos, asi que el mes que ves es el que te bajas. Sirve igual
 * para dia y semana sin una linea mas, y no le agrega un control a una pantalla
 * que ademas se va a rediseñar.
 *
 * **Sin cuenta elegida no se dibuja** (FR-006a). El archivo se le pasa al
 * cliente; el producto no produce uno mezclado por ningun camino, y un boton que
 * bajara algo distinto de lo que la pantalla muestra seria peor que ninguno.
 */
function BotonReporte({
  periodo,
  corte,
  clienteId,
  repartidor,
  cuenta,
  hayEnvios,
}: {
  periodo: Periodo;
  corte: Corte;
  clienteId: string;
  /** `031`: con un repartidor, baja lo que entrego en vez de lo de un cliente. */
  repartidor?: string;
  cuenta: string;
  hayEnvios: boolean;
}) {
  const llamar = useLlamadaAutenticada();
  const [estado, setEstado] = useState<"listo" | "bajando" | "error" | "vacio">("listo");

  // **Quien puede bajar el reporte lo decide `lib/tablero.ts`, no este
  // componente**: son dos reglas de producto —una cuenta por archivo, y nada
  // por dia— y ahi tienen prueba. Aca solo se dibuja o no se dibuja.
  if (motivoSinReporte(corte, repartidor ?? clienteId) !== null) return null;

  async function alTocar() {
    setEstado("bajando");
    try {
      const { pedidos } = await llamar<RespuestaReporte>(
        repartidor !== undefined
          ? rutaDelReporteDeRepartidor(repartidor, periodo.desde, periodo.hasta)
          : rutaDelReporte(clienteId, periodo.desde, periodo.hasta),
      );

      // FR-020: un periodo sin envios se dice, no se baja un archivo con solo
      // encabezados. El cuadro ya dice 0, pero el boton tiene que explicar por
      // que no paso nada al tocarlo.
      if (pedidos.length === 0) {
        setEstado("vacio");
        return;
      }

      const texto = textoDelReporte({
        filas: filasDeEnvios(pedidos),
        cuenta,
        deRepartidor: repartidor !== undefined,
        periodo: periodo.rotulo,
        generadoEl: generadoEnMontevideo(new Date()),
      });

      // `type` con charset y el BOM que ya trae el texto: las dos cosas juntas
      // son lo que hace que la planilla lea bien las tildes y la ñ.
      const url = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = nombreDeArchivo({
        filas: [],
        cuenta,
        deRepartidor: repartidor !== undefined,
        periodo: periodo.rotulo,
        generadoEl: "",
      });
      a.click();
      URL.revokeObjectURL(url);
      setEstado("listo");
    } catch (e: unknown) {
      // **Sin este catch el boton no haria nada visible** (FR-019), que es
      // indistinguible de un boton roto: la persona vuelve a tocar. Es el mismo
      // modo de falla que este repo ya pago en el boton de confirmar y en el de
      // imprimir.
      console.error("Fallo al armar el reporte:", e);
      setEstado("error");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={alTocar}
        disabled={estado === "bajando" || !hayEnvios}
        className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40"
      >
        {estado === "bajando" ? "Armando…" : TEXTO_BAJAR_REPORTE}
      </button>
      {estado === "error" && (
        <p role="alert" className="text-xs text-red-700">
          {TEXTO_ERROR_REPORTE}
        </p>
      )}
      {estado === "vacio" && <p className="text-xs text-slate-500">{TEXTO_PERIODO_SIN_ENVIOS}</p>}
    </div>
  );
}
