"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Campo de texto con sugerencias, siguiendo el patron ARIA de combobox.
 *
 * Se escribio a mano en vez de traer una libreria headless (research R8): el
 * repo no tiene ninguna libreria de UI y meter la primera por un solo control
 * contradice el Principio III. El riesgo asumido es que un combobox accesible
 * es de los controles que mas se rompen, y por eso el teclado y los anuncios
 * son requisito con criterio de aceptacion propio (FR-023a, FR-023b, SC-009) y
 * no "lo revisamos despues".
 *
 * Esto importa mas de lo que parece: este feature **retira el texto libre** que
 * hoy es la via accesible para cargar una direccion. Si el combobox no es
 * usable con teclado y lector de pantalla, alguien que hoy puede hacer un
 * pedido deja de poder. Es una regresion, no una mejora pendiente.
 */

export type Opcion = {
  clave: string;
  /** Lo que se muestra y lo que queda escrito al elegir. */
  nombre: string;
};

// Las sugerencias tienen que aparecer en menos de 300 ms desde que se deja de
// tipear (SC-006). La busqueda en si es sincronica sobre el indice ya cargado y
// tarda menos de un milisegundo, asi que el unico costo real es esta espera:
// 150 ms alcanza para no recalcular en cada tecla y deja margen de sobra.
const ESPERA_MS = 150;

export type CampoAutocompletadoProps = {
  id: string;
  label: string;
  /**
   * El texto del campo. El componente es **totalmente controlado**: lo tipeado
   * es el valor, se haya elegido una sugerencia o no.
   *
   * Eso es lo que permite que el mismo control sirva para el retiro, donde
   * elegir una sugerencia es obligatorio porque de ahi sale el precio, y para
   * la entrega, donde el autocompletado es una ayuda y lo tipeado vale igual
   * (FR-007b).
   */
  valor: string;
  /** Devuelve las sugerencias para lo tipeado. Sincronica y pura. */
  buscar: (texto: string) => Opcion[];
  /** Cada tecla. Quien lo usa decide que hacer con texto sin elegir. */
  onTexto: (texto: string) => void;
  /** Ademas de `onTexto`, cuando se elige una sugerencia de la lista. */
  onElegir: (opcion: Opcion) => void;
  deshabilitado?: boolean;
  /** Por que esta deshabilitado, para que no sea un misterio. */
  motivoDeshabilitado?: string;
  error?: string;
  ayuda?: string;
  placeholder?: string;
};

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400";

