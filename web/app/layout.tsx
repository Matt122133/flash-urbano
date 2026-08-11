import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/nav-bar";
import { Footer } from "@/components/footer";
import { ProveedorSesion } from "@/components/sesion/proveedor-sesion";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Flash Urbano — Paquetería y logística",
  description:
    "Enviá y retirá paquetes con Flash Urbano. Cargá tu pedido online de forma rápida, simple y segura.",
};

/**
 * Origen del servicio, para la CSP.
 *
 * Se deriva de la misma variable de build que usa `lib/api.ts` (FR-024), y no
 * se escribe a mano: una CSP con un origen distinto del que el cliente llama
 * bloquea todas las llamadas, y el sintoma —"failed to fetch"— no menciona la
 * CSP por ningun lado.
 */
const enDesarrollo = process.env.NODE_ENV !== "production";

const origenDelApi = (() => {
  const crudo = process.env.NEXT_PUBLIC_API_URL ?? "";
  if (!crudo) return "";
  try {
    return new URL(crudo).origin;
  } catch {
    return "";
  }
})();

/**
 * Content Security Policy del sitio.
 *
 * ## Por que va en un <meta> y no en un header
 *
 * GitHub Pages no deja configurar encabezados HTTP. Es la unica via que queda.
 * Tiene dos consecuencias que conviene saber: `frame-ancestors` y `report-uri`
 * **no funcionan** en <meta> y por eso no estan, y la politica empieza a regir
 * recien cuando el navegador parsea este tag — por eso va lo mas arriba posible.
 *
 * ## Por que NO es estricta, y que si hace
 *
 * El research D4 asumio una CSP estricta y hay que corregirlo: no se puede
 * armar una en un export estatico. La via que documenta Next usa *nonces*, y
 * los nonces exigen renderizado dinamico —un servidor que genere uno distinto
 * por visita— que aca no existe. Y Next emite scripts inline propios: un
 * `script-src 'self'` a secas los bloquea y el sitio no hidrata, o sea queda
 * muerto.
 *
 * Asi que `'unsafe-inline'` esta, y con el la CSP **no impide que un XSS se
 * ejecute**. Lo que si impide es que se lleve algo: `connect-src` limita a
 * donde se puede hablar, y la credencial vive en `localStorage`. Un script
 * inyectado puede leerla y no puede mandarla a un servidor propio.
 *
 * Es una defensa mas floja que la que D4 prometio, y esta anotada como deuda.
 * Ver [research D10](../../specs/006-backend-auth/research.md).
 */
const csp = [
  "default-src 'self'",

  // 'unsafe-inline' por el bootstrap de Next, explicado arriba. Google Identity
  // Services se sirve desde accounts.google.com.
  //
  // `'unsafe-eval'` **solo en desarrollo**: React lo necesita en modo dev para
  // reconstruir callstacks y otras ayudas de depuracion, y sin el la consola se
  // llena de "eval() is not supported in this environment". En produccion React
  // no usa eval nunca, asi que dejarlo puesto seria abrir un agujero a cambio
  // de nada. `NODE_ENV` lo resuelve el build, no el navegador.
  `script-src 'self' 'unsafe-inline'${enDesarrollo ? " 'unsafe-eval'" : ""} https://accounts.google.com https://apis.google.com`,

  // React renderiza estilos como atributo `style`, y GIS inyecta los suyos.
  `style-src 'self' 'unsafe-inline' https://accounts.google.com`,

  // data: y blob: los usa Leaflet para los marcadores. Los tiles del mapa salen
  // de OpenStreetMap; las fotos de perfil, del CDN de Google.
  `img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://lh3.googleusercontent.com`,

  // **La directiva que hace el trabajo.** Si algun dia se cuela un XSS, esto es
  // lo que le impide mandar la credencial afuera. La lista es corta a proposito.
  // En desarrollo se suma el websocket de recarga en caliente de Next. Sin el,
  // la consola tira errores de conexion en cada guardado y parecen del sitio.
  `connect-src 'self' https://accounts.google.com${origenDelApi ? ` ${origenDelApi}` : ""}${
    enDesarrollo ? " ws://localhost:* http://localhost:*" : ""
  }`,

  // GIS abre su selector de cuenta en un iframe propio.
  "frame-src https://accounts.google.com",

  "font-src 'self' data:",

  // Sin plugins, sin <base> ajeno, y los formularios solo contra el propio
  // sitio. Los tres son baratos y cierran vectores reales.
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* React 19 iza este <meta> al <head>. No puede ir por el export
          `metadata`: ese no soporta http-equiv. */}
      <meta httpEquiv="Content-Security-Policy" content={csp} />
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {/* El proveedor envuelve TODO, navegacion incluida: la navbar muestra
            quien esta adentro y necesita el mismo estado que las pantallas.

            Que este arriba de `/pedido` no le cuesta nada al que cotiza: sin
            credencial guardada, el proveedor no hace una sola llamada de red
            (FR-001). */}
        <ProveedorSesion>
          <NavBar />
          <main className="flex flex-1 flex-col">{children}</main>
          <Footer />
        </ProveedorSesion>
      </body>
    </html>
  );
}
