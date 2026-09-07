"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Bbox, PuntoMapa } from "@/lib/consultas";
import { useBilletera } from "@/lib/billetera";
import { cifraBeneficio } from "@/lib/formato";
import { colorFuente } from "@/lib/marca";

// Leaflet toca `window` al importarse: el mapa sólo puede cargarse en el cliente.
const Mapa = dynamic(() => import("@/components/mapa"), {
  ssr: false,
  loading: () => <div className="bg-papel size-full" />,
});

/** Montevideo centro: el punto de partida cuando no hay permiso de ubicación. */
const CENTRO: [number, number] = [-34.9011, -56.1645];
/** Radio inicial de la consulta, en grados (~2,5 km). */
const RADIO = 0.022;

function distanciaKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function formatearDistancia(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace(".", ",")} km`;
}

export function CercaTuyo() {
  const { mis } = useBilletera();
  const [centro, setCentro] = useState<[number, number]>(CENTRO);
  const [propia, setPropia] = useState(false);
  const [puntos, setPuntos] = useState<PuntoMapa[]>([]);
  const [recortado, setRecortado] = useState(false);
  const [cargando, setCargando] = useState(true);

  // Pedimos la ubicación una vez; si la niegan o tarda, queda Montevideo.
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCentro([pos.coords.latitude, pos.coords.longitude]);
        setPropia(true);
      },
      () => {},
      { timeout: 6000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  const consultar = useCallback(async (b: Bbox) => {
    setCargando(true);
    try {
      const params = new URLSearchParams({
        sur: String(b.sur),
        oeste: String(b.oeste),
        norte: String(b.norte),
        este: String(b.este),
        dia: "hoy",
      });
      const r = await fetch(`/api/mapa?${params}`);
      const json = (await r.json()) as { puntos?: PuntoMapa[]; recortado?: boolean };
      setPuntos(json.puntos ?? []);
      setRecortado(json.recortado ?? false);
    } catch {
      // Sin datos la sección se apaga sola: la lista queda vacía.
      setPuntos([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    consultar({
      sur: centro[0] - RADIO,
      norte: centro[0] + RADIO,
      oeste: centro[1] - RADIO,
      este: centro[1] + RADIO,
    });
  }, [centro, consultar]);

  const cercanos = useMemo(
    () =>
      puntos
        .map((p) => ({ p, km: distanciaKm(centro, [p.lat, p.lng]) }))
        .sort((a, b) => a.km - b.km)
        .slice(0, 5),
    [puntos, centro],
  );

  if (!cargando && puntos.length === 0) return null;

  return (
    <section className="pt-18">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="font-display m-0 text-[28px] font-bold tracking-tight text-tinta">
          Cerca tuyo
        </h2>
        <span className="text-sm text-tinta">
          {propia ? "Tu zona" : "Montevideo centro"} · {puntos.length}
          {recortado ? "+" : ""} locales con descuento hoy
        </span>
      </div>

      <div
        className="mt-5 grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}
      >
        <div className="border-linea relative min-h-[300px] overflow-hidden rounded-2xl border">
          <Mapa
            puntos={puntos}
            recortado={recortado}
            cargando={cargando}
            onMover={consultar}
            irA={centro}
            mias={mis}
            zoomConRueda={false}
          />
          <Link
            href="/app"
            className="absolute bottom-3 left-3 z-500 rounded-[10px] px-3 py-2 text-[13px] font-medium text-white"
            style={{ background: "#14202c" }}
          >
            Abrir el mapa
          </Link>
        </div>

        <div className="flex flex-col gap-2">
          {cercanos.map(({ p, km }) => {
            const c = colorFuente(p.mejor_fuente_id);
            const laTengo =
              p.mejor_productos.length === 0 || p.mejor_productos.some((id) => mis.includes(id));
            return (
              <Link
                key={p.sucursal_id}
                href={`/comercio/${p.comercio_key}`}
                className="border-linea flex items-center gap-3 rounded-[14px] border bg-white px-3.5 py-3"
                style={{ opacity: laTengo ? 1 : 0.6 }}
              >
                <span
                  className="h-[22px] w-[34px] flex-none rounded"
                  style={{
                    background: laTengo ? c.color : "transparent",
                    border: `1.5px dashed ${laTengo ? "transparent" : c.color}`,
                    boxSizing: "border-box",
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-tinta">
                    {p.comercio} · {p.direccion}
                  </div>
                  <div className="text-xs text-tinta">
                    {formatearDistancia(km)} · {p.mejor_fuente}
                    {laTengo ? "" : " · no la tenés"}
                  </div>
                </div>
                <span
                  className="num text-lg font-bold"
                  style={{ color: laTengo ? c.ink : "#6b7683" }}
                >
                  {cifraBeneficio({
                    porcentaje: p.best_pct,
                    cuotas: p.max_cuotas,
                    tipo: "porcentaje",
                  })}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
