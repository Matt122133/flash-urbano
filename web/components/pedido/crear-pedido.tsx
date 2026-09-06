"use client";

// Compone el formulario de pedido con lo que necesita para llegar al servicio.
//
// **Este archivo existe para poder importar el cliente del API.** El formulario
// no puede: `components/pedido-form.tsx` es una de las ENTRADAS de
// `lib/cotizar-abierto.test.ts`, la guarda que verifica que cotizar no dependa
// del servicio (FR-001, FR-002, FR-004). Importarlo alla pondria esa guarda en
// rojo, con razon.
//
// Asi que la dependencia se invierte: el formulario declara que necesita
// (`onConfirmar`) y esto decide como se cumple. El formulario queda probable sin
// red y sin sesion, y la pieza que habla con el servicio queda aislada en un
// archivo cuyo trabajo es exactamente ese. Ver research D1.
//
// La guarda tiene un control positivo que afirma que ESTE archivo si alcanza
// `lib/api.ts`. Sin el, borrar el envio entero dejaria la prueba en verde.

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  ESTADO_DIRECCION_VACIO,
  type EstadoDireccion,
} from "@/components/bloque-direccion";
import { DialogoIngreso } from "@/components/pedido/dialogo-ingreso";
import {
  PedidoForm,
  type FormState,
  type ResultadoConfirmacion,
} from "@/components/pedido-form";
import { useSesion } from "@/components/sesion/proveedor-sesion";
import { rehidratarRetiro } from "@/components/sesion/rehidratar-retiro";
import {
  ErrorApi,
  crearPedido,
  editarPedido,
  misPedidos,
  type PedidoGuardado,
} from "@/lib/api";
import { armarCuerpoPedido, claveDeIntento, type DatosDelPedido } from "@/lib/pedido";
import {
  camposDelPedido,
  entregaParaRehidratar,
} from "@/lib/repetir";
import { credencial } from "@/lib/sesion";

/**
 * Lo que la precarga le entrega al formulario.
 *
 * Los tres campos van juntos siempre —en vez de una union por estado— para que
 * quien la consume no tenga que estrechar el tipo antes de leer `inicial`.
 */
type Precarga = {
  /** Falso mientras no se sepa que precargar: el formulario todavia no se monta. */
  listaLaPrecarga: boolean;
  inicial?: Partial<FormState>;
  avisoDelPunto: string | null;
  /** Por que no se pudo repetir: id que no existe, sin sesion, servicio caido. */
  avisoDeRepeticion: string | null;
  /**
   * **El id que se esta editando, o `null` si se esta creando** (`022`).
   *
   * Viaja ACA y no se deduce despues volviendo a leer `?editar=` de la URL, y esa
   * es la mitad del feature que se olvida. La decision de que precargar y la de
   * a donde guardar **son la misma decision**, tomada una sola vez: si se leyera
   * la URL dos veces, las dos lecturas podrian discrepar y el formulario
   * guardaria sobre el pedido equivocado — sin que en pantalla se vea nada raro.
   */
  editando: string | null;
};

/** La respuesta mientras no se sepa. Constante: no hay nada que decidir. */
const ESPERANDO: Precarga = {
  listaLaPrecarga: false,
  avisoDelPunto: null,
  avisoDeRepeticion: null,
  editando: null,
};

/** Lo que se le entrega al formulario cuando no hay nada que precargar. */
const SIN_PRECARGA: Precarga = {
  listaLaPrecarga: true,
  avisoDelPunto: null,
  avisoDeRepeticion: null,
  editando: null,
};

