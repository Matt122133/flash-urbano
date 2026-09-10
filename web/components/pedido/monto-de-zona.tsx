// **El unico archivo de `app/` o `components/` autorizado a nombrar un monto.**
//
// `web/lib/sin-precio-a-la-vista.test.ts` escanea `app/` y `components/` enteros
// y exceptua esta ruta, y solo esta. La excepcion es por ARCHIVO y no por region
// a proposito: si en cambio se hubiera exceptuado `pedido-form.tsx` —mil lineas—
// la guarda habria autorizado tambien un total, un resumen previo o una linea de
// precio suelta, que es exactamente lo que FR-007a prohibe.
//
// Esa misma guarda verifica que este componente sea importado por EXACTAMENTE UN
// archivo. Sin eso, la excepcion autoriza un archivo que despues se puede colgar
// de cualquier pantalla y el monto se escapa del bloque de la zona sin que nada
// se ponga en rojo.
//
// **No decide nada.** Si el monto se muestra o no lo resolvio
// `lib/precio-visible.ts`, que es puro y tiene pruebas. Aca solo se dibuja.
//
// **Por que se llama `MontoDeZona` y no `PrecioDeZona`, que era el nombre del
// plan**: la guarda escanea tambien los strings, y su patron es `/precio/i`. Un
// `import { PrecioDeZona } from "@/components/pedido/precio-de-zona"` en
// `pedido-form.tsx` la habria puesto en rojo por el nombre y por la ruta. La
// excepcion por archivo no alcanza cuando el archivo que lo USA tambien lo
// nombra. O sea que la guarda obliga a que el precio sea innombrable fuera de
// aca, y eso resulto ser una propiedad util y no un estorbo: por eso este
// archivo importa `precioVisible` el mismo, en vez de recibir el numero ya
// calculado desde el formulario.
//
// Ver specs/024-precio-detras-del-login/contracts/bloque-de-zona.md.

import { precioVisible } from "@/lib/precio-visible";
import type { Zona } from "@/lib/zonas";

/** Pesos uruguayos, sin decimales y con separador de miles: `$ 1.200`. */
const FORMATO = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 });

export function MontoDeZona({
  zona,
  conSesion,
}: {
  zona: Zona | null;
  conSesion: boolean;
}) {
  const monto = precioVisible({ zona, conSesion });

  // Sin sesion, o sin zona resuelta, no hay nada que dibujar — y no hay nada en
  // su lugar tampoco: ni invitacion a entrar, ni cifra tapada, ni mencion de que
  // exista un precio (FR-013). El visitante ve la confirmacion de cobertura y
  // nada mas, igual que desde `013`.
  if (monto === null) return null;

  return (
    <p className="mt-1 text-sm font-semibold text-emerald-900">
      $ {FORMATO.format(monto)}{" "}
      {/* "por envio" y no "por paquete": el monto es fijo por zona y no se
          multiplica por la cantidad. Como el formulario pregunta cuantos
          paquetes, sin esta palabra el numero se lee como unitario. Se aclara
          con la palabra y NO con un total, que FR-007a prohibe. */}
      <span className="font-normal text-emerald-800">por envío</span>
    </p>
  );
}
