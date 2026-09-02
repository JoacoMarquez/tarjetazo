"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import "leaflet/dist/leaflet.css";
import type { Bbox, PuntoMapa } from "@/lib/consultas";

/** Montevideo centro: el punto de partida razonable para Uruguay. */
const CENTRO: [number, number] = [-34.9011, -56.1645];

/**
 * Pin propio: el número es la información, no el ícono. Se dibuja con HTML
 * porque Leaflet no acepta componentes de React dentro de un marcador.
 */
function icono(p: PuntoMapa): L.DivIcon {
  const etiqueta =
    p.best_pct != null
      ? `${Math.round(p.best_pct)}%`
      : p.max_cuotas
        ? `${p.max_cuotas}c`
        : "•";
  return L.divIcon({
    className: "",
    html: `<span class="num flex h-7 min-w-7 items-center justify-center rounded-pill border-2 border-white bg-[var(--cielo)] px-1.5 text-xs font-bold text-white shadow-md">${etiqueta}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

function AvisarMovimiento({ onMover }: { onMover: (b: Bbox) => void }) {
  const mapa = useMapEvents({
    moveend: () => avisar(),
    zoomend: () => avisar(),
  });
  const avisar = useCallback(() => {
    const b = mapa.getBounds();
    onMover({
      sur: b.getSouth(),
      oeste: b.getWest(),
      norte: b.getNorth(),
      este: b.getEast(),
    });
  }, [mapa, onMover]);
  useEffect(avisar, [avisar]);
  return null;
}

function IrA({ punto }: { punto: [number, number] | null }) {
  const mapa = useMap();
  useEffect(() => {
    if (punto) mapa.flyTo(punto, Math.max(mapa.getZoom(), 15), { duration: 0.8 });
  }, [punto, mapa]);
  return null;
}

export default function Mapa({
  puntos,
  recortado,
  cargando,
  onMover,
  irA,
}: {
  puntos: PuntoMapa[];
  recortado: boolean;
  cargando: boolean;
  onMover: (b: Bbox) => void;
  irA: [number, number] | null;
}) {
  const [listo, setListo] = useState(false);
  useEffect(() => setListo(true), []);

  const marcadores = useMemo(
    () =>
      puntos.map((p) => (
        <Marker key={p.sucursal_id} position={[p.lat, p.lng]} icon={icono(p)}>
          <Popup>
            <span className="font-display block text-sm font-bold">{p.comercio}</span>
            <span className="block text-xs text-[var(--humo)]">{p.direccion}</span>
            <span className="mt-1 block text-xs">
              {p.n_beneficios} {p.n_beneficios === 1 ? "beneficio" : "beneficios"}
              {p.best_pct != null && ` · hasta ${Math.round(p.best_pct)}%`}
            </span>
            <a
              className="text-[var(--cielo)] mt-1 inline-block text-xs font-medium underline"
              href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              Cómo llegar
            </a>
          </Popup>
        </Marker>
      )),
    [puntos],
  );

  if (!listo) return <div className="bg-papel size-full" />;

  return (
    <div className="relative size-full">
      <MapContainer
        center={CENTRO}
        zoom={13}
        scrollWheelZoom
        className="size-full"
        // Leaflet dibuja sus paneles con z-index altos; los bajamos para que la
        // hoja del mobile y los popovers queden por encima.
        style={{ zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <AvisarMovimiento onMover={onMover} />
        <IrA punto={irA} />
        <MarkerClusterGroup chunkedLoading maxClusterRadius={50}>
          {marcadores}
        </MarkerClusterGroup>
      </MapContainer>

      {(recortado || cargando) && (
        <p className="border-linea bg-card/95 text-humo absolute left-1/2 top-3 z-1000 -translate-x-1/2 rounded-pill border px-3 py-1.5 text-xs shadow-sm">
          {cargando ? "Buscando locales…" : "Hay más locales de los que entran: acercá el mapa"}
        </p>
      )}
    </div>
  );
}