/** Traduce lo que junto el formulario a lo que el mapeo puro espera. */
function aDatos(form: FormState): DatosDelPedido {
  return {
    nombre: form.name,
    telefono: form.phone,
    retiro: form.retiro.direccion,
    entrega: form.entrega.direccion,
    // DOS VALORES FIJOS, puestos por `014` el 2026-08-30. El formulario dejo de
    // preguntar el tamaño y la hora (decision del cliente), pero el servicio
    // los sigue exigiendo: `paquete_tamano` es NOT NULL con un CHECK y
    // `retiro_hora` es `time NOT NULL`, con un indice encima.
    //
    // **Se eligio esto en vez de tocar el backend a proposito.** Hacer las
    // columnas opcionales es una migracion sobre una tabla que ya tiene los
    // pedidos reales de Diego, y el 2026-08-12 una migracion de esa misma tabla
    // tumbo produccion. Ver specs/014-campos-en-pausa/research.md D3.
    //
    // `"chico"` no se eligio por gusto: **es el respaldo que esta misma linea ya
    // usaba** cuando el campo venia vacio, asi que nada cambia de
    // comportamiento. `"16:00"` es la hora a la que pasa Diego.
    //
    // **Los dos son datos que dejan de ser verdad**, igual que `precio` despues
    // de `013`: registran el valor fijo, no lo que alguien eligio. La
    // constitucion 5.1.0 prohibe leer esas columnas para decidir nada.
    //
    // AL REPONER los campos hay que revertir estas dos lineas **ademas** de
    // descomentar los bloques de `pedido-form.tsx`. Si se descomenta el campo y
    // esto queda, el formulario pregunta y el pedido viaja con `chico` igual —
    // que es el modo de falla mas probable de la reposicion.
    tamano: "chico",
    cantidad: form.quantity,
    fecha: form.pickupDate,
    hora: "16:00",
    destinatarioNombre: form.receiverName,
    destinatarioTelefono: form.receiverPhone,
  };
}

const SIN_RESPUESTA =
  "No pudimos crear el pedido: el servicio no responde. Lo que cargaste sigue acá, probá de nuevo en un momento.";

