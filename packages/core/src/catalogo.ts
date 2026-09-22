import { PRODUCTOS } from "./fuentes";
import type { Producto } from "./schema";

/**
 * Nombre comercial de cada familia (lo que el banco vende). Un producto sin
 * `familia` es su propia familia y usa su nombre.
 */
export const NOMBRE_FAMILIA: Record<string, string> = {
  "santander-soy": "Soy Santander Internacional",
  "santander-soy-platinum": "Soy Santander Platinum",
  "santander-aadvantage": "AAdvantage",
  "santander-select": "Pack Trilogy Soy Santander Select",
  "santander-private": "Pack Trilogy Soy Santander Private Banking",
  "santander-aadvantage-trilogy": "Pack Trilogy AAdvantage",
};

export interface Familia {
  id: string;
  fuente_id: string;
  nombre: string;
  /** Plásticos, en el orden del catálogo. */
  productos: Producto[];
}

export function familiaDe(p: Producto): string {
  return p.familia ?? p.id;
}

/** Familias de productos activos, en el orden del catálogo. */
export const FAMILIAS: readonly Familia[] = (() => {
  const m = new Map<string, Familia>();
  for (const p of PRODUCTOS) {
    if (p.activo === false) continue;
    const id = familiaDe(p);
    const f = m.get(id) ?? {
      id,
      fuente_id: p.fuente_id,
      nombre: p.familia ? (NOMBRE_FAMILIA[p.familia] ?? p.nombre) : p.nombre,
      productos: [],
    };
    f.productos.push(p);
    m.set(id, f);
  }
  return [...m.values()];
})();

export const FAMILIA_POR_ID: Record<string, Familia> = Object.fromEntries(
  FAMILIAS.map((f) => [f.id, f]),
);

export function familiasDe(fuenteId: string): readonly Familia[] {
  return FAMILIAS.filter((f) => f.fuente_id === fuenteId);
}

/**
 * Ids de producto que cambiaron de significado. Antes `santander-select` era
 * "cualquier tarjeta Select"; hoy es solo la Visa Infinite del pack, así que
 * un beneficio o una billetera que lo tenía pasa a tener los tres plásticos.
 * Se aplica al migrar la base, al leer la billetera del usuario y al leer
 * `?productos=` de un link viejo. La clave se conserva en el resultado.
 */
export const EQUIVALENCIAS_PRODUCTO: Record<string, readonly string[]> = {
  "santander-select": ["santander-select", "santander-select-mastercard-black", "santander-select-debito"],
  "santander-private": ["santander-private", "santander-private-mastercard-black", "santander-private-debito"],
};

export function expandirProductos(ids: readonly string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    for (const x of EQUIVALENCIAS_PRODUCTO[id] ?? [id]) if (!out.includes(x)) out.push(x);
  }
  return out;
}
