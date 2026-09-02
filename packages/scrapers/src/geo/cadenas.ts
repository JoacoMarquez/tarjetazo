/**
 * Cadenas cuyas sucursales sí están en OpenStreetMap, mapeadas al comercio que
 * el scraper creó. Los comercios chicos (una óptica, una confitería) no están
 * en OSM: esos quedan sin mapa hasta que aparezca otra fuente de direcciones.
 *
 * `nombres` y `marcas` se comparan exactos contra los tags `name` y `brand`:
 * las consultas con regex sobre todo el país expiran en Overpass.
 *
 * Acá va solo la cadena que el beneficio nombra. Los comercios genéricos que
 * publica BROU ("Farmacias", "Restaurantes adheridos") no se resuelven a una
 * cadena concreta: mapear "Farmacias" a Farmashop sería inventar que el
 * beneficio aplica ahí.
 */
export interface Cadena {
  comercio_key: string;
  nombres?: string[];
  marcas?: string[];
}

export const CADENAS: readonly Cadena[] = [
  { comercio_key: "tata", nombres: ["Ta-Ta", "TaTa"], marcas: ["Ta-Ta"] },
  { comercio_key: "tienda-inglesa", nombres: ["Tienda Inglesa"], marcas: ["Tienda Inglesa"] },
  { comercio_key: "el-dorado", nombres: ["El Dorado"] },
  { comercio_key: "macromercado", nombres: ["Macromercado", "Macro Mercado"] },
  { comercio_key: "micro-macro", nombres: ["Micro Macro", "MicroMacro"] },
  { comercio_key: "red-expres", nombres: ["Red Expres", "Red Express"] },
  { comercio_key: "antel", nombres: ["Antel", "ANTEL"], marcas: ["Antel", "ANTEL"] },
  { comercio_key: "estaciones-ancap", nombres: ["Ancap", "ANCAP"], marcas: ["Ancap", "ANCAP"] },
  { comercio_key: "grupocine", nombres: ["Grupocine", "Grupo Cine"] },
  { comercio_key: "life-cinemas", nombres: ["Life Cinemas"] },
] as const;
