"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorApi, pedir } from "@/lib/api";
import { useSesion, type RespuestaSesion } from "./proveedor-sesion";

/**
 * Client ID de Google, inyectado en el bundle en tiempo de build.
 *
 * Es **publico por diseño** —viaja dentro del JavaScript que cualquiera puede
 * leer— y por eso va como variable de repositorio y no como secreto. Lo que no
 * puede es estar escrito acá: rotar el cliente OAuth o mudar de dominio tiene
 * que ser cambiar una variable, no editar una pantalla (mismo motivo que FR-024).
 */
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

const SRC_GIS = "https://accounts.google.com/gsi/client";

/**
 * La porcion de Google Identity Services que usamos.
 *
 * Se declara a mano en vez de sumar los tipos oficiales: son tres funciones y
 * una dependencia menos. Lo que se escriba de mas acá no lo verifica nadie, así
 * que se declara **solo lo que se llama**.
 */
type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (respuesta: { credential?: string }) => void;
        auto_select?: boolean;
        cancel_on_tap_outside?: boolean;
      }) => void;
      renderButton: (
        contenedor: HTMLElement,
        opciones: {
          type?: "standard";
          theme?: "outline" | "filled_blue";
          size?: "large" | "medium";
          text?: "signin_with" | "continue_with";
          shape?: "rectangular" | "pill";
          logo_alignment?: "left" | "center";
          locale?: string;
          width?: number;
        },
      ) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

export function BotonGoogle({
  onIngreso,
  onError,
}: {
  onIngreso: (respuesta: RespuestaSesion) => void;
  onError: (mensaje: string) => void;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [listo, setListo] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const { entrar } = useSesion();

  // Se guardan en refs para que el efecto que dibuja el botón no dependa de
  // ellas: GIS solo permite inicializar una vez por carga, y un efecto que se
  // vuelva a correr porque el padre re-renderizó dibujaría el botón dos veces.
  const alIngresar = useRef(onIngreso);
  const alFallar = useRef(onError);
  useEffect(() => {
    alIngresar.current = onIngreso;
    alFallar.current = onError;
  });

  const recibirToken = useCallback(
    async (respuesta: { credential?: string }) => {
      const token = respuesta.credential;
      if (!token) {
        alFallar.current("Google no devolvió una credencial. Intentá de nuevo.");
        return;
      }

      try {
        const sesion = await pedir<RespuestaSesion>("/auth/google", {
          metodo: "POST",
          cuerpo: { token },
        });
        entrar(sesion);
        alIngresar.current(sesion);
      } catch (err) {
        // El servicio responde lo MISMO para todas las causas de rechazo
        // (FR-014), así que acá no hay nada que interpretar: se distingue
        // "no pudimos hablar con el servicio" de "no te dejó entrar", que es la
        // única diferencia que le sirve a quien está mirando la pantalla.
        if (err instanceof ErrorApi && err.sinRespuesta) {
          alFallar.current("No pudimos conectarnos con el servicio. Intentá de nuevo en un momento.");
          return;
        }
        alFallar.current("No pudimos validar tu cuenta de Google. Probá de nuevo o entrá con tu correo.");
      }
    },
    [entrar],
  );

  useEffect(() => {
    if (!listo || !CLIENT_ID) return;
    const destino = contenedor.current;
    if (!destino) return;

    let vigente = true;

    // Igual que en el proveedor: el cuerpo cuelga de una promesa ya resuelta
    // porque el lint de React prohibe setState sincrono dentro de un efecto.
    void Promise.resolve().then(() => {
      if (!vigente) return;

      const google = window.google;
      if (!google) {
        // El script dijo que cargo y el global no esta. Pasa con bloqueadores
        // de rastreo, que dejan pasar la request y vacian la respuesta.
        setFallo("no-cargo");
        return;
      }

      dibujar(google, destino);
    });

    return () => {
      vigente = false;
    };

    function dibujar(google: GoogleIdentity, destino: HTMLElement) {
      google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (r) => void recibirToken(r),
        // Nada de ingreso automático: que alguien quede identificado sin haberlo
        // pedido es exactamente el tipo de sorpresa que no queremos en un sitio
        // donde identificarse es opcional para mirar precios.
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      google.accounts.id.renderButton(destino, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        logo_alignment: "left",
        locale: "es",
      });
    }
  }, [listo, recibirToken]);

  // Sin Client ID el botón no puede funcionar, y el motivo es de configuración
  // del build, no del usuario. Decirlo así ahorra media hora de mirar la consola.
  if (!CLIENT_ID) {
    return (
      <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
        El ingreso con Google no está configurado en este sitio. Podés entrar con tu correo.
      </p>
    );
  }

  return (
    <>
      <Script
        src={SRC_GIS}
        // Por defecto, y es el correcto: el botón no hace falta antes de que la
        // página sea interactiva, y `beforeInteractive` retrasaría el resto.
        strategy="afterInteractive"
        // `onReady` y NO `onLoad`, y la diferencia no es cosmética: `onLoad`
        // dispara una sola vez, cuando el script se descarga. Quien entra a
        // /ingresar, navega a otra pantalla y vuelve, no vuelve a descargarlo
        // —ya está en la página— así que `onLoad` no dispara de nuevo y el
        // botón nunca se dibuja. `onReady` corre **cada vez que el componente
        // se monta**, incluido ese regreso.
        onReady={() => setListo(true)}
        onError={() => setFallo("no-cargo")}
      />

      {fallo && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No pudimos cargar el ingreso con Google. Revisá tu conexión, o entrá con tu correo.
        </p>
      )}

      {/* Alto reservado: sin esto la pantalla salta cuando GIS termina de
          dibujar su botón, y el salto ocurre justo donde el dedo va a tocar. */}
      <div ref={contenedor} className="min-h-[44px] w-full [&>div]:!w-full" aria-busy={!listo} />
    </>
  );
}
