export type PrecisionGeo = "exacta" | "calle" | "localidad" | "aproximada";

export interface Punto {
  lat: number;
  lng: number;
  precision: PrecisionGeo;
  fuente: "ide_uy" | "nominatim" | "osm";
  direccion_normalizada: string | null;
  departamento: string | null;
  localidad: string | null;
}

/** Uruguay entero, con margen. Sirve para descartar resultados de otro país. */
export const BBOX_UY = { sur: -35.1, oeste: -58.6, norte: -29.9, este: -53.0 };

export function dentroDeUruguay(lat: number, lng: number): boolean {
  return (
    lat >= BBOX_UY.sur && lat <= BBOX_UY.norte && lng >= BBOX_UY.oeste && lng <= BBOX_UY.este
  );
}
