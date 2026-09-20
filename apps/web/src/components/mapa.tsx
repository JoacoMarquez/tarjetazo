"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import "leaflet/dist/leaflet.css";
import type { Bbox, PuntoMapa } from "@/lib/consultas";
import { colorFuente } from "@/lib/marca";
import { capturar } from "@/lib/analitica";

/** Montevideo centro: el punto de partida razonable para Uruguay. */
const CENTRO: [number, number] = [-34.9011, -56.1645];

/**
 * Pin propio: el número es la información, no el ícono. Se dibuja con HTML
 * porque Leaflet no acepta componentes de React dentro de un marcador.
 */
function icono(p: PuntoMapa, mias?: string[], seleccionado = false): L.DivIcon {
  const etiqueta =
    p.best_pct != null
      ? `${Math.round(p.best_pct)}%`
      : p.max_cuotas
        ? `${p.max_cuotas}c`
        : "•";
  const color = colorFuente(p.mejor_fuente_id).color;
  // Con la lista de tarjetas del usuario, el pin de un local que no puede
  // aprovechar sale en blanco y punteado: se ve, pero no compite.
  const laTengo =
    !mias ||
    p.mejor_productos.length === 0 ||
    p.mejor_productos.some((id) => mias.includes(id));
  const base = laTengo
    ? `background:${color};color:#fff;border:2px solid #fff`
    : `background:#fff;color:var(--humo);border:1.5px dashed ${color}`;
  // El pin elegido crece y se rodea con el color del banco.
  const estilo = seleccionado
    ? `${base};transform:scale(1.25);outline:3px solid ${color};outline-offset:3px;z-index:5`
    : base;
  return L.divIcon({
    className: "",
    html: `<span class="num flex h-7 min-w-7 items-center justify-center rounded-pill px-1.5 text-xs font-bold shadow-md" style="${estilo}">${etiqueta}</span>`,
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

/**
 * Traduce la posición del pin elegido a píxeles del contenedor para que el
 * popup pueda anclarse a él y seguirlo mientras se mueve el mapa.
 */
function SeguirSeleccion({
  punto,
  onPos,
}: {
  punto: PuntoMapa | null;
  onPos: (p: { x: number; y: number } | null) => void;
}) {
  const mapa = useMap();
  // Igual que en AvisarMovimiento: el callback cambia de identidad en cada
  // render del padre y no puede ser dependencia del efecto.
  const ultimo = useRef(onPos);
  ultimo.current = onPos;

  const reportar = useCallback(() => {
    if (!punto) {
      ultimo.current(null);
      return;
    }
    const px = mapa.latLngToContainerPoint([punto.lat, punto.lng]);
    ultimo.current({ x: px.x, y: px.y });
  }, [punto, mapa]);

  useMapEvents({ move: reportar, zoom: reportar, resize: reportar });

  useEffect(() => {
    reportar();
  }, [reportar]);

  return null;
}

function IrA({ punto }: { punto: [number, number] | null }) {
  const mapa = useMap();
  useEffect(() => {
    if (punto)
      mapa.flyTo(punto, Math.max(mapa.getZoom(), 15), { duration: 0.8 });
  }, [punto, mapa]);
  return null;
}

export default function Mapa({
  puntos,
  recortado,
  cargando,
  onMover,
  irA,
  mias,
  zoomConRueda = true,
  seleccion = null,
  onElegirPunto,
  onPosSeleccion,
}: {
  puntos: PuntoMapa[];
  recortado: boolean;
  cargando: boolean;
  onMover: (b: Bbox) => void;
  irA: [number, number] | null;
  /** Ids de productos del usuario: apaga los pines que no le sirven. */
  mias?: string[];
  /** En la home el mapa está en medio del scroll: la rueda no hace zoom. */
  zoomConRueda?: boolean;
  /** `comercio_key` del pin elegido: crece y se rodea con el color del banco. */
  seleccion?: string | null;
  /** Con esto Explorar maneja su propia ficha en vez del popup de Leaflet. */
  onElegirPunto?: (p: PuntoMapa) => void;
  onPosSeleccion?: (p: { x: number; y: number } | null) => void;
}) {
  const { ref, medido } = useMedido();

  const propio = Boolean(onElegirPunto);
  // El callback llega nuevo en cada render; con la ref los marcadores no se
  // recrean (y con ellos todos los iconos) en cada pintada del padre.
  const elegir = useRef(onElegirPunto);
  elegir.current = onElegirPunto;

  const marcadores = useMemo(
    () =>
      puntos.map((p) => (
        <Marker
          key={p.sucursal_id}
          position={[p.lat, p.lng]}
          icon={icono(p, mias, seleccion === p.comercio_key)}
          eventHandlers={
            propio ? { click: () => elegir.current?.(p) } : undefined
          }
        >
          {!propio && (
            <Popup>
              <span className="font-display block text-sm font-bold">
                {p.comercio}
              </span>
              <span className="block text-xs text-[var(--humo)]">
                {p.direccion}
              </span>
              <span className="mt-1 block text-xs">
                {p.n_beneficios}{" "}
                {p.n_beneficios === 1 ? "beneficio" : "beneficios"}
                {p.best_pct != null && ` · hasta ${Math.round(p.best_pct)}%`}
              </span>
              <a
                className="text-[var(--cielo)] mt-1 mr-3 inline-block text-xs font-medium underline"
                href={`/comercio/${p.comercio_key}`}
              >
                Ver beneficios
              </a>
              <a
                className="text-[var(--cielo)] mt-1 inline-block text-xs font-medium underline"
                href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
                target="_blank"
                rel="noreferrer noopener"
                onClick={() =>
                  capturar("click_saliente", {
                    destino: "google_maps",
                    comercio: p.comercio_key,
                  })
                }
              >
                Cómo llegar
              </a>
            </Popup>
          )}
        </Marker>
      )),
    [puntos, mias, seleccion, propio],
  );

  return (
    <div ref={ref} className="bg-papel relative size-full">
      {medido && (
        <MapContainer
          center={CENTRO}
          zoom={13}
          scrollWheelZoom={zoomConRueda}
          className="size-full"
          // Leaflet dibuja sus paneles con z-index altos; los bajamos para que la
          // hoja del mobile y los popovers queden por encima.
          style={{ zIndex: 0 }}
        >
          {/* Light Gray Canvas de Esri: gris desaturado tipo Positron, para
            que los pines con la cifra sean lo único con color del mapa. No
            pide API key; los de CARTO, que es lo que usa manguito, llegan con
            marca de agua si no se les pasa una.

            Viene en dos capas (fondo y etiquetas) y tiene datos hasta z16: de
            ahí en más `maxNativeZoom` hace que Leaflet agrande el último tile
            en vez de pedir uno que vuelve en blanco. */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; Esri'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
            maxNativeZoom={16}
            maxZoom={19}
          />
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
            maxNativeZoom={16}
            maxZoom={19}
          />
          <AjustarAlContenedor />
          <AvisarMovimiento onMover={onMover} />
          <IrA punto={irA} />
          {onPosSeleccion && (
            <SeguirSeleccion
              punto={puntos.find((p) => p.comercio_key === seleccion) ?? null}
              onPos={onPosSeleccion}
            />
          )}
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
          {cargando
            ? "Buscando locales…"
            : "Hay más locales de los que entran: acercá el mapa"}
        </p>
      )}
    </div>
  );
}
