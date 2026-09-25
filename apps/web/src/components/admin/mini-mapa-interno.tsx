"use client";

import { useEffect } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export type PuntoMini = { lat: number; lng: number; etiqueta: string; sugerencia?: boolean };

function Encuadre({ puntos }: { puntos: PuntoMini[] }) {
  const map = useMap();
  useEffect(() => {
    if (puntos.length === 0) return;
    map.fitBounds(L.latLngBounds(puntos.map((p) => [p.lat, p.lng])), { padding: [24, 24], maxZoom: 16 });
  }, [map, puntos]);
  return null;
}

/**
 * Las sucursales del comercio (llenas) y las sugerencias pendientes (huecas)
 * para ver de un vistazo si un pin cae donde debería. Círculos y no íconos:
 * los íconos por defecto de Leaflet necesitan imágenes que Next no sirve.
 */
export default function MiniMapaInterno({ puntos }: { puntos: PuntoMini[] }) {
  return (
    <MapContainer
      center={[-34.9011, -56.1645]}
      zoom={12}
      scrollWheelZoom={false}
      className="border-linea h-72 w-full rounded-xl border"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; Esri'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        maxNativeZoom={16}
        maxZoom={19}
      />
      {puntos.map((p, i) => (
        <CircleMarker
          key={`${p.lat},${p.lng},${i}`}
          center={[p.lat, p.lng]}
          radius={8}
          pathOptions={
            p.sugerencia
              ? { color: "#b45309", weight: 2, fillOpacity: 0, dashArray: "3 3" }
              : { color: "#fff", weight: 2, fillColor: "#0f6fd6", fillOpacity: 1 }
          }
        >
          <Tooltip>{p.etiqueta}</Tooltip>
        </CircleMarker>
      ))}
      <Encuadre puntos={puntos} />
    </MapContainer>
  );
}
