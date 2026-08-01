import Image from "next/image";
import Link from "next/link";
import { asset } from "@/lib/asset";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2">
          <Image
            src={asset("/logo-flash-urbano.jpeg")}
            alt="Flash Urbano"
            width={24}
            height={24}
            className="h-6 w-6 rounded object-cover"
          />
          <p>© {new Date().getFullYear()} Flash Urbano — Paquetería y logística.</p>
        </div>
        <div className="flex gap-4">
          <Link href="/sobre-nosotros" className="hover:text-slate-700">
            Sobre nosotros
          </Link>
          <Link href="/contacto" className="hover:text-slate-700">
            Contacto
          </Link>
        </div>
      </div>
    </footer>
  );
}
