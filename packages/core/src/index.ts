export * from "./enums";
export * from "./schema";
export { CATEGORIAS, SLUGS_CATEGORIAS } from "./categorias";
export { FUENTES, PRODUCTOS } from "./fuentes";
export { origenSupabase } from "./supabase";
export { esErrorDeTramo, normalizarNombreTarjeta, problemasDeMotivo } from "./revision";
export {
  EQUIVALENCIAS_PRODUCTO,
  FAMILIAS,
  FAMILIA_POR_ID,
  NOMBRE_FAMILIA,
  expandirProductos,
  familiaDe,
  familiasDe,
  type Familia,
} from "./catalogo";
