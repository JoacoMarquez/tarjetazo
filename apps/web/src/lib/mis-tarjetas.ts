"use client";

import { useCallback, useEffect, useState } from "react";

const CLAVE = "tarjetazo:mis-tarjetas";

export interface MisTarjetas {
  bancos: string[];
  productos: string[];
}

const VACIO: MisTarjetas = { bancos: [], productos: [] };

function leer(): MisTarjetas {
  if (typeof window === "undefined") return VACIO;
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (!crudo) return VACIO;
    const v = JSON.parse(crudo) as Partial<MisTarjetas>;
    return {
      bancos: Array.isArray(v.bancos) ? v.bancos : [],
      productos: Array.isArray(v.productos) ? v.productos : [],
    };
  } catch {
    // Modo privado, storage bloqueado o JSON corrupto: seguimos sin tarjetas.
    return VACIO;
  }
}

/**
 * Las tarjetas del usuario viven en localStorage, no en una cuenta: nunca
 * pedimos el número ni ningún dato personal. La URL puede traerlas cuando
 * alguien comparte un link, y en ese caso mandan sobre lo guardado.
 */
export function useMisTarjetas(desdeUrl?: { bancos: string[]; productos: string[] }) {
  const [tarjetas, setTarjetas] = useState<MisTarjetas>(VACIO);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    const guardadas = leer();
    const hayEnUrl = (desdeUrl?.bancos.length ?? 0) > 0;
    setTarjetas(
      hayEnUrl ? { bancos: desdeUrl!.bancos, productos: desdeUrl!.productos } : guardadas,
    );
    setCargado(true);
    // Solo al montar: después manda el estado local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guardar = useCallback((nuevas: MisTarjetas) => {
    setTarjetas(nuevas);
    try {
      window.localStorage.setItem(CLAVE, JSON.stringify(nuevas));
    } catch {
      // Sin storage el estado vive solo en memoria; no es motivo para romper.
    }
  }, []);

  const limpiar = useCallback(() => guardar(VACIO), [guardar]);

  return { tarjetas, guardar, limpiar, cargado, tieneTarjetas: tarjetas.bancos.length > 0 };
}
