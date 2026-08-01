import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/nav-bar";
import { Footer } from "@/components/footer";

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
  // QUITAR AL SALIR A PRODUCCION DE VERDAD.
  // Mientras esto es una preview para mostrarle al cliente, el sitio tiene
  // telefono y email de contacto ficticios y precios de zona sin validar.
  // Si Google lo indexa, gente real puede encontrarlo y escribir a un numero
  // que no es de la empresa.
  robots: { index: false, follow: false },
};

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
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <NavBar />
        <main className="flex flex-1 flex-col">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