export function CampoAutocompletado({
  id,
  label,
  valor,
  buscar,
  onTexto,
  onElegir,
  deshabilitado = false,
  motivoDeshabilitado,
  error,
  ayuda,
  placeholder,
}: CampoAutocompletadoProps) {
  const [opciones, setOpciones] = useState<Opcion[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);

  const listaId = `${id}-lista`;
  const ayudaId = useId();
  const contenedor = useRef<HTMLDivElement>(null);

  // Lo ultimo que se eligio de la lista. Sirve para no volver a desplegar
  // sugerencias apenas se elige una: sin esto, elegir "Ejido" dispararia una
  // busqueda de "Ejido" y la lista se reabriria sola.
  const [ultimoElegido, setUltimoElegido] = useState<string | null>(null);

  // El debounce vive aca y no en quien usa el campo: es una propiedad del
  // control, no de la pantalla que lo monta.
  const buscarRef = useRef(buscar);
  useEffect(() => {
    buscarRef.current = buscar;
  });

  useEffect(() => {
    // Si lo escrito es justo lo que se acaba de elegir no hay nada que sugerir,
    // y tampoco se agenda nada.
    if (valor === ultimoElegido) return;
    const reloj = setTimeout(() => {
      const encontradas = buscarRef.current(valor);
      setOpciones(encontradas);
      setActivo(encontradas.length > 0 ? 0 : -1);
      setAbierto(true);
    }, ESPERA_MS);
    return () => clearTimeout(reloj);
  }, [valor, ultimoElegido]);

  // Derivada en vez de guardada: calcularlo aca evita un setState dentro del
  // efecto, que en React 19 dispara renders en cascada.
  const visibles = valor === ultimoElegido ? [] : opciones;

  // Cerrar al tocar fuera. No limpia lo tipeado: cerrar la lista no es
  // descartar lo que la persona escribio.
  useEffect(() => {
    if (!abierto) return;
    const alTocarFuera = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", alTocarFuera);
    return () => document.removeEventListener("mousedown", alTocarFuera);
  }, [abierto]);

  function elegir(opcion: Opcion) {
    setUltimoElegido(opcion.nombre);
    setOpciones([]);
    setAbierto(false);
    setActivo(-1);
    onTexto(opcion.nombre);
    onElegir(opcion);
  }

  function alTeclear(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!abierto && visibles.length > 0) {
        setAbierto(true);
        return;
      }
      if (visibles.length === 0) return;
      const paso = e.key === "ArrowDown" ? 1 : -1;
      setActivo((i) => (i + paso + visibles.length) % visibles.length);
      return;
    }
    if (e.key === "Home" && abierto && visibles.length > 0) {
      e.preventDefault();
      setActivo(0);
      return;
    }
    if (e.key === "End" && abierto && visibles.length > 0) {
      e.preventDefault();
      setActivo(visibles.length - 1);
      return;
    }
    if (e.key === "Enter") {
      if (abierto && activo >= 0 && visibles[activo]) {
        // Solo se traga el Enter si hay algo que elegir; si no, que envie el
        // formulario como cualquier otro campo.
        e.preventDefault();
        elegir(visibles[activo]);
      }
      return;
    }
    if (e.key === "Escape") {
      if (abierto) {
        e.preventDefault();
        setAbierto(false);
        setActivo(-1);
      }
      return;
    }
  }

  const opcionActivaId = activo >= 0 && visibles[activo] ? `${id}-op-${activo}` : undefined;
  const mostrarLista = abierto && visibles.length > 0;

  const anuncio = !abierto
    ? ""
    : visibles.length === 0
      ? "No hay calles que coincidan."
      : `${visibles.length} ${visibles.length === 1 ? "sugerencia" : "sugerencias"}. Usá las flechas para recorrerlas.`;

  return (
    <div ref={contenedor} className="relative">
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>

      <input
        id={id}
        // El patron de combobox: el input anuncia que gobierna una lista, si
        // esta desplegada, y cual de sus opciones esta activa.
        role="combobox"
        aria-expanded={mostrarLista}
        aria-controls={listaId}
        aria-autocomplete="list"
        aria-activedescendant={opcionActivaId}
        aria-describedby={ayuda || motivoDeshabilitado ? ayudaId : undefined}
        aria-invalid={error ? true : undefined}
        autoComplete="off"
        className={inputClass}
        disabled={deshabilitado}
        placeholder={placeholder}
        value={valor}
        onChange={(e) => {
          // Cambiar el texto invalida lo elegido: lo escrito ya no es
          // necesariamente una calle del indice. Quien usa el campo decide que
          // significa eso — en el retiro, perder el punto; en la entrega, nada.
          setUltimoElegido(null);
          onTexto(e.target.value);
        }}
        onKeyDown={alTeclear}
        onFocus={() => {
          if (visibles.length > 0) setAbierto(true);
        }}
      />

      {mostrarLista && (
        <ul
          id={listaId}
          role="listbox"
          aria-label={label}
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {visibles.map((opcion, i) => (
            <li
              key={opcion.clave}
              id={`${id}-op-${i}`}
              role="option"
              aria-selected={i === activo}
              // onMouseDown y no onClick: el click llega despues del blur, y
              // para entonces la lista ya se cerro.
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(opcion);
              }}
              onMouseEnter={() => setActivo(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === activo ? "bg-brand/10 text-brand" : "text-slate-700"
              }`}
            >
              {opcion.nombre}
            </li>
          ))}
        </ul>
      )}

      {/* Los lectores de pantalla no ven una lista aparecer: hay que decirselo. */}
      <p role="status" aria-live="polite" className="sr-only">
        {anuncio}
      </p>

      {(ayuda || motivoDeshabilitado) && (
        <p id={ayudaId} className="mt-1 text-xs text-slate-500">
          {deshabilitado && motivoDeshabilitado ? motivoDeshabilitado : ayuda}
        </p>
      )}
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
