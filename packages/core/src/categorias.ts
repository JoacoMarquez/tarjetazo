import type { Categoria } from "./schema";

/** 18 rubros de v1. `en_home` marca los que se muestran en la grilla de la home. */
export const CATEGORIAS: readonly Categoria[] = [
  { slug: "supermercados", label: "Supermercados", orden: 1, en_home: true },
  { slug: "restaurantes", label: "Restaurantes", orden: 2, en_home: true },
  { slug: "cafeterias", label: "Cafeterías", orden: 3, en_home: true },
  { slug: "delivery", label: "Delivery", orden: 4, en_home: true },
  { slug: "combustible", label: "Combustible", orden: 5, en_home: true },
  { slug: "farmacias", label: "Farmacias", orden: 6, en_home: true },
  { slug: "indumentaria", label: "Indumentaria", orden: 7, en_home: true },
  { slug: "electro-tecnologia", label: "Electro y tecnología", orden: 8, en_home: true },
  { slug: "hogar-deco", label: "Hogar y deco", orden: 9, en_home: false },
  { slug: "viajes", label: "Viajes", orden: 10, en_home: false },
  { slug: "transporte", label: "Transporte", orden: 11, en_home: false },
  { slug: "entretenimiento", label: "Entretenimiento", orden: 12, en_home: false },
  { slug: "salud-belleza", label: "Salud y belleza", orden: 13, en_home: false },
  { slug: "deportes", label: "Deportes", orden: 14, en_home: false },
  { slug: "mascotas", label: "Mascotas", orden: 15, en_home: false },
  { slug: "libreria-juguetes", label: "Librerías y jugueterías", orden: 16, en_home: false },
  { slug: "servicios", label: "Servicios", orden: 17, en_home: false },
  { slug: "otros", label: "Otros", orden: 18, en_home: false },
] as const;

export const SLUGS_CATEGORIAS = CATEGORIAS.map((c) => c.slug);