export function CrearPedido({ encabezado }: { encabezado?: React.ReactNode }) {
  /**
   * Si ya hay un pedido confirmado en pantalla (FR-034).
   *
   * Vive aca y no en el formulario porque el encabezado lo renderiza la
   * PANTALLA: `app/pedido/page.tsx` lo pasa como prop y esta composicion decide
   * si mostrarlo. El formulario no lo conoce, y no tiene por que.
   */
  const [creado, setCreado] = useState(false);
  /**
   * La clave del INTENTO de envio en curso.
   *
   * Un `useRef` y no un estado: cambiarla no tiene que redibujar nada. Se genera
   * al primer intento y **se conserva entre reintentos y a traves del ingreso**,
   * que es lo que hace que un doble toque o la reanudacion posterior a la puerta
   * lleguen al mismo pedido en vez de crear dos (FR-016).
   *
   * Se descarta recien cuando un pedido se creo: a partir de ahi, el proximo
   * envio es un pedido nuevo y merece una clave nueva.
   */
  const claveDelIntento = useRef<string | null>(null);

  const [dialogoAbierto, setDialogoAbierto] = useState(false);

  /**
   * Como `onConfirmar` ESPERA a que la persona termine de ingresar.
   *
   * El diálogo es declarativo —se abre con un estado— pero el envio es una
   * funcion asincrona que necesita saber cuando termino. Se guarda el `resolve`
   * de una promesa y lo llaman los handlers del dialogo. Es el puente entre las
   * dos formas, y sin el la reanudacion automatica de FR-007a no se puede
   * escribir sin llenar el componente de estados intermedios.
   */
  const esperandoIngreso = useRef<((entro: boolean) => void) | null>(null);

  // **La precarga se resuelve ANTES de definir el envio, y ese orden importa.**
  // `editando` sale de aca y `onConfirmar` lo necesita para decidir entre crear y
  // corregir. Leerlo de la URL adentro del envio seria la segunda lectura que
  // este feature existe para evitar.
  const {
    inicial,
    listaLaPrecarga,
    avisoDelPunto,
    avisoDeRepeticion,
    editando,
  } = usePrecarga();

  const pedirIngreso = useCallback((): Promise<boolean> => {
    setDialogoAbierto(true);
    return new Promise<boolean>((resolve) => {
      esperandoIngreso.current = resolve;
    });
  }, []);

  const cerrarDialogo = useCallback((entro: boolean) => {
    setDialogoAbierto(false);
    const resolver = esperandoIngreso.current;
    esperandoIngreso.current = null;
    resolver?.(entro);
  }, []);

  const onConfirmar = useCallback(
    async (form: FormState): Promise<ResultadoConfirmacion> => {
      const armado = armarCuerpoPedido(aDatos(form));
      if (!armado.ok) {
        // Los dos motivos deberian estar filtrados por la validacion del
        // formulario. Que igual se traduzcan a un mensaje —en vez de a un
        // throw— es lo que evita una pantalla rota si alguna vez no lo estan.
        return {
          estado: "error",
          mensaje:
            armado.motivo === "fuera-de-zona"
              ? "Ese punto queda fuera de nuestra zona de cobertura. Escribinos y vemos cómo darte una mano."
              : "Marcá el punto de retiro antes de confirmar.",
        };
      }

      if (!claveDelIntento.current) {
        // No es `crypto.randomUUID()` directo a proposito: esa funcion solo
        // existe en contexto seguro y desaparece al probar desde un telefono
        // sobre http. Ver `claveDeIntento` en lib/pedido.ts.
        claveDelIntento.current = claveDeIntento();
      }
      const clave = claveDelIntento.current;

      // FR-003 y FR-006: la puerta esta ACA, en el ultimo paso, y no antes.
      // Todo lo de arriba —cargar la direccion, ubicar el punto— ocurrio
      // sin pedirle nada a nadie.
      if (!credencial()) {
        if (!(await pedirIngreso())) {
          // FR-008: desistir no es un error y no creo nada. La clave se
          // conserva: si vuelve a intentar, es el mismo pedido.
          return { estado: "cancelado" };
        }
      }

      // Un solo reintento, y solo despues de un ingreso. Sin el tope, un 401
      // persistente —una credencial que el servicio rechaza siempre— dejaria a
      // la persona en un bucle de dialogos que se reabren solos.
      for (let intento = 0; intento < 2; intento++) {
        try {
          // **Editar o crear se decide con lo que trajo la precarga**, no
          // volviendo a leer la URL: es lo que impide que dos lecturas
          // discrepen y el guardado termine en el pedido equivocado.
          const pedido = editando
            ? await editarPedido(editando, armado.cuerpo, credencial())
            : await crearPedido(armado.cuerpo, clave, credencial());
          // Creado: el proximo envio es otro pedido y necesita otra clave.
          claveDelIntento.current = null;
          setCreado(true); // FR-034: con esto se retira el encabezado.
          return { estado: "creado", codigo: pedido.codigo };
        } catch (e) {
          if (!(e instanceof ErrorApi)) {
            return {
              estado: "error",
              mensaje: "No pudimos crear el pedido. Probá de nuevo.",
            };
          }
          if (e.sinRespuesta) {
            // SC-013: se dice la verdad —el pedido NO se creo— y lo cargado
            // sigue en pantalla. La clave se conserva.
            return { estado: "error", mensaje: SIN_RESPUESTA };
          }
          // FR-009: una sesion vencida se comporta igual que no tener sesion. Se
          // abre la puerta y se reanuda, en vez de mostrar un error que la
          // persona no puede resolver desde el formulario.
          if (e.sesionInvalida && intento === 0) {
            if (!(await pedirIngreso())) {
              return { estado: "cancelado" };
            }
            continue;
          }
          return { estado: "error", mensaje: e.message };
        }
      }

      return { estado: "error", mensaje: SIN_RESPUESTA };
    },
    [pedirIngreso, editando],
  );


  // El formulario se monta recien cuando la precarga se resolvio.
  //
  // No es prolijidad: `PedidoForm` toma `inicial` UNA vez, al montarse. Montarlo
  // antes y llenarlo despues exigiria rehidratarlo desde afuera —lo que hoy no
  // sabe hacer— o pisar lo que la persona ya escribio, que es justo lo que
  // FR-007 prohibe.
  if (!listaLaPrecarga) {
    // El encabezado va TAMBIEN en esta rama, y no es un detalle: es la que se
    // pre-renderiza al construir el sitio —ahi `cargando` siempre es true— y si
    // el titulo no estuviera aca, el HTML que lee un buscador no tendria `h1`.
    return (
      <>
        {encabezado}
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          Un momento…
        </p>
      </>
    );
  }

  return (
    <>
      {/* FR-034: con el pedido hecho queda solo el comprobante. El titulo y la
          instruccion de escribir la calle invitarian a hacer algo que se acaba
          de hacer. */}
      {!creado && encabezado}
      {/* Eran tres avisos hasta `013`; el de reajuste de precio se fue con el
          precio (FR-007). Los dos que quedan pueden convivir, y esta bien que
          convivan: son hechos distintos y la persona tiene que enterarse de los
          dos. */}
      {avisoDeRepeticion && (
        // No se pudo repetir. El formulario queda vacio y utilizable igual: quien
        // llego hasta aca queria mandar un paquete (contracts/pantallas.md §1).
        <p className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {avisoDeRepeticion}
        </p>
      )}
      {avisoDelPunto && (
        // FR-022. No se manda a nadie en silencio a un punto que ya no
        // corresponde: se recoloco en el cruce y se pide que lo revise.
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {avisoDelPunto}
        </p>
      )}
      <PedidoForm
        onConfirmar={onConfirmar}
        editando={Boolean(editando)}
        inicial={inicial}
        onReiniciar={() => setCreado(false)}
      />
      <DialogoIngreso
        abierto={dialogoAbierto}
        onListo={() => cerrarDialogo(true)}
        onCancelar={() => cerrarDialogo(false)}
      />
    </>
  );
}

