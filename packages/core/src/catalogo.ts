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
  "santander-hipermas": "Hipermás Santander",
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
 * uno se saca, así que no va al catálogo público ni tiene página propia. La
 * tarjeta de socio de un club (Club El País) tampoco: viene con otra
 * suscripción y no sirve para pagar.
 */
export function esTarjeta(f: Familia): boolean {
  return f.productos.some((p) => p.instrumento !== "saldo" && p.instrumento !== "membresia");
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

const INSTRUMENTO_PLURAL: Record<string, string> = {
  credito: "tarjetas de crédito",
  debito: "tarjetas de débito",
  prepaga: "tarjetas prepagas",
};

/**
 * "A", "A y B", "A, B y C". Si todos comparten el comienzo (los niveles de un
 * club), se dice una vez: "Peñarol BBVA Mastercard Internacional, Oro y Platinum".
 */
function enumerar(nombres: string[]): string {
  const lista = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}`);
  if (nombres.length < 2) return lista(nombres);
  const palabras = nombres.map((n) => n.split(" "));
  let comun = 0;
  while (palabras.every((p) => p.length > comun + 1 && p[comun] === palabras[0]![comun])) comun++;
  if (comun < 2) return lista(nombres);
  return `${palabras[0]!.slice(0, comun).join(" ")} ${lista(palabras.map((p) => p.slice(comun).join(" ")))}`;
}

/**
 * Para qué tarjetas es un beneficio, en pocas palabras, o null si vale para
 * todas las de la fuente (lista vacía, o todas las activas). Agrupa por
 * familia: un pack entero se nombra por el pack, y todas las de un
 * instrumento, por el instrumento ("tarjetas de crédito"). Así el 30% de un
 * restaurante que solo aplica con la Nacional Platinum no se lee como "30%
 * con BBVA".
 *
 * Con más de `max` nombres no se enumera: "algunas tarjetas de crédito" (las
 * de BBVA "de crédito" son las 7 genéricas, sin las de marca, y una lista
 * así en cada beneficio no se lee). Con `max = Infinity`, la lista entera,
 * para la ficha del beneficio.
 */
export function alcanceTarjetas(fuenteId: string, productos: readonly string[], max = 3): string | null {
  const activos = PRODUCTOS_ACTIVOS.filter((p) => p.fuente_id === fuenteId);
  const elegibles = new Set(expandirProductos(productos).filter((id) => activos.some((p) => p.id === id)));
  if (elegibles.size === 0 || activos.every((p) => elegibles.has(p.id))) return null;
  for (const [instrumento, plural] of Object.entries(INSTRUMENTO_PLURAL)) {
    const delInstrumento = activos.filter((p) => p.instrumento === instrumento);
    if (delInstrumento.length > 1 && delInstrumento.length === elegibles.size && delInstrumento.every((p) => elegibles.has(p.id))) {
      return plural;
    }
  }
  const nombres: string[] = [];
  for (const f of familiasDe(fuenteId)) {
    const suyos = f.productos.filter((p) => elegibles.has(p.id));
    if (suyos.length === 0) continue;
    if (suyos.length === f.productos.length) nombres.push(f.nombre);
    else nombres.push(...suyos.map((p) => p.nombre));
  }
  if (nombres.length <= max) return enumerar(nombres);
  const instrumentos = new Set(activos.filter((p) => elegibles.has(p.id)).map((p) => p.instrumento));
  const [unico] = instrumentos;
  return instrumentos.size === 1 && unico && INSTRUMENTO_PLURAL[unico] ? `algunas ${INSTRUMENTO_PLURAL[unico]}` : "algunas tarjetas";
}
