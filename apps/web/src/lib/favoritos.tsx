"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { capturar } from "./analitica";

const CLAVE = "tarjetazo:favoritos";

/**
 * Comercios favoritos (#115): una lista de `comercio_key` en el navegador, como
 * la billetera. Sin cuenta ni datos personales (es lo que promete
 * /privacidad); no se sincroniza entre dispositivos.
 */
interface Favoritos {
  /** Keys de comercio, la última guardada primero. */
  keys: string[];
  cargado: boolean;
  esFavorito: (key: string) => boolean;
  alternar: (key: string) => void;
}

const Contexto = createContext<Favoritos | null>(null);

function leer(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const v = JSON.parse(window.localStorage.getItem(CLAVE) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    // Modo privado o JSON corrupto: sin favoritos.
    return [];
  }
}

export function ProveedorFavoritos({ children }: { children: ReactNode }) {
  const [keys, setKeys] = useState<string[]>([]);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    setKeys(leer());
    setCargado(true);
    // Otra pestaña guardó o sacó un favorito.
    const alCambiar = (e: StorageEvent) => e.key === CLAVE && setKeys(leer());
    window.addEventListener("storage", alCambiar);
    return () => window.removeEventListener("storage", alCambiar);
  }, []);

  const alternar = useCallback((key: string) => {
    setKeys((actuales) => {
      const tiene = actuales.includes(key);
      const nuevas = tiene ? actuales.filter((k) => k !== key) : [key, ...actuales];
      capturar(tiene ? "favorito_quitado" : "favorito_agregado", { comercio: key });
      try {
        window.localStorage.setItem(CLAVE, JSON.stringify(nuevas));
      } catch {
        // Sin almacenamiento: vale para esta visita.
      }
      return nuevas;
    });
  }, []);

  const valor = useMemo<Favoritos>(
    () => ({ keys, cargado, esFavorito: (key) => keys.includes(key), alternar }),
    [keys, cargado, alternar],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useFavoritos(): Favoritos {
  const v = useContext(Contexto);
  if (!v) throw new Error("useFavoritos fuera de ProveedorFavoritos");
  return v;
}
