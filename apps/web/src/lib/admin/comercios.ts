/**
 * Página de comercios del backoffice: cobertura de cada comercio y sus
 * sugerencias de ubicación (OSM). Lo scrapeado no se edita: acá solo se suman
 * sucursales (a mano o aceptando una sugerencia) y se fusionan duplicados.
 */

export type FilaComercio = {
  key: string;
  nombre: string;
  categoria: string;
  fuentes: string[];
  beneficios: number;
  sucursales: number;
  con_pin: number;
  sugerencias: number;
  buscado_en: string | null;
};

export type Filtro = "sin-ubicacion" | "con-sugerencias" | "todos";
export const FILTROS: { id: Filtro; etiqueta: string }[] = [
  { id: "sin-ubicacion", etiqueta: "Sin ubicación" },
  { id: "con-sugerencias", etiqueta: "Con sugerencias" },
  { id: "todos", etiqueta: "Todos" },
];

export function filtrar(
  filas: FilaComercio[],
  { filtro, fuente, rubro, q }: { filtro: Filtro; fuente?: string; rubro?: string; q?: string },
): FilaComercio[] {
  const busqueda = q?.trim().toLowerCase();
  return filas
    .filter((f) => (filtro === "sin-ubicacion" ? f.con_pin === 0 : filtro === "con-sugerencias" ? f.sugerencias > 0 : true))
    .filter((f) => !fuente || f.fuentes.includes(fuente))
    .filter((f) => !rubro || f.categoria === rubro)
    .filter((f) => !busqueda || f.nombre.toLowerCase().includes(busqueda) || f.key.includes(busqueda))
    .sort((a, b) => b.beneficios - a.beneficios || a.nombre.localeCompare(b.nombre));
}

export type SugerenciaUbicacion = {
  id: string;
  comercio_key: string;
  osm_id: string | null;
  nombre: string | null;
  direccion: string;
  localidad: string | null;
  departamento: string | null;
  lat: number;
  lng: number;
  tipo: string | null;
  consulta: string;
  estado: "pendiente" | "aceptada" | "ignorada";
};

export type SucursalAdmin = {
  id: string;
  nombre: string | null;
  direccion: string;
  localidad: string | null;
  departamento: string;
  exactitud: string | null;
  fuente_direccion: string | null;
  lat: number | null;
  lng: number | null;
};

/** Las que se pueden borrar desde acá: las que no trae una fuente. */
export const FUENTES_EDITABLES = new Set(["manual", "osm_sugerencia"]);

export function urlOsm(osmId: string | null): string | null {
  return osmId ? `https://www.openstreetmap.org/${osmId}` : null;
}
