import type { Fuente, Producto } from "./schema";

/** Fuentes de v1, en el orden en que se implementan los scrapers (BROU es el tracer bullet). */
export const FUENTES: readonly Fuente[] = [
  { id: "brou", nombre: "BROU", tipo: "banco", logo_url: null, url: "https://www.brou.com.uy", activa: true },
  { id: "santander", nombre: "Santander", tipo: "banco", logo_url: null, url: "https://www.santander.com.uy", activa: true },
  { id: "scotiabank", nombre: "Scotiabank", tipo: "banco", logo_url: null, url: "https://uy.scotiabank.com", activa: true },
  { id: "itau", nombre: "Itaú", tipo: "banco", logo_url: null, url: "https://www.itau.com.uy", activa: true },
  { id: "oca", nombre: "OCA", tipo: "emisor", logo_url: null, url: "https://www.oca.com.uy", activa: true },
  { id: "prex", nombre: "Prex", tipo: "billetera", logo_url: null, url: "https://www.prexcard.com.uy", activa: true },
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

  // Santander
  { id: "santander-debito", fuente_id: "santander", nombre: "Débito Santander", instrumento: "debito", red: "mastercard", tier: null },
  { id: "santander-visa", fuente_id: "santander", nombre: "Visa Santander", instrumento: "credito", red: "visa", tier: null },
  { id: "santander-visa-platinum", fuente_id: "santander", nombre: "Visa Platinum Santander", instrumento: "credito", red: "visa", tier: "platinum" },
  { id: "santander-mastercard", fuente_id: "santander", nombre: "Mastercard Santander", instrumento: "credito", red: "mastercard", tier: null },
  { id: "santander-amex", fuente_id: "santander", nombre: "American Express Santander", instrumento: "credito", red: "amex", tier: null },

  // Scotiabank
  { id: "scotiabank-debito", fuente_id: "scotiabank", nombre: "Débito Scotiabank", instrumento: "debito", red: "visa", tier: null },
  { id: "scotiabank-visa", fuente_id: "scotiabank", nombre: "Visa Scotiabank", instrumento: "credito", red: "visa", tier: null },
  { id: "scotiabank-visa-signature", fuente_id: "scotiabank", nombre: "Visa Signature Scotiabank", instrumento: "credito", red: "visa", tier: "signature" },
  { id: "scotiabank-mastercard", fuente_id: "scotiabank", nombre: "Mastercard Scotiabank", instrumento: "credito", red: "mastercard", tier: null },

  // Itaú
  { id: "itau-debito", fuente_id: "itau", nombre: "Débito Itaú", instrumento: "debito", red: "mastercard", tier: null },
  { id: "itau-visa", fuente_id: "itau", nombre: "Visa Itaú", instrumento: "credito", red: "visa", tier: null },
  { id: "itau-mastercard", fuente_id: "itau", nombre: "Mastercard Itaú", instrumento: "credito", red: "mastercard", tier: null },
  { id: "itau-mastercard-black", fuente_id: "itau", nombre: "Mastercard Black Itaú", instrumento: "credito", red: "mastercard", tier: "black" },

  // OCA
  { id: "oca-blue", fuente_id: "oca", nombre: "OCA Blue", instrumento: "credito", red: "propia", tier: null },
  { id: "oca-mastercard", fuente_id: "oca", nombre: "OCA Mastercard", instrumento: "credito", red: "mastercard", tier: null },
  { id: "oca-visa", fuente_id: "oca", nombre: "OCA Visa", instrumento: "credito", red: "visa", tier: null },

  // Prex
  { id: "prex-saldo", fuente_id: "prex", nombre: "Saldo Prex", instrumento: "saldo", red: "propia", tier: null },
  { id: "prex-mastercard", fuente_id: "prex", nombre: "Prex Mastercard", instrumento: "prepaga", red: "mastercard", tier: null },
] as const;
