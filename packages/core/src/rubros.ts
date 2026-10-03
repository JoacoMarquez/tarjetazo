/**
 * Beneficios de rubro entero ("20% los lunes en todas las librerías"). No son
 * de un comercio: viven en un comercio canónico por rubro ("Todas las
 * librerías", key `todo-librerias`), que sale en los listados, la búsqueda y
 * el comparador como cualquier otro, pero no en el mapa (no tiene locales).
 * Además, la página de cada librería los muestra como "también aplica", con la
 * advertencia de que no todos los locales adhieren.
 *
 * Las categorías de Tarjetazo son más gruesas que estos rubros (peluquerías y
 * ópticas están las dos en "salud y belleza"), así que cada rubro dice qué
 * comercios le corresponden: toda una categoría, o los de una categoría cuyo
 * nombre coincide con el patrón.
 */

export interface RubroEntero {
  /** "librerias": la key del comercio canónico es `todo-librerias`. */
  id: string;
  /** "Todas las librerías": el nombre del comercio canónico. */
  nombre: string;
  /** "librerías": para "también en todas las librerías". */
  plural: string;
  categoria: string;
  /** Sin patrón, todos los comercios de la categoría son del rubro. */
  patron?: RegExp;
}

export const RUBROS_ENTEROS: readonly RubroEntero[] = [
  { id: "supermercados", nombre: "Todos los supermercados", plural: "supermercados", categoria: "supermercados" },
  { id: "restaurantes", nombre: "Todos los restaurantes", plural: "restaurantes", categoria: "restaurantes" },
  { id: "heladerias", nombre: "Todas las heladerías", plural: "heladerías", categoria: "restaurantes", patron: /helad|gelat|grido|freddo/i },
  { id: "combustible", nombre: "Todas las estaciones de servicio", plural: "estaciones de servicio", categoria: "combustible" },
  { id: "farmacias", nombre: "Todas las farmacias", plural: "farmacias", categoria: "farmacias" },
  { id: "opticas", nombre: "Todas las ópticas", plural: "ópticas", categoria: "salud-belleza", patron: /[oó]ptic/i },
  { id: "peluquerias", nombre: "Todas las peluquerías", plural: "peluquerías", categoria: "salud-belleza", patron: /peluquer|barber/i },
  { id: "librerias", nombre: "Todas las librerías", plural: "librerías", categoria: "libreria-juguetes", patron: /librer|papeler/i },
  { id: "cines-teatros", nombre: "Todos los cines y teatros", plural: "cines y teatros", categoria: "entretenimiento", patron: /\bcine|teatro/i },
  { id: "hoteles", nombre: "Todos los hoteles", plural: "hoteles", categoria: "viajes", patron: /hotel|posada|resort|hostel/i },
  { id: "pasajes", nombre: "Todas las empresas de transporte", plural: "empresas de transporte", categoria: "transporte", patron: /bus|turismo|cot\b|copsa|cutcsa|colonia express|buquebus|agencia central/i },
  { id: "telepeaje", nombre: "Telepeaje", plural: "telepeajes", categoria: "transporte", patron: /telepeaje/i },
  // Rubros de las cuotas de Nativa (2026-10-03): "hasta 6 cuotas en todo el país" con un listado de adheridos.
  { id: "zapaterias", nombre: "Todas las zapaterías", plural: "zapaterías", categoria: "indumentaria", patron: /zapat|calzad/i },
  { id: "veterinarias", nombre: "Todas las veterinarias", plural: "veterinarias", categoria: "mascotas", patron: /veterinar/i },
  // Sin "taller" suelto: Talleres Don Bosco es un instituto, no un taller mecánico.
  { id: "talleres", nombre: "Todos los talleres mecánicos y repuestos", plural: "talleres mecánicos y casas de repuestos", categoria: "servicios", patron: /mec[aá]nic|repuesto|gomer[ií]a|neum[aá]tic/i },
  { id: "mutualistas", nombre: "Todas las mutualistas y servicios médicos", plural: "mutualistas y servicios médicos", categoria: "salud-belleza", patron: /mutualista|emergencia m[eé]dica|servicio m[eé]dico/i },
  { id: "ferreterias", nombre: "Todas las barracas, ferreterías y pinturerías", plural: "barracas, ferreterías y pinturerías", categoria: "hogar-deco", patron: /barraca|ferreter|pinturer/i },
];

export const PREFIJO_RUBRO = "todo-";

export const keyDeRubro = (r: Pick<RubroEntero, "id">) => `${PREFIJO_RUBRO}${r.id}`;

export const RUBRO_POR_KEY: ReadonlyMap<string, RubroEntero> = new Map(RUBROS_ENTEROS.map((r) => [keyDeRubro(r), r]));

/** ¿Es el comercio canónico de un rubro entero? */
export const esComercioDeRubro = (key: string) => RUBRO_POR_KEY.has(key);

/**
 * Los rubros enteros a los que pertenece un comercio de verdad: una heladería
 * es de "restaurantes" (su categoría) y de "heladerías" (su nombre).
 */
export function rubrosDeComercio(c: { key: string; nombre: string; categoria: string }): RubroEntero[] {
  if (esComercioDeRubro(c.key)) return [];
  return RUBROS_ENTEROS.filter((r) => r.categoria === c.categoria && (!r.patron || r.patron.test(c.nombre)));
}
