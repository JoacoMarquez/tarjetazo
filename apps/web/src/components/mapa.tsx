"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import "leaflet/dist/leaflet.css";
import type { Bbox, PuntoMapa } from "@/lib/consultas";
import { capturar } from "@/lib/analitica";

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

/**
 * Los clusters de react-leaflet-cluster vienen con su propio CSS, que sin
 * importar los deja invisibles. Los dibujamos nosotros y de paso quedan con la
 * marca, igual que los pines sueltos.
 */
function iconoCluster(cluster: { getChildCount: () => number }): L.DivIcon {
  const n = cluster.getChildCount();
  const tamano = n < 10 ? 32 : n < 50 ? 38 : 44;
  return L.divIcon({
    className: "",
    html: `<span class="num flex items-center justify-center rounded-pill border-2 border-white bg-[var(--cielo-ink)] text-xs font-bold text-white shadow-md" style="width:${tamano}px;height:${tamano}px">${n}</span>`,
    iconSize: [tamano, tamano],
    iconAnchor: [tamano / 2, tamano / 2],
  });
}

function AvisarMovimiento({ onMover }: { onMover: (b: Bbox) => void }) {
  // El callback cambia de identidad en cada render del padre. Si lo pusiéramos
  // como dependencia del efecto, avisar → render → nuevo callback → avisar
  // sería un bucle infinito de consultas.
  const ultimo = useRef(onMover);
  ultimo.current = onMover;

  const avisar = useCallback((m: L.Map) => {
    const b = m.getBounds();
    ultimo.current({
      sur: b.getSouth(),
      oeste: b.getWest(),
      norte: b.getNorth(),
      este: b.getEast(),
    });
  }, []);

  const mapa = useMapEvents({
    moveend: () => avisar(mapa),
    zoomend: () => avisar(mapa),
  });

  // Una sola vez al montar, para la primera carga de puntos.
  useEffect(() => {
    avisar(mapa);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

/** Mientras el mapa está montado, seguimos los cambios de tamaño del panel. */
function AjustarAlContenedor() {
  const mapa = useMap();
  useEffect(() => {
    const observador = new ResizeObserver(() => mapa.invalidateSize());
    observador.observe(mapa.getContainer());
    return () => observador.disconnect();
  }, [mapa]);
  return null;
}

/**
 * Leaflet mide el contenedor al crearse y no vuelve a hacerlo solo. Si nace
 * dentro de un panel que todavía mide cero —el layout flex antes del primer
 * pintado, o la vista de mapa que en mobile arranca oculta— dibuja los tiles y
 * los pines sobre un mapa más chico que el que se ve, y ni `invalidateSize` lo
 * recupera bien: reposiciona el panel en vez de recalcular. Por eso esperamos a
 * tener medida real antes de crearlo.
 */
function useMedido() {
  const ref = useRef<HTMLDivElement>(null);
  const [medido, setMedido] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Caso normal (escritorio): el panel ya tiene tamaño al montar. Se mide
    // directo, y no con requestAnimationFrame, que no corre si la pestaña está
    // en segundo plano.
    const { width, height } = el.getBoundingClientRect();
    if (width > 0 && height > 0) {
      setMedido(true);
      return;
    }

    // Si todavía mide cero es la vista de mapa de mobile, que arranca oculta.
    // Se espera con IntersectionObserver y no con ResizeObserver: un elemento
    // con display:none no genera observaciones de tamaño ni al hacerse visible.
    const observador = new IntersectionObserver(([entrada]) => {
      if (!entrada?.isIntersecting) return;
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setMedido(true);
        observador.disconnect();
      }
    });
    observador.observe(el);
    return () => observador.disconnect();
  }, []);
  return { ref, medido };
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
  const { ref, medido } = useMedido();

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
            <a className="text-[var(--cielo)] mt-1 mr-3 inline-block text-xs font-medium underline" href={`/comercio/${p.comercio_key}`}>
              Ver beneficios
            </a>
            <a
              className="text-[var(--cielo)] mt-1 inline-block text-xs font-medium underline"
              href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
              target="_blank"
              rel="noreferrer noopener"
              onClick={() => capturar("click_saliente", { destino: "google_maps", comercio: p.comercio_key })}
            >
              Cómo llegar
            </a>
          </Popup>
        </Marker>
      )),
    [puntos],
  );

  return (
    <div ref={ref} className="bg-papel relative size-full">
      {medido && (
      <MapContainer
        center={CENTRO}
        zoom={13}
        scrollWheelZoom
        className="size-full"
        // Leaflet dibuja sus paneles con z-index altos; los bajamos para que la
        // hoja del mobile y los popovers queden por encima.
        style={{ zIndex: 0 }}
      >
        {/* CARTO pasó a pedir API key en sus basemaps, así que usamos los
            tiles estándar de OpenStreetMap, que no la piden. */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <AjustarAlContenedor />
        <AvisarMovimiento onMover={onMover} />
        <IrA punto={irA} />
        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={50}
          iconCreateFunction={iconoCluster}
          showCoverageOnHover={false}
        >
          {marcadores}
        </MarkerClusterGroup>
      </MapContainer>
      )}

      {medido && (recortado || cargando) && (
        <p className="border-linea bg-card/95 text-humo absolute left-1/2 top-3 z-1000 -translate-x-1/2 rounded-pill border px-3 py-1.5 text-xs shadow-sm">
          {cargando ? "Buscando locales…" : "Hay más locales de los que entran: acercá el mapa"}
        </p>
      )}
    </div>
  );
}
