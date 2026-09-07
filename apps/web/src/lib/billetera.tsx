"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { bancosDe } from "./marca";

const CLAVE = "tarjetazo:mis-tarjetas";

/** 0 cerrada · 1 montada (para que el primer frame anime) · 2 abierta. */
export type EstadoBilletera = 0 | 1 | 2;

interface Billetera {
  /** Ids de `PRODUCTOS`. Es la única cosa del usuario que guardamos. */
  mis: string[];
  misBancos: string[];
  cargado: boolean;
  alternar: (productoId: string) => void;
  estado: EstadoBilletera;
  abrir: (opciones?: { agregar?: boolean; banco?: string }) => void;
  cerrar: () => void;
  destacada: number | null;
  destacar: (i: number | null) => void;
  agregando: boolean;
  alternarAgregar: () => void;
  banco: string;
  elegirBanco: (id: string) => void;
}

const Contexto = createContext<Billetera | null>(null);

function leer(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (!crudo) return [];
    const v = JSON.parse(crudo) as { productos?: unknown };
    return Array.isArray(v.productos) ? (v.productos as string[]) : [];
  } catch {
    // Modo privado o JSON corrupto: se sigue sin tarjetas.
    return [];
  }
}

export function ProveedorBilletera({ children }: { children: ReactNode }) {
  const [mis, setMis] = useState<string[]>([]);
  const [cargado, setCargado] = useState(false);
  const [estado, setEstado] = useState<EstadoBilletera>(0);
  const [destacada, setDestacada] = useState<number | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [banco, setBanco] = useState("brou");

  useEffect(() => {
    setMis(leer());
    setCargado(true);
  }, []);

  const guardar = useCallback((productos: string[]) => {
    setMis(productos);
    try {
      // Guardamos también los bancos: es la forma que espera /app.
      window.localStorage.setItem(
        CLAVE,
        JSON.stringify({ bancos: bancosDe(productos), productos }),
      );
    } catch {
      // Sin storage el estado vive en memoria; no es motivo para romper.
    }
  }, []);

  const alternar = useCallback(
    (id: string) => {
      setDestacada(null);
      guardar(mis.includes(id) ? mis.filter((x) => x !== id) : [...mis, id]);
    },
    [mis, guardar],
  );

  const abrir = useCallback((opciones?: { agregar?: boolean; banco?: string }) => {
    setAgregando(opciones?.agregar ?? false);
    if (opciones?.banco) setBanco(opciones.banco);
    setEstado(1);
    // Dos frames: el primero monta en el estado cerrado, el segundo dispara
    // las transiciones (fondo, subida del contenedor, apertura de la tira).
    requestAnimationFrame(() => requestAnimationFrame(() => setEstado(2)));
  }, []);

  const cerrar = useCallback(() => {
    setEstado(1);
    setDestacada(null);
    setAgregando(false);
    // Se desmonta recién cuando terminaron las transiciones de cierre.
    setTimeout(() => setEstado((e) => (e === 1 ? 0 : e)), 500);
  }, []);

  // Escape cierra, como cualquier diálogo.
  useEffect(() => {
    if (estado === 0) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && cerrar();
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [estado, cerrar]);

  // Con la billetera abierta la rueda del mouse recorre la escalera de
  // tarjetas en lugar de scrollear la página.
  useEffect(() => {
    if (estado !== 2) return;
    let acumulado = 0;
    let bloqueoHasta = 0;
    const alRodar = (e: WheelEvent) => {
      e.preventDefault();
      const ahora = Date.now();
      if (ahora < bloqueoHasta) return;
      acumulado += e.deltaY;
      if (Math.abs(acumulado) < 24) return;
      const dir = acumulado < 0 ? 1 : -1;
      acumulado = 0;
      bloqueoHasta = ahora + 220;
      setDestacada((h) =>
        h == null
          ? dir > 0
            ? 0
            : mis.length - 1
          : Math.max(0, Math.min(mis.length - 1, h + dir)),
      );
    };
    window.addEventListener("wheel", alRodar, { passive: false });
    return () => window.removeEventListener("wheel", alRodar);
  }, [estado, mis.length]);

  const valor = useMemo<Billetera>(
    () => ({
      mis,
      misBancos: bancosDe(mis),
      cargado,
      alternar,
      estado,
      abrir,
      cerrar,
      destacada,
      destacar: setDestacada,
      agregando,
      alternarAgregar: () => setAgregando((a) => !a),
      banco,
      elegirBanco: setBanco,
    }),
    [mis, cargado, alternar, estado, abrir, cerrar, destacada, agregando, banco],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useBilletera(): Billetera {
  const v = useContext(Contexto);
  if (!v) throw new Error("useBilletera necesita <ProveedorBilletera>");
  return v;
}
