import type { Metadata } from "next";
import { Tablero } from "@/components/tablero/tablero";

// El tablero de Diego (`025`). Cuenta pedidos y paquetes; no muestra plata.
//
// **Este archivo es de servidor a proposito**, aunque todo lo que se ve sea de
// cliente: `metadata` solo se puede exportar desde un Server Component, y el
// `noindex` es lo unico que esta pagina necesita del servidor. La pantalla vive
// en `components/tablero/tablero.tsx`.
//
// **La pagina existe para cualquiera que escriba la URL**, porque el sitio es un
// export estatico y no hay forma de que no exista. No es un problema: sin sesion
// ofrece entrar, a una cuenta comun le dice que es de la administracion, y los
// numeros solo los da el servicio a quien esta en ADMIN_EMAILS (FR-001, FR-003).
// Que no aparezca en un buscador es cortesia, no seguridad.
export const metadata: Metadata = {
  title: "Tablero — Flash Urbano",
  robots: { index: false, follow: false },
};

export default function TableroPage() {
  return <Tablero />;
}
