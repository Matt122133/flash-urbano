"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ZONAS } from "@/lib/zonas";

export type EstadoMosaicos = "cargando" | "ok" | "no-disponible";

export type Punto = { lat: number; lng: number };

export type MapaZonasProps = {
  /** Solo lectura (Sobre Nosotros) o permite marcar punto (formulario). */
  interactivo?: boolean;
  /** Punto marcado. El componente es controlado por quien lo usa. */
  punto?: Punto | null;
  /** Se dispara al tocar el mapa o soltar el marcador. Solo si `interactivo`. */
  onPunto?: (p: Punto) => void;
  /**
   * Recentra la vista cuando cambia. Va aparte de `punto` a proposito: el mapa
   * NO debe saltar cada vez que el usuario toca en otro lado, solo cuando la
   * posicion llega de afuera (el boton de geolocalizacion).
   */
  centrarEn?: Punto | null;
  /**
   * Niveles de zoom a sumar despues del encuadre inicial.
   *
   * El encuadre por defecto abarca las cinco zonas, y las zonas 3 y 5 tienen
   * colas largas al oeste y al este: entra todo, pero Montevideo queda chico y
   * con mucho margen vacio. Sumar un nivel recorta esas puntas y deja la ciudad
   * llenando el cuadro. Se puede seguir alejando a mano.
   */
  zoomExtra?: number;
  /** Reporta disponibilidad de los mosaicos; quien lo usa decide que hacer. */
  onEstadoMosaicos?: (estado: EstadoMosaicos) => void;
  className?: string;
};

// Si a los 8 segundos del montaje hubo errores de mosaico y ninguna carga, se
// considera la fuente caida. El umbral esta fijo a proposito: bloquea pedidos,
// asi que corto de mas frena una venta legitima en red lenta y largo de mas deja
// al cliente mirando un hueco. Ver research.md D7.
const PLAZO_MOSAICOS_MS = 8000;

// Marcador propio en HTML en vez de L.Icon.Default: el icono por defecto arma
// URLs a leaflet/dist/images/ en runtime, sin el basePath de GitHub Pages, y
// daria 404 justo en el elemento del que depende el precio. Ver research.md D5.
const ICONO = L.divIcon({
  className: "",
  html: `<div style="
    width:22px;height:22px;border-radius:9999px;
    background:#ea580c;border:3px solid #fff;
    box-shadow:0 2px 6px rgba(0,0,0,.45);
  "></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export default function MapaZonas({
  interactivo = false,
  punto = null,
  onPunto,
  centrarEn = null,
  zoomExtra = 0,
  onEstadoMosaicos,
  className = "h-[420px] w-full",
}: MapaZonasProps) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const marcador = useRef<L.Marker | null>(null);

  // Los callbacks y el modo van por ref para que el efecto de montaje no dependa
  // de su identidad: si dependiera, cada render del padre desmontaria y
  // remontaria el mapa entero.
  //
  // La sincronizacion va en un efecto y no en el cuerpo del componente porque
  // escribir un ref durante el render es justamente lo que prohibe la regla
  // react-hooks/refs de React 19. Este efecto se declara primero para que corra
  // antes que el de montaje.
  const cbPunto = useRef(onPunto);
  const cbEstado = useRef(onEstadoMosaicos);
  const modoInteractivo = useRef(interactivo);
  // Solo se lee al montar: es el encuadre inicial, no algo que deba reaplicarse
  // cuando el padre re-renderiza. Va por ref para no meterlo como dependencia
  // del efecto de montaje.
  const zoomInicial = useRef(zoomExtra);

  useEffect(() => {
    cbPunto.current = onPunto;
    cbEstado.current = onEstadoMosaicos;
    modoInteractivo.current = interactivo;
  });

  useEffect(() => {
    if (!contenedor.current || mapa.current) return;

    const m = L.map(contenedor.current, {
      // Apagado para no secuestrar el scroll de la pagina en desktop; el zoom
      // queda en los controles y en el pinch. Ver research.md D6.
      scrollWheelZoom: false,
    });
    mapa.current = m;

    const capa = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      // Condicion de la licencia de OpenStreetMap, no un adorno (FR-008).
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);

    let cargados = 0;
    let resuelto = false;
    const veredicto = (estado: EstadoMosaicos) => {
      if (resuelto) return;
      resuelto = true;
      cbEstado.current?.(estado);
    };
    capa.on("tileload", () => {
      cargados++;
      veredicto("ok");
    });
    const reloj = setTimeout(() => {
      // El criterio es "ningun mosaico entro", no "hubo errores": una conexion
      // que cuelga sin emitir `tileerror` deja el mapa igual de inservible, y
      // exigir un error dejaria el estado en "cargando" para siempre.
      //
      // Basta UN mosaico cargado para dar por buena la fuente: uno suelto que
      // falla en una red mala deja el mapa perfectamente usable, y bloquear un
      // pedido por eso seria absurdo.
      if (cargados === 0) veredicto("no-disponible");
    }, PLAZO_MOSAICOS_MS);

    const limites = L.latLngBounds([]);
    for (const zona of ZONAS) {
      L.polygon(zona.anillo, {
        color: zona.color,
        weight: 2,
        fillColor: zona.color,
        fillOpacity: 0.25,
      })
        .bindTooltip(`${zona.nombre} — $ ${zona.precio}`, { sticky: true })
        .addTo(m);
      limites.extend(zona.anillo);
    }
    // Arranca mostrando Montevideo entero con las cinco zonas. No se pide la
    // geolocalizacion al abrir: un permiso que el usuario no pidio se rechaza
    // seguido, y perderlo de entrada deja el atajo inservible por el resto de la
    // sesion (spec.md § Assumptions).
    m.fitBounds(limites, { padding: [16, 16] });
    if (zoomInicial.current) m.setZoom(m.getZoom() + zoomInicial.current);

    m.on("click", (e: L.LeafletMouseEvent) => {
      if (!modoInteractivo.current) return;
      cbPunto.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    return () => {
      clearTimeout(reloj);
      m.remove();
      mapa.current = null;
      marcador.current = null;
    };
  }, []);

  // Marcador controlado desde afuera.
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;

    if (!punto) {
      marcador.current?.remove();
      marcador.current = null;
      return;
    }

    if (!marcador.current) {
      marcador.current = L.marker([punto.lat, punto.lng], {
        icon: ICONO,
        draggable: interactivo,
        keyboard: false,
      }).addTo(m);
      marcador.current.on("dragend", (e) => {
        const { lat, lng } = (e.target as L.Marker).getLatLng();
        cbPunto.current?.({ lat, lng });
      });
    } else {
      marcador.current.setLatLng([punto.lat, punto.lng]);
    }
  }, [punto, interactivo]);

  useEffect(() => {
    if (!centrarEn || !mapa.current) return;
    mapa.current.setView([centrarEn.lat, centrarEn.lng], 16);
  }, [centrarEn]);

  // Sin aria-hidden: Leaflet inyecta controles enfocables adentro, y ocultar del
  // arbol de accesibilidad un subarbol con foco es un error, no una mejora. La
  // informacion de zonas y precios viaja por la leyenda en texto (FR-007), que
  // no depende de este mapa.
  return <div ref={contenedor} className={className} />;
}
