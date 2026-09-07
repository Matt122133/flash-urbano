// Que pedidos del historial pasan el filtro. Sin React y sin red.
//
// **Vive en `lib/` por una sola razon, y es la que importa en este repo: es lo
// unico que se puede probar solo.** `vitest.config.ts` corre `lib/**/*.test.ts`
// en entorno `node`, y no hay ninguna infraestructura para probar componentes —
// es una fila `High` del tracker desde el 2026-08-22, que nombra a
// `historial.tsx` como una de las tres pantallas sin cobertura. Lo que quede
// adentro del componente no lo mira ninguna prueba.
//
// Es el mismo reparto que `010` hizo con `lib/repetir.ts`: la decision aca, el
// dibujo alla.

import type { PedidoGuardado } from "./api";
import { normalizar } from "./direcciones";

/**
 * Los cuatro cortes, **con el vocabulario de la pantalla y no el de la base**.
 *
 * La columna `estado` guarda `creacion | aceptacion | entrega`; la persona lee
 * "pendiente", "aceptado" y "entregado". El corte usa lo segundo porque **es lo
 * que viaja en la URL** (`?estado=pendientes`), y una URL la lee gente: que diga
 * `creacion` seria filtrar el historial con el nombre interno de una columna.
 *
 * La traduccion vive aca abajo, en un solo lugar y con pruebas.
 */
export type CorteEstado = "todos" | "pendientes" | "aceptados" | "entregados";

/** Que estado guardado le corresponde a cada corte. `todos` no filtra nada. */
const ESTADO_DEL_CORTE: Record<Exclude<CorteEstado, "todos">, string> = {
  pendientes: "creacion",
  aceptados: "aceptacion",
  entregados: "entrega",
};

export type Filtro = {
  estado: CorteEstado;
  /** Lo que la persona escribio. Vacio es "no filtres por texto". */
  texto: string;
};

/** Sin filtro: lo que la pantalla muestra antes de que nadie toque nada. */
export const SIN_FILTRO: Filtro = { estado: "todos", texto: "" };

const CORTES: readonly CorteEstado[] = ["todos", "pendientes", "aceptados", "entregados"];

/**
 * El corte que dice la URL.
 *
 * **Un valor desconocido es `todos`, nunca una lista vacia.** La URL la escribe
 * cualquiera —a mano, o un link viejo despues de que cambie esta lista— y la
 * respuesta segura a "no se que es esto" es mostrar todo. Esconder pedidos por
 * un parametro que no se entiende es la forma de que alguien crea que los
 * perdio.
 */
export function corteDesdeUrl(valor: string | null): CorteEstado {
  return CORTES.includes(valor as CorteEstado) ? (valor as CorteEstado) : "todos";
}

/** Hay algo puesto: sirve para decidir si se muestra el conteo y el aviso. */
export function hayFiltro(filtro: Filtro): boolean {
  return filtro.estado !== "todos" || filtro.texto.trim() !== "";
}

/**
 * Los digitos de un texto, para comparar codigos.
 *
 * `FU-0142` se busca escribiendo `142`, `fu-0142` o `FU-0142` (FR-003), y las
 * tres cosas se resuelven comparando **solo los digitos**: `0142` contiene
 * `142`. Comparar el texto entero obligaria a escribir el prefijo y los ceros.
 */
function digitos(s: string): string {
  return s.replace(/\D/g, "");
}

/**
 * Si el pedido coincide con lo que se escribio.
 *
 * **Mira dos campos y nada mas: el codigo y el nombre de quien recibe** (FR-002).
 *
 * Las direcciones quedan afuera **por decision de Mateo del 2026-09-06**, tomada
 * en contra de la recomendacion: el dato ya viaja en la respuesta, asi que no es
 * una cuestion de costo — una calle aparece en muchos pedidos y ensuciaria los
 * resultados. Esta escrito para que el proximo que lo lea no lo "arregle".
 *
 * **Ningun campo de plata participa, y no puede participar** (Principio V): no
 * se puede buscar ni ordenar por un monto que el producto ni siquiera muestra.
 */
function coincideElTexto(pedido: PedidoGuardado, texto: string): boolean {
  const q = normalizar(texto);
  if (!q) return true;

  if (normalizar(pedido.destinatarioNombre).includes(q)) return true;
  if (normalizar(pedido.codigo).includes(q)) return true;

  const d = digitos(q);
  return d !== "" && digitos(pedido.codigo).includes(d);
}

/**
 * Los pedidos que pasan el filtro, **en el mismo orden en que entraron**.
 *
 * El orden lo pone el servicio (`creado_en DESC`) y no se toca: filtrar quita,
 * no reordena (FR-009). Es la misma disciplina que `historial.tsx` ya tenia
 * escrita para la lista sin filtrar.
 */
export function filtrarPedidos(
  pedidos: readonly PedidoGuardado[],
  filtro: Filtro,
): PedidoGuardado[] {
  return pedidos.filter((p) => {
    if (filtro.estado !== "todos" && p.estado !== ESTADO_DEL_CORTE[filtro.estado]) {
      return false;
    }
    return coincideElTexto(p, filtro.texto);
  });
}
