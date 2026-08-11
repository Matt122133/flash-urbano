"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { asset } from "@/lib/asset";
import { useSesion } from "@/components/sesion/proveedor-sesion";

const LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/pedido", label: "Crear pedido" },
  { href: "/sobre-nosotros", label: "Sobre nosotros" },
  { href: "/contacto", label: "Contacto" },
  { href: "/resenas", label: "Reseñas" },
];

export function NavBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { usuario, cargando, salir } = useSesion();

  // Mientras se resuelve la credencial guardada no se muestra nada de sesion.
  // Es medio segundo, pero mostrar "Ingresar" a alguien que ya esta adentro y
  // cambiarlo despues se lee como un error del sitio, no como una carga.
  const sesionResuelta = !cargando;

  /** Solo el primer nombre: en el ancho de un telefono no entra mas. */
  const nombreCorto = usuario?.nombre?.trim().split(/\s+/)[0] ?? "";

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <Image
            src={asset("/logo-flash-urbano.jpeg")}
            alt="Flash Urbano"
            width={40}
            height={40}
            className="h-10 w-10 rounded-lg object-cover"
            priority
          />
          <span className="text-lg font-semibold tracking-tight text-slate-900">
            Flash Urbano
          </span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand/10 text-brand"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 sm:flex">
          {sesionResuelta &&
            (usuario ? (
              <div className="flex items-center gap-2">
                {/* El nombre es el acceso a la cuenta. No se agrega un item mas
                    a la navegacion: es donde la persona ya mira para saber
                    quien esta adentro, y una pantalla a la que no se llega es
                    una pantalla que no existe. */}
                <Link
                  href="/perfil"
                  className="rounded-md px-2 py-1 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  title={`${usuario.email} — ver mi cuenta`}
                >
                  {nombreCorto || usuario.email}
                </Link>
                <button
                  type="button"
                  onClick={() => void salir()}
                  className="rounded-md px-2 py-1 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  Salir
                </button>
              </div>
            ) : (
              <Link
                href="/ingresar"
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                Ingresar
              </Link>
            ))}

          <Link
            href="/pedido"
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600"
          >
            Enviar un paquete
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Abrir menú"
          aria-expanded={open}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-700 sm:hidden"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav className="border-t border-slate-200 bg-white px-4 py-2 sm:hidden">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            // En el ancho de escritorio hay dos accesos a /pedido: el item de
            // la navegacion y el boton naranja de la derecha. En el teléfono el
            // boton naranja no existe —no entra en la barra— asi que el menu
            // colapsado era el unico lugar donde la accion principal del sitio
            // se veia igual que "Sobre nosotros". Se destaca acá para reponer
            // ese contraste, que es justo donde mas hace falta: el sitio se abre
            // desde un telefono (Principio IV).
            //
            // Se queda naranja tambien estando en /pedido, y por eso no lleva
            // el estilo de activo: es una llamada a la accion, no un indicador
            // de donde estas.
            const destacado = link.href === "/pedido";
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={
                  destacado
                    ? "my-1 block rounded-full bg-accent px-3 py-2.5 text-center text-base font-semibold text-white shadow-sm transition-colors hover:bg-orange-600"
                    : `block rounded-md px-3 py-2.5 text-base font-medium ${
                        active ? "bg-brand/10 text-brand" : "text-slate-700 hover:bg-slate-100"
                      }`
                }
              >
                {link.label}
              </Link>
            );
          })}

          {/* La sesion tambien en el menu colapsado. Es donde la va a usar la
              mayoria: el sitio se abre desde un telefono (Principio IV), y
              dejarla solo en el ancho de escritorio la esconde justo de quien
              la necesita. */}
          {sesionResuelta && (
            <div className="mt-2 border-t border-slate-200 pt-2">
              {usuario ? (
                <>
                  <p className="px-3 py-2 text-sm text-slate-500">
                    Entraste como{" "}
                    <span className="font-medium text-slate-700">
                      {nombreCorto || usuario.email}
                    </span>
                  </p>
                  <Link
                    href="/perfil"
                    onClick={() => setOpen(false)}
                    className="block rounded-md px-3 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Mi cuenta
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      void salir();
                    }}
                    className="block w-full rounded-md px-3 py-2.5 text-left text-base font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Salir
                  </button>
                </>
              ) : (
                <Link
                  href="/ingresar"
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-100"
                >
                  Ingresar
                </Link>
              )}
            </div>
          )}
        </nav>
      )}
    </header>
  );
}
