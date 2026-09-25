import {
  FAMILIA_POR_ID,
  FUENTES,
  PRODUCTOS,
  familiaDe,
  familiasDe,
  type Familia,
  type Instrumento,
  type Producto,
  type Red,
  type Tier,
} from "@tarjetazo/core";

export { familiasDe };

/**
 * Cada fuente pinta con un color de la paleta: es lo que hace que una mini
 * tarjeta se reconozca sin logo (no tenemos derechos sobre los de los bancos).
 * `ink` es para cifras sobre fondo claro y `soft` para fondos.
 */
export interface ColorFuente {
  color: string;
  soft: string;
  ink: string;
}

const CIELO: ColorFuente = { color: "#0f6fd6", soft: "#e8f1fd", ink: "#0a4c95" };
const MENTA: ColorFuente = { color: "#0fae9c", soft: "#e4f7f4", ink: "#0a7267" };
const SOL: ColorFuente = { color: "#f7b500", soft: "#fff5da", ink: "#8a6300" };
const CORAL: ColorFuente = { color: "#e8503a", soft: "#fdecea", ink: "#9c2f1e" };

const POR_FUENTE: Record<string, ColorFuente> = {
  brou: CIELO,
  santander: CORAL,
  scotiabank: MENTA,
  itau: SOL,
  oca: CIELO,
  prex: MENTA,
  bbva: CIELO,
  midinero: SOL,
};

export function colorFuente(fuenteId: string): ColorFuente {
  return POR_FUENTE[fuenteId] ?? CIELO;
}

export const GRADIENTE = "linear-gradient(100deg,#0f6fd6 0%,#0fae9c 55%,#f7b500 100%)";
/** Los tres colores del gradiente, para los slots punteados de la pila vacía. */
export const COLORES_GRADIENTE = ["#0f6fd6", "#0fae9c", "#f7b500"];

export const FUENTE_POR_ID = Object.fromEntries(FUENTES.map((f) => [f.id, f]));
export const PRODUCTO_POR_ID = Object.fromEntries(PRODUCTOS.map((p) => [p.id, p]));

const REDES: Record<Red, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  cabal: "Cabal",
  propia: "",
};

const INSTRUMENTOS: Record<Instrumento, string> = {
  credito: "Crédito",
  debito: "Débito",
  prepaga: "Prepaga",
  saldo: "Saldo",
};

/** "Visa · Crédito"; con red propia queda el nombre de la fuente ("OCA · Crédito"). */
export function pieDeTarjeta(p: Producto): string {
  const red = REDES[p.red] || FUENTE_POR_ID[p.fuente_id]?.nombre || "";
  const tipo = INSTRUMENTOS[p.instrumento];
  return red ? `${red} · ${tipo}` : tipo;
}

/**
 * Nombre corto para la tarjeta chica de la billetera: el catálogo repite el
 * nombre del banco al principio o al final ("BROU Visa Oro", "Visa Santander")
 * y ahí ya se ve de qué banco es por el color.
 */
export function nombreCorto(p: Producto): string {
  const banco = FUENTE_POR_ID[p.fuente_id]?.nombre;
  if (!banco) return p.nombre;
  const corto = p.nombre
    .replace(new RegExp(`^${banco}\\s+`, "i"), "")
    .replace(new RegExp(`\\s+${banco}$`, "i"), "")
    .trim();
  return corto || p.nombre;
}

const TIERS: Record<Tier, string> = {
  gold: "Gold",
  platinum: "Platinum",
  black: "Black",
  signature: "Signature",
  infinite: "Infinite",
  world: "World",
  world_elite: "World Elite",
};

/** "Visa Infinite + Mastercard Black + Débito": qué plásticos trae la familia. */
export function pieDeFamilia(f: Familia): string {
  if (f.productos.length === 1) return pieDeTarjeta(f.productos[0]!);
  return f.productos
    .map((p) => {
      if (p.instrumento !== "credito") return INSTRUMENTOS[p.instrumento];
      const red = REDES[p.red] || FUENTE_POR_ID[p.fuente_id]?.nombre || "";
      return [red, p.tier ? TIERS[p.tier] : ""].filter(Boolean).join(" ");
    })
    .join(" + ");
}

export function nombreCortoFamilia(f: Familia): string {
  if (f.productos.length === 1) return nombreCorto(f.productos[0]!);
  const banco = FUENTE_POR_ID[f.fuente_id]?.nombre;
  if (!banco) return f.nombre;
  const corto = f.nombre.replace(new RegExp(`\\s*${banco}\\s*`, "i"), " ").replace(/\s+/g, " ").trim();
  return corto || f.nombre;
}

/** Las familias presentes en la billetera, en el orden en que se agregaron. */
export function familiasEnBilletera(mis: readonly string[]): Familia[] {
  const vistas = new Set<string>();
  const out: Familia[] = [];
  for (const id of mis) {
    const p = PRODUCTO_POR_ID[id];
    if (!p) continue;
    const fid = familiaDe(p);
    if (vistas.has(fid)) continue;
    vistas.add(fid);
    const f = FAMILIA_POR_ID[fid];
    if (f) out.push(f);
  }
  return out;
}

export function productosDe(fuenteId: string): readonly Producto[] {
  return PRODUCTOS.filter((p) => p.fuente_id === fuenteId);
}

/** Bancos distintos de una lista de productos, en el orden de `FUENTES`. */
export function bancosDe(productos: string[]): string[] {
  const ids = new Set(productos.map((id) => PRODUCTO_POR_ID[id]?.fuente_id).filter(Boolean));
  return FUENTES.filter((f) => ids.has(f.id)).map((f) => f.id);
}
