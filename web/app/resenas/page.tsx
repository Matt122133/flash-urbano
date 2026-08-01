import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reseñas — Flash Urbano",
};

export default function ResenasPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="h-7 w-7"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.48 3.5c.3-.62 1.24-.62 1.54 0l2.34 4.74 5.23.76c.68.1.95.94.46 1.42l-3.79 3.69.9 5.21c.11.68-.6 1.2-1.21.88L12 17.77l-4.65 2.44c-.6.32-1.32-.2-1.2-.88l.89-5.21-3.78-3.69c-.5-.48-.22-1.32.46-1.42l5.23-.76 2.33-4.74Z"
          />
        </svg>
      </span>
      <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        Reseñas
      </h1>
      <p className="mt-3 max-w-md text-sm text-slate-600 sm:text-base">
        Estamos preparando esta sección para que puedas ver la opinión de
        otros clientes. Próximamente.
      </p>
    </div>
  );
}
