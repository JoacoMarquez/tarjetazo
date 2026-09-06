import type { Fuente, Producto } from "./schema";

/** Fuentes de v1, en el orden en que se implementan los scrapers (BROU es el tracer bullet). */
export const FUENTES: readonly Fuente[] = [
  { id: "brou", nombre: "BROU", tipo: "banco", logo_url: null, url: "https://www.brou.com.uy", activa: true },
  { id: "santander", nombre: "Santander", tipo: "banco", logo_url: null, url: "https://www.santander.com.uy", activa: true },
  { id: "scotiabank", nombre: "Scotiabank", tipo: "banco", logo_url: null, url: "https://uy.scotiabank.com", activa: true },
  { id: "itau", nombre: "Itaú", tipo: "banco", logo_url: null, url: "https://www.itau.com.uy", activa: true },
  { id: "oca", nombre: "OCA", tipo: "emisor", logo_url: null, url: "https://www.oca.com.uy", activa: true },
  { id: "prex", nombre: "Prex", tipo: "billetera", logo_url: null, url: "https://www.prexcard.com.uy", activa: true },
  { id: "bbva", nombre: "BBVA", tipo: "banco", logo_url: null, url: "https://www.bbva.com.uy", activa: true },
] as const;

export const PRODUCTOS: readonly Producto[] = [
  // BROU — nombres tal como los publica beneficios.brou.com.uy
  { id: "brou-visa-debito", fuente_id: "brou", nombre: "BROU Visa Débito", instrumento: "debito", red: "visa", tier: null },
  { id: "brou-visa", fuente_id: "brou", nombre: "BROU Visa", instrumento: "credito", red: "visa", tier: null },
  { id: "brou-visa-platinum", fuente_id: "brou", nombre: "BROU Visa Platinum", instrumento: "credito", red: "visa", tier: "platinum" },
  { id: "brou-visa-gold", fuente_id: "brou", nombre: "BROU Visa Oro", instrumento: "credito", red: "visa", tier: "gold" },
  { id: "brou-visa-black", fuente_id: "brou", nombre: "BROU Visa Black", instrumento: "credito", red: "visa", tier: "black" },
  { id: "brou-recompensa-debito", fuente_id: "brou", nombre: "BROU Recompensa Mastercard Débito", instrumento: "debito", red: "mastercard", tier: null },
  { id: "brou-recompensa", fuente_id: "brou", nombre: "BROU Recompensa Mastercard", instrumento: "credito", red: "mastercard", tier: null },
  { id: "brou-recompensa-platinum", fuente_id: "brou", nombre: "BROU Recompensa Mastercard Platinum", instrumento: "credito", red: "mastercard", tier: "platinum" },
  { id: "brou-recompensa-gold", fuente_id: "brou", nombre: "BROU Recompensa Mastercard Oro", instrumento: "credito", red: "mastercard", tier: "gold" },
  { id: "brou-recompensa-black", fuente_id: "brou", nombre: "BROU Recompensa Mastercard Black", instrumento: "credito", red: "mastercard", tier: "black" },
  { id: "brou-mi-brou", fuente_id: "brou", nombre: "MI BROU Tarjeta Joven", instrumento: "prepaga", red: "propia", tier: null },
  { id: "brou-tuapp", fuente_id: "brou", nombre: "TuApp", instrumento: "saldo", red: "propia", tier: null },

  // Santander — además de las tarjetas, segmenta por paquete (Select, Private).
  { id: "santander-select", fuente_id: "santander", nombre: "Santander Select", instrumento: "credito", red: "visa", tier: "platinum" },
  { id: "santander-private", fuente_id: "santander", nombre: "Santander Private Banking", instrumento: "credito", red: "visa", tier: "black" },
  { id: "santander-mastercard-platinum", fuente_id: "santander", nombre: "Mastercard Platinum Santander", instrumento: "credito", red: "mastercard", tier: "platinum" },
  { id: "santander-farmacard", fuente_id: "santander", nombre: "Farmacard Santander", instrumento: "credito", red: "mastercard", tier: null },
  { id: "santander-hipermas", fuente_id: "santander", nombre: "Hipermás Santander", instrumento: "credito", red: "mastercard", tier: null },
  { id: "santander-debito", fuente_id: "santander", nombre: "Débito Santander", instrumento: "debito", red: "mastercard", tier: null },
  { id: "santander-visa", fuente_id: "santander", nombre: "Visa Santander", instrumento: "credito", red: "visa", tier: null },
  { id: "santander-visa-platinum", fuente_id: "santander", nombre: "Visa Platinum Santander", instrumento: "credito", red: "visa", tier: "platinum" },
  { id: "santander-mastercard", fuente_id: "santander", nombre: "Mastercard Santander", instrumento: "credito", red: "mastercard", tier: null },
  { id: "santander-amex", fuente_id: "santander", nombre: "American Express Santander", instrumento: "credito", red: "amex", tier: null },

  // Scotiabank — nombra por tier y sello; la débito Premium va con los tiers altos.
  { id: "scotiabank-visa-gold", fuente_id: "scotiabank", nombre: "Visa Gold Scotiabank", instrumento: "credito", red: "visa", tier: "gold" },
  { id: "scotiabank-visa-platinum", fuente_id: "scotiabank", nombre: "Visa Platinum Scotiabank", instrumento: "credito", red: "visa", tier: "platinum" },
  { id: "scotiabank-visa-infinite", fuente_id: "scotiabank", nombre: "Visa Infinite Scotiabank", instrumento: "credito", red: "visa", tier: "black" },
  { id: "scotiabank-amex", fuente_id: "scotiabank", nombre: "American Express Scotiabank", instrumento: "credito", red: "amex", tier: null },
  { id: "scotiabank-debito-premium", fuente_id: "scotiabank", nombre: "Débito Premium Scotiabank", instrumento: "debito", red: "visa", tier: "platinum" },
  { id: "scotiabank-debito", fuente_id: "scotiabank", nombre: "Débito Scotiabank", instrumento: "debito", red: "visa", tier: null },
  { id: "scotiabank-visa", fuente_id: "scotiabank", nombre: "Visa Scotiabank", instrumento: "credito", red: "visa", tier: null },
  { id: "scotiabank-visa-signature", fuente_id: "scotiabank", nombre: "Visa Signature Scotiabank", instrumento: "credito", red: "visa", tier: "signature" },
  { id: "scotiabank-mastercard", fuente_id: "scotiabank", nombre: "Mastercard Scotiabank", instrumento: "credito", red: "mastercard", tier: null },

  // Itaú — la línea de débito tiene nombre propio (Volar) y hay alimentación.
  { id: "itau-debito-volar", fuente_id: "itau", nombre: "Itaú Débito Volar", instrumento: "debito", red: "mastercard", tier: null },
  { id: "itau-debito-junior", fuente_id: "itau", nombre: "Itaú Débito Junior", instrumento: "debito", red: "mastercard", tier: null },
  { id: "itau-debito-sueldo", fuente_id: "itau", nombre: "Itaú Débito Sueldos", instrumento: "debito", red: "mastercard", tier: null },
  { id: "itau-pocket", fuente_id: "itau", nombre: "Itaú Cuenta Pocket", instrumento: "debito", red: "mastercard", tier: null },
  { id: "itau-alimentacion", fuente_id: "itau", nombre: "Itaú Tarjeta Alimentación", instrumento: "prepaga", red: "mastercard", tier: null },
  { id: "itau-personal-bank", fuente_id: "itau", nombre: "Itaú Personal Bank", instrumento: "debito", red: "mastercard", tier: null },
  { id: "itau-visa-platinum", fuente_id: "itau", nombre: "Itaú Visa Platinum", instrumento: "credito", red: "visa", tier: "platinum" },
  { id: "itau-visa-signature", fuente_id: "itau", nombre: "Itaú Visa Signature", instrumento: "credito", red: "visa", tier: "signature" },
  { id: "itau-debito", fuente_id: "itau", nombre: "Débito Itaú", instrumento: "debito", red: "mastercard", tier: null },
  { id: "itau-visa", fuente_id: "itau", nombre: "Visa Itaú", instrumento: "credito", red: "visa", tier: null },
  { id: "itau-mastercard", fuente_id: "itau", nombre: "Mastercard Itaú", instrumento: "credito", red: "mastercard", tier: null },
  { id: "itau-mastercard-black", fuente_id: "itau", nombre: "Mastercard Black Itaú", instrumento: "credito", red: "mastercard", tier: "black" },

  // OCA
  { id: "oca-blue-debito", fuente_id: "oca", nombre: "OCA Blue Débito", instrumento: "debito", red: "mastercard", tier: null },
  { id: "oca-blue", fuente_id: "oca", nombre: "OCA Blue", instrumento: "credito", red: "propia", tier: null },
  { id: "oca-mastercard", fuente_id: "oca", nombre: "OCA Mastercard", instrumento: "credito", red: "mastercard", tier: null },
  { id: "oca-visa", fuente_id: "oca", nombre: "OCA Visa", instrumento: "credito", red: "visa", tier: null },

  // BBVA — tres grupos: débito; Internacional/Oro/Pymes/Corporativas; Platinum/Black/Infinite.
  { id: "bbva-debito", fuente_id: "bbva", nombre: "Débito BBVA", instrumento: "debito", red: "visa", tier: null },
  { id: "bbva-credito", fuente_id: "bbva", nombre: "Crédito Internacional BBVA", instrumento: "credito", red: "visa", tier: null },
  { id: "bbva-oro", fuente_id: "bbva", nombre: "Crédito Oro BBVA", instrumento: "credito", red: "visa", tier: "gold" },
  { id: "bbva-platinum", fuente_id: "bbva", nombre: "Crédito Platinum BBVA", instrumento: "credito", red: "visa", tier: "platinum" },
  { id: "bbva-black", fuente_id: "bbva", nombre: "Mastercard Black BBVA", instrumento: "credito", red: "mastercard", tier: "black" },
  { id: "bbva-infinite", fuente_id: "bbva", nombre: "Visa Infinite BBVA", instrumento: "credito", red: "visa", tier: "black" },

  // Prex
  { id: "prex-saldo", fuente_id: "prex", nombre: "Saldo Prex", instrumento: "saldo", red: "propia", tier: null },
  { id: "prex-mastercard", fuente_id: "prex", nombre: "Prex Mastercard", instrumento: "prepaga", red: "mastercard", tier: null },
] as const;
