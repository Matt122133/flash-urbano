"use client";

import type { DireccionGuardada, PedidoGuardado } from "@/lib/api";

/**
 * Un pedido del historial: tarjeta resumida arriba, detalle al desplegar.
 *
 * **Es `<details>`/`<summary>` nativo y no un botón con estado propio.** El
 * teclado y el lector de pantalla salen correctos sin escribir un solo
 * `aria-expanded`, que es lo que pide FR-011a — y este repo ya sabe lo que
 * cuesta lo contrario: `003` tuvo que hacer a mano un combobox accesible para no
 * dejar afuera a quien ya podia pedir. Una tarjeta que solo se abre con el dedo
 * repetiria ese error en la pantalla nueva.
 */
export function TarjetaPedido({ pedido }: { pedido: PedidoGuardado }) {
  const estado = estadoVisible(pedido.estado);

  return (
    <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* `list-none` + `::-webkit-details-marker` sacan el triangulito nativo,
          que en un telefono se ve como suciedad al lado del codigo. La flecha
          propia de abajo cumple la misma funcion y rota al abrir. */}
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-slate-900">{pedido.codigo}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${estado.clase}`}
            >
              {estado.texto}
            </span>
          </div>
          {/* La fecha de RETIRO y no la de creacion: es la que la persona
              recuerda ("el envio del martes"). La de creacion va en el detalle. */}
          <p className="mt-1 text-sm text-slate-600">
            Retiro el {formatearFecha(pedido.retiroFecha)} a las {pedido.retiroHora}
          </p>
          {/* `truncate` y no un corte a mano: una calle larga no puede empujar
              el ancho de la tarjeta y obligar a desplazarse de costado (FR-011). */}
          <p className="mt-0.5 truncate text-sm text-slate-500">
            A {pedido.entrega.calle || "—"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* El precio que se COBRO, no el que corresponderia hoy (FR-005). */}
          <span className="font-semibold text-slate-900">$ {pedido.precio}</span>
          <svg
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </summary>

      <div className="border-t border-slate-100 px-4 py-4 text-sm">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Dato titulo="Retiro" valor={componer(pedido.retiro)} />
          <Dato titulo="Entrega" valor={componer(pedido.entrega)} />
          <Dato
            titulo="Paquete"
            valor={`${tamanoVisible(pedido.paqueteTamano)} · ${pedido.cantidad} ${
              pedido.cantidad === 1 ? "paquete" : "paquetes"
            }`}
          />
          <Dato
            titulo="Recibe"
            valor={`${pedido.destinatarioNombre} · ${pedido.destinatarioTelefono}`}
          />
        </dl>
        <p className="mt-4 text-xs text-slate-400">
          Cargado el {formatearInstante(pedido.creadoEn)}
        </p>
      </div>
    </details>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {titulo}
      </dt>
      {/* `break-words`: un texto largo sin espacios no puede ensanchar la
          tarjeta. Es la otra mitad de FR-011. */}
      <dd className="mt-0.5 break-words text-slate-700">{valor}</dd>
    </div>
  );
}

/**
 * El texto de una direccion guardada.
 *
 * No se reusa `componerDireccion()` de `lib/direccion.ts`: aquella toma la
 * `Direccion` del formulario, donde `numero` y `apto` son `string`, y aca llegan
 * **nulables** desde la base. Adaptar el tipo para reusar cuatro `join` seria mas
 * codigo que escribirlos, y dejaria a la funcion del formulario aceptando nulos
 * que ahi no existen.
 */
function componer(d: DireccionGuardada): string {
  return (
    [
      [d.calle, d.numero].filter(Boolean).join(" "),
      d.apto ? `apto ${d.apto}` : "",
      d.esquina ? `esq. ${d.esquina}` : "",
      d.cooperativa ? "cooperativa" : "",
    ]
      .filter(Boolean)
      .join(", ") || "—"
  );
}

/**
 * El estado, en castellano y sin prometer nada (FR-006).
 *
 * **"Pendiente" es lo unico honesto para `creacion`**, y hoy es lo que ve todo
 * el mundo: nada mueve esa columna hasta que exista la app Android. Se
 * descartaron "Recibido" y "En preparacion" — los dos afirman una accion de
 * Diego que no ocurrio, y es exactamente el error que FR-029 de `007` corrigio
 * en la pantalla de confirmacion.
 *
 * **Un valor desconocido se muestra crudo.** El servicio guarda `estado` como
 * texto con CHECK justamente porque la lista ya cambio una vez; inventar una
 * traduccion o romper la pantalla serian las dos formas malas de reaccionar.
 */
function estadoVisible(estado: string): { texto: string; clase: string } {
  switch (estado) {
    case "creacion":
      return { texto: "Pendiente", clase: "bg-slate-100 text-slate-600" };
    case "aceptacion":
      return { texto: "Aceptado", clase: "bg-blue-50 text-blue-700" };
    case "entrega":
      return { texto: "Entregado", clase: "bg-green-50 text-green-700" };
    default:
      return { texto: estado, clase: "bg-slate-100 text-slate-600" };
  }
}

/** Mismo criterio que el estado: lo conocido se traduce, lo demas se muestra. */
function tamanoVisible(tamano: string): string {
  switch (tamano) {
    case "chico":
      return "Chico";
    case "mediano":
      return "Mediano";
    case "grande":
      return "Grande";
    default:
      return tamano;
  }
}

/**
 * `2026-08-22` → `22/08/2026`.
 *
 * **Se parte el texto en vez de construir un `Date`**, y no es pereza:
 * `new Date("2026-08-22")` se interpreta como medianoche **UTC**, y en
 * Montevideo (UTC-3) eso muestra el dia anterior. Es el error de un dia que la
 * base evita guardando fecha y hora sueltas; repetirlo aca desharia esa
 * decision en la pantalla.
 */
function formatearFecha(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-");
  return dia && mes && anio ? `${dia}/${mes}/${anio}` : fecha;
}

/**
 * `creadoEn` si es un instante de verdad, asi que aca `Date` esta bien.
 *
 * Se formatea a mano y no con `toLocaleString` para que no dependa del idioma
 * del dispositivo: la pantalla esta en castellano y la fecha tiene que leerse
 * igual en un telefono configurado en ingles.
 */
function formatearInstante(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dosDigitos = (n: number) => String(n).padStart(2, "0");
  return (
    `${dosDigitos(d.getDate())}/${dosDigitos(d.getMonth() + 1)}/${d.getFullYear()}` +
    ` a las ${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`
  );
}
