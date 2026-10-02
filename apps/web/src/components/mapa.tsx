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
import { colorFuente, meSirve } from "@/lib/marca";
import { capturar } from "@/lib/analitica";

/** Montevideo centro: el punto de partida razonable para Uruguay. */
const CENTRO: [number, number] = [-34.9011, -56.1645];

const escapar = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Primera letra (o número) del nombre, para la cara del pin. */
function inicial(nombre: string): string {
  return (nombre.match(/[\p{L}\p{N}]/u)?.[0] ?? "•").toUpperCase();
}

/**
 * Pin como el de manguito: la inicial del comercio en un círculo con el color
 * del banco del mejor beneficio, el descuento en una etiqueta arriba y "+N"
 * si el local tiene más beneficios. Si el usuario eligió tarjetas y ninguna
 * sirve acá, el pin queda en gris: se ve, pero no compite. Se dibuja con HTML
 * porque Leaflet no acepta componentes de React dentro de un marcador.
 */
function icono(p: PuntoMapa, mias?: string[], seleccionado = false): L.DivIcon {
  const etiqueta =
    p.best_pct != null ? `${Math.round(p.best_pct)}%` : p.max_cuotas ? `${p.max_cuotas} cuotas` : null;
  const c = colorFuente(p.mejor_fuente_id);
  const laTengo =
    !mias || meSirve(p.mejor_fuente_id, p.mejor_productos, mias);
  const fondo = laTengo ? c.color : "#9aa5b1";
  const escala = seleccionado ? "transform:scale(1.2);" : "";
  const anillo = seleccionado ? `box-shadow:0 0 0 3px #fff,0 0 0 6px ${c.color},0 4px 10px rgba(20,32,44,.3);` : "box-shadow:0 3px 8px rgba(20,32,44,.3);";
  const mas = p.n_beneficios > 1
    ? `<span class="num" style="position:absolute;left:24px;bottom:-4px;min-width:18px;height:18px;padding:0 4px;border-radius:999px;background:#14202c;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid #fff">+${p.n_beneficios - 1}</span>`
    : "";
  const tag = etiqueta
    ? `<span class="num" style="margin-bottom:3px;padding:1px 6px;border-radius:999px;font-size:11px;font-weight:800;line-height:16px;white-space:nowrap;${laTengo ? `background:${c.ink};color:#fff` : "background:#fff;color:#6b7683;border:1px solid #e4e0d6"}">${etiqueta}</span>`
    : "";
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;flex-direction:column;align-items:center;width:64px;transform-origin:50% 100%;${escala}${seleccionado ? "z-index:5;" : ""}">
      ${tag}
      <span style="position:relative;display:block">
        ${
          p.logo_url
            ? // Con logo: el logo sobre blanco, con un aro del color del banco (o gris).
              `<span style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:#fff;border:2.5px solid ${fondo};overflow:hidden;${anillo}"><img src="${escapar(p.logo_url)}" alt="" style="width:100%;height:100%;object-fit:contain;padding:3px" loading="lazy"></span>`
            : `<span class="font-display" style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:${fondo};color:#fff;font-size:15px;font-weight:800;border:2.5px solid #fff;${anillo}">${escapar(inicial(p.comercio))}</span>`
        }
        <span style="position:absolute;left:50%;bottom:-5px;width:10px;height:10px;background:#fff;transform:translateX(-50%) rotate(45deg);border-radius:0 0 3px 0;z-index:-1"></span>
        ${mas}
      </span>
    </div>`,
    iconSize: [64, 62],
    iconAnchor: [32, 62],
    popupAnchor: [0, -58],
  });
}

/**
 * Los clusters de react-leaflet-cluster vienen con su propio CSS, que sin
 * importar los deja invisibles. Los dibujamos nosotros: un círculo oscuro con
 * la cantidad, como en manguito, para que no compitan con los pines.
 */
function iconoCluster(cluster: { getChildCount: () => number }): L.DivIcon {
  const n = cluster.getChildCount();
  const tamano = n < 10 ? 28 : n < 50 ? 34 : 40;
  return L.divIcon({
    className: "",
    html: `<span class="num" style="display:flex;align-items:center;justify-content:center;width:${tamano}px;height:${tamano}px;border-radius:50%;background:#14202c;color:#fff;font-size:12px;font-weight:700;border:2px solid #fff;box-shadow:0 3px 8px rgba(20,32,44,.3)">${n}</span>`,
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
  conAviso = true,
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
  /** Explorar dibuja el aviso "Hay más locales" en el área libre, no encima de la lista. */
  conAviso?: boolean;
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
            propio
              ? {
                  click: () => {
                    capturar("mapa_comercio", { comercio: p.comercio_key });
                    elegir.current?.(p);
                  },
                }
              : { popupopen: () => capturar("mapa_comercio", { comercio: p.comercio_key }) }
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

      {conAviso && medido && (recortado || cargando) && (
        <p className="border-linea bg-card/95 text-humo absolute left-1/2 top-3 z-1000 -translate-x-1/2 rounded-pill border px-3 py-1.5 text-xs shadow-sm">
          {cargando
            ? "Buscando locales…"
            : "Hay más locales de los que entran: acercá el mapa"}
        </p>
      )}
    </div>
  );
}