/**
 * Lo que el perfil ya sabe, listo para precargar el formulario (FR-023).
 *
 * Es el valor que `006` prometio y todavia no entregaba: la respuesta concreta a
 * "¿para que me registro?".
 *
 * **Solo corre al montar.** Si la persona se identifica DESPUES —desde el
 * dialogo, a mitad de formulario— la precarga no vuelve a correr, y es
 * deliberado: FR-007 prohibe que identificarse le reescriba una direccion que
 * acaba de tipear. El valor de la precarga es ahorrar tipeo, no imponerlo.
 *
 * **2026-08-14 — esa promesa era falsa, y la encontro T039.** El efecto no
 * volvia a correr, es cierto, pero eso no alcanzaba: quien entraba por el
 * dialogo pasaba de `usuario: null` a tener sesion CON direccion guardada, y
 * entonces la rama derivada de abajo devolvia `listaLaPrecarga: false` mientras
 * se rehidrataba. Eso **desmonta `PedidoForm`**, y al volver se monta de cero
 * con el `inicial` del perfil — o sea que todo lo tipeado se perdia y quedaba
 * pisado por la direccion guardada. Justo lo que FR-007 prohibe, por un camino
 * que nadie miro: no "la precarga corre dos veces" sino "el formulario se monta
 * dos veces".
 *
 * Por eso hoy la decision **se congela**: apenas hay algo que entregarle al
 * formulario, ese valor queda fijo y ninguna sesion posterior lo cambia. La
 * garantia deja de depender de que un efecto no vuelva a dispararse.
 *
 * No lo cubre ninguna prueba automatica: `web/` corre en entorno `node` sin DOM
 * y nada de este repo renderiza React. Esta anotado en el tracker.
 */
