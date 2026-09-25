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
  "bbva-internacional": "Crédito Internacional BBVA",
  "bbva-oro": "Crédito Oro BBVA",
  "bbva-consolid-travel": "BBVA Consolid Travel",
  "bbva-abtour": "BBVA Abtour",
  "brou-alfabrou": "Prepaga AlfaBROU",
  "itau-personal-bank": "Itaú Personal Bank",
};

/** Los productos que siguen vigentes, en el orden del catálogo. */
export const PRODUCTOS_ACTIVOS: readonly Producto[] = PRODUCTOS.filter((p) => p.activo !== false);

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
  for (const p of PRODUCTOS_ACTIVOS) {
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
 * Una familia es una tarjeta si tiene algún plástico. El "saldo" de una
 * billetera o una app de pagos (Saldo Prex, TuApp) es un medio de pago: tiene
 * beneficios y se puede elegir en "mis tarjetas", pero no es una tarjeta que
 * uno se saca, así que no va al catálogo público ni tiene página propia.
 */
export function esTarjeta(f: Familia): boolean {
  return f.productos.some((p) => p.instrumento !== "saldo");
}

/** Las familias del catálogo público (`/tarjetas`, `/tarjeta/[id]`, sitemap). */
export const FAMILIAS_TARJETA: readonly Familia[] = FAMILIAS.filter(esTarjeta);

/**
 * Ids de producto que cambiaron de significado o se dieron de baja, y a qué
 * plásticos reales pasan. Se aplica al migrar la base, al leer la billetera del
 * usuario (localStorage) y al leer `?productos=` de un link viejo.
 *
 * - Un id que se conserva figura en su propia lista: `santander-select` era
 *   "cualquier tarjeta Select" y hoy es la Visa Infinite del pack, así que pasa
 *   a los tres plásticos.
 * - Un id dado de baja no figura en su lista: pasa a su equivalente real, o a
 *   nada si no lo tiene (una tarjeta que el banco no emite). La migración
 *   20261020120000_catalogo_auditado.sql usa la misma tabla.
 */
export const EQUIVALENCIAS_PRODUCTO: Record<string, readonly string[]> = {
  "santander-select": ["santander-select", "santander-select-mastercard-black", "santander-select-debito"],
  "santander-private": ["santander-private", "santander-private-mastercard-black", "santander-private-debito"],
  // Consolid Travel se emite Visa o Mastercard; antes solo estaba la Mastercard.
  "bbva-consolid-travel": ["bbva-consolid-travel", "bbva-consolid-travel-visa"],
  // Bajas de la auditoría del 2026-09-25 (docs/04-backoffice.md).
  "santander-amex": [],
  "brou-visa-black": [],
  "scotiabank-visa-gold": [],
  "scotiabank-visa-signature": [],
  // Itaú no emite Signature: el id recibía todo lo "Infinite".
  "itau-visa-signature": ["itau-visa-infinite-volar", "itau-latam-pass-infinite"],
  // BBVA no emite Visa Platinum; la única Platinum es la Mastercard.
  "bbva-platinum": ["bbva-mastercard-platinum"],
  // Cuentas y paquetes que no son plásticos, y un duplicado.
  "itau-debito": ["itau-debito-volar"],
  "itau-debito-u25": ["itau-debito-volar"],
  "itau-pocket": ["itau-debito-volar"],
  "itau-personal-bank": ["itau-visa-infinite-volar", "itau-latam-pass-infinite", "itau-debito-infinite"],
  "oca-blue": ["oca-blue-debito"],
};

export function expandirProductos(ids: readonly string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    for (const x of EQUIVALENCIAS_PRODUCTO[id] ?? [id]) if (!out.includes(x)) out.push(x);
  }
  return out;
}