function usePrecarga(): Precarga {
  const { usuario, cargando } = useSesion();

  /**
   * Que pedido repetir, si se llego por el historial (`/pedido?repetir=<id>`).
   *
   * Viaja por la URL y no por memoria ni por almacenamiento, y las tres partes
   * de esa decision importan (research D1): por memoria se pierde al recargar,
   * y en `sessionStorage` quedaria escrito **el nombre y el telefono de quien
   * recibe** —un tercero que no consintio nada— en el disco de un telefono que
   * puede ser compartido, que es lo que FR-021 prohibe. Un uuid solo no dice
   * nada de nadie, y no autoriza nada: el pedido se busca en la lista PROPIA.
   *
   * `useSearchParams` obliga a un limite de Suspense en la pantalla: sin el, el
   * build estatico falla. Ver `app/pedido/page.tsx`.
   */
  const parametros = useSearchParams();
  const idARepetir = parametros.get("repetir");

  /**
   * Que pedido editar, si se llego por el historial (`/pedido?editar=<id>`).
   *
   * **La TERCERA fuente de precarga**, y la mas peligrosa de las tres: repetir y
   * el perfil arrancan un pedido nuevo, pero esta tiene que terminar en un
   * guardado sobre uno existente. Si las fuentes se mezclaran, el modo de falla
   * no seria un campo raro — seria **guardar sobre el pedido equivocado**.
   *
   * Mismas tres propiedades que `?repetir=`: viaja por la URL, es un uuid que no
   * dice nada de nadie, y no autoriza nada —el pedido se busca en la lista
   * PROPIA, y el servicio ademas acota por dueño y por estado en el UPDATE.
   */
  const idAEditar = parametros.get("editar");

  /**
   * La decision ENTERA, tomada una sola vez.
   *
   * Antes del 2026-08-14 solo la rama asincrona vivia en estado y los otros tres
   * casos se derivaban en cada render. Eso era el defecto: derivar significa
   * volver a mirar la sesion, y la sesion cambia cuando alguien entra por el
   * dialogo. Con todo adentro del estado, lo que se decidio al montar es lo que
   * queda.
   */
  const [precarga, setPrecarga] = useState<Precarga | null>(null);

  // Corre una sola vez, apenas se sabe si hay sesion. Si la persona se identifica
  // DESPUES —desde el dialogo, a mitad de formulario— este efecto vuelve a
  // dispararse y sale por `yaCorrio`: FR-007 prohibe que identificarse le
  // reescriba algo que acaba de tipear.
  const yaCorrio = useRef(false);
  const retiro = usuario?.retiro ?? null;
  const nombre = usuario?.nombre ?? "";
  const telefono = usuario?.telefono ?? "";

  useEffect(() => {
    if (cargando || yaCorrio.current) return;
    yaCorrio.current = true;

    let vigente = true;

    // Todo cuelga de una promesa ya resuelta, igual que en `proveedor-sesion`:
    // el lint prohibe llamar a setState de forma sincrona dentro de un efecto.
    // Aca aplica a los dos casos que se resuelven sin esperar a nadie.
    Promise.resolve()
      .then((): Promise<Precarga> =>
        // **Las TRES precargas son EXCLUYENTES** (FR-013b, y `022`). La que gana,
        // gana entera: no se mezclan campo por campo. Mezclarlas seria
        // reintroducir, con mas superficie, la forma del defecto que este mismo
        // hook produjo el 2026-08-14 — dos cosas escribiendo sobre el mismo
        // formulario.
        //
        // **Editar va primero** porque es la unica que cambia a donde se guarda:
        // ante `?editar=A&repetir=B` —que no deberia pasar, pero se escribe a
        // mano— la respuesta segura es editar A, no crear un B con datos de A.
        idAEditar
          ? desdeUnPedidoParaEditar(idAEditar, Boolean(usuario))
          : idARepetir
            ? desdeUnPedido(idARepetir, Boolean(usuario))
            : desdeElPerfil(usuario ? { nombre, telefono, retiro } : null),
      )
      .then((p) => {
        if (vigente) setPrecarga(p);
      });

    return () => {
      vigente = false;
    };
  }, [cargando, usuario, retiro, nombre, telefono, idARepetir, idAEditar]);

  // Sin ramas derivadas y sin mirar la sesion: lo que se decidio, se devuelve.
  return precarga ?? ESPERANDO;
}

/**
 * La precarga de `022`: el mismo pedido, pero para CORREGIRLO.
 *
 * **Reusa `desdeUnPedido` entera** y sólo le agrega a dónde guardar. Los datos
 * que hay que poner en el formulario son exactamente los mismos que al repetir,
 * y escribir una segunda versión sería tener dos definiciones de "cómo se carga
 * un pedido guardado en el formulario" — que divergen.
 *
 * Lo único que cambia es `editando`, y con eso alcanza: es lo que hace que el
 * envío vaya a `PATCH /pedidos/{id}` en vez de a `POST /pedidos`.
 *
 * **Si la precarga falla, `editando` queda en `null`.** Es deliberado: sin los
 * datos del pedido no se puede editar —guardaría un pedido vacío sobre uno
 * bueno—, así que se degrada a "cargá uno a mano", que es lo que ya hace repetir.
 */
async function desdeUnPedidoParaEditar(id: string, haySesion: boolean): Promise<Precarga> {
  const base = await desdeUnPedido(id, haySesion);
  // Sin `inicial` la precarga no trajo el pedido: no hay nada que editar.
  return base.inicial ? { ...base, editando: id } : base;
}

const AVISO_PUNTO_RECOLOCADO =
  "Revisá el punto de retiro en el mapa: lo recolocamos en el cruce porque el que tenías guardado ya no cae en esa cuadra.";

/**
 * Un pedido creado antes de `011`, cuando la zona salia del retiro y la entrega
 * era texto sin punto. **Se puede repetir igual**, pero falta el unico dato que
 * hoy decide si el envio entra.
 *
 * El aviso sigue existiendo y sigue pidiendo lo mismo; lo que cambio en `013`
 * es el motivo que se le da a la persona. Antes era para verle el precio; ahora
 * es para poder confirmar que llegamos hasta ahi.
 */
const AVISO_SIN_PUNTO_DE_ENTREGA =
  "Este pedido es anterior a un cambio nuestro: elegí la esquina de la entrega para que podamos ubicarla.";

/**
 * La ENTREGA guardada, revalidada antes de mandar a nadie hacia ella (FR-016).
 *
 * **Hasta `010` esto revalidaba el RETIRO**, y la regla era la misma: no se
 * repite un punto guardado sin comprobar que sigue cayendo en su cuadra.
 * Lo que cambio en `011` no es la regla sino cual es el punto que decide, asi que
 * la revalidacion se mudo con el. Ver research D6.
 *
 * El caso no es hipotetico: el indice de calles se regenera, y un punto guardado
 * en agosto puede quedar en otra cuadra —o en otra zona, o sea afuera— en
 * octubre sin que nadie toque nada.
 *
 * Cuando el punto recolocado queda fuera de toda zona, aca no hace falta hacer
 * nada especial: el formulario avisa que no llegamos, no deja confirmar, y
 * encamina al contacto. Nunca la zona mas cercana (Principio V).
 *
 * **El punto del RETIRO ya no pasa por aca, y es deliberado** (FR-017): no
 * decide admision, asi que uno desactualizado es una molestia de ruta y no un
 * pedido mal tomado. Descartarlo seria tirar un dato bueno por una regla que
 * dejo de aplicarle.
 */
async function entregaRevalidada(
  guardada: Parameters<typeof rehidratarRetiro>[0],
): Promise<{ estado: EstadoDireccion; aviso: string | null }> {
  const r = await rehidratarRetiro(guardada);

  if (r.ubicable && r.estado.esquina && !r.puntoEnLaCuadra) {
    return {
      estado: {
        ...r.estado,
        direccion: { ...r.estado.direccion, punto: r.estado.esquina.punto },
      },
      aviso: AVISO_PUNTO_RECOLOCADO,
    };
  }

  return { estado: r.estado, aviso: null };
}

/** La precarga de siempre: lo que el perfil ya sabe (`007`, FR-023). */
async function desdeElPerfil(
  u: { nombre: string; telefono: string; retiro: Parameters<typeof rehidratarRetiro>[0] | null } | null,
): Promise<Precarga> {
  // Sin sesion: el formulario arranca vacio, como siempre. Cotizar no pide nada.
  // **Este es el caso que estaba roto**: se decide ahora y no se vuelve a tocar,
  // aunque despues ingrese desde el dialogo.
  if (!u) return SIN_PRECARGA;

  const base: Partial<FormState> = { name: u.nombre, phone: u.telefono };

  // FR-025 de `007`: un perfil sin direccion deja el formulario utilizable y
  // vacio en esa parte, sin errores.
  if (!u.retiro) return { ...SIN_PRECARGA, inicial: base };

  try {
    // **Sin revalidar** (FR-017): el punto guardado en *Mi cuenta* lo marco una
    // persona a mano y es el mejor dato de retiro que hay. Ya no cobra, asi que
    // no se descarta ni se avisa nada aunque haya quedado fuera de su cuadra.
    const r = await rehidratarRetiro(u.retiro);
    return { ...SIN_PRECARGA, inicial: { ...base, retiro: r.estado } };
  } catch {
    // Que no se pueda reconstruir la direccion no puede dejar sin pedir a quien
    // igual la puede escribir a mano.
    return { ...SIN_PRECARGA, inicial: base };
  }
}

/**
 * La precarga de `010`: un pedido anterior, tal como se guardo.
 *
 * **Todo camino que falla termina en el mismo lugar: formulario vacio y
 * utilizable, con un aviso que dice que paso.** Nunca en una pantalla a medio
 * cargar ni bloqueada — quien llego hasta aca queria mandar un paquete, y
 * tenerlo que escribir a mano es peor que repetirlo pero mucho mejor que nada.
 */
async function desdeUnPedido(id: string, haySesion: boolean): Promise<Precarga> {
  if (!haySesion) {
    return {
      ...SIN_PRECARGA,
      avisoDeRepeticion:
        "Para repetir un pedido tenés que ingresar. Mientras tanto podés cargarlo a mano.",
    };
  }

  let pedido: PedidoGuardado | undefined;
  try {
    // Se busca en la lista PROPIA, y ahi esta la autorizacion: el servicio la
    // arma con la credencial y no acepta parametro que lo esquive, asi que un id
    // ajeno simplemente no aparece (FR-007). No hay que escribir ninguna
    // comprobacion de dueño aca, y no hay que escribirla nunca.
    pedido = (await misPedidos(credencial())).find((p) => p.id === id);
  } catch (e) {
    return {
      ...SIN_PRECARGA,
      avisoDeRepeticion:
        e instanceof ErrorApi && e.sesionInvalida
          ? "Tu sesión venció. Ingresá de nuevo para repetir el pedido."
          : "No pudimos traer ese pedido. Podés cargarlo a mano.",
    };
  }

  if (!pedido) {
    return {
      ...SIN_PRECARGA,
      avisoDeRepeticion: "No encontramos ese pedido. Podés cargarlo a mano.",
    };
  }

  const campos = camposDelPedido(pedido);

  // El RETIRO entra como texto, con su punto tal cual se guardo y sin
  // revalidarlo (FR-017). Puede venir sin punto —una calle homonima o fuera del
  // indice cuando se creo el pedido— y eso no impide nada.
  const retiro: EstadoDireccion = {
    ...ESTADO_DIRECCION_VACIO,
    direccion: { ...ESTADO_DIRECCION_VACIO.direccion, ...campos.retiro },
  };

  const base: Partial<FormState> = {
    name: campos.name,
    phone: campos.phone,
    packageSize: campos.packageSize,
    quantity: campos.quantity,
    receiverName: campos.receiverName,
    receiverPhone: campos.receiverPhone,
    retiro,
  };

  // **Un pedido anterior a `011` no tiene punto de entrega** (FR-013). No es un
  // error ni una pantalla rota: se precarga todo lo demas, la entrega queda como
  // texto para que la persona resuelva el cruce, y no se sabe si llegamos hasta
  // que lo haga. Rehidratar sin punto elegiria entre calles homonimas a ciegas,
  // que es exactamente la zona adivinada que el Principio V prohibe.
  if (!pedido.entrega.punto) {
    const entrega: EstadoDireccion = {
      ...ESTADO_DIRECCION_VACIO,
      direccion: {
        ...ESTADO_DIRECCION_VACIO.direccion,
        calle: pedido.entrega.calle,
        esquina: pedido.entrega.esquina,
        numero: pedido.entrega.numero ?? "",
        apto: pedido.entrega.apto ?? "",
        cooperativa: pedido.entrega.cooperativa,
      },
    };
    return {
      ...SIN_PRECARGA,
      inicial: { ...base, entrega },
      avisoDeRepeticion: AVISO_SIN_PUNTO_DE_ENTREGA,
    };
  }

  try {
    const { estado, aviso } = await entregaRevalidada(entregaParaRehidratar(pedido));

    return {
      ...SIN_PRECARGA,
      inicial: { ...base, entrega: estado },
      avisoDelPunto: aviso,
    };
  } catch {
    // El resto del pedido se precarga igual: perder la direccion de retiro no
    // tiene por que costar tambien el destinatario y el paquete.
    return {
      ...SIN_PRECARGA,
      inicial: base,
      avisoDeRepeticion:
        "No pudimos reconstruir la dirección de retiro. Escribila de nuevo y el resto ya está cargado.",
    };
  }
}
