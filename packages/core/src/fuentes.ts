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
  // MI BROU es una Visa Débito para 14 a 29 años (al cumplir 30 pasa a la Visa Débito común).
  { id: "brou-mi-brou", fuente_id: "brou", nombre: "MI BROU Tarjeta Joven", instrumento: "debito", red: "visa", tier: null },
  // AlfaBROU es la "Prepaga Internacional" de BROU; se emite Visa o Mastercard.
  { id: "brou-alfabrou-visa", fuente_id: "brou", nombre: "Prepaga AlfaBROU Visa", instrumento: "prepaga", red: "visa", tier: null, familia: "brou-alfabrou", url_oficial: "https://www.brou.com.uy/web/guest/personas/tarjetas/prepaga-alfabrou" },
  { id: "brou-alfabrou-mastercard", fuente_id: "brou", nombre: "Prepaga AlfaBROU Mastercard", instrumento: "prepaga", red: "mastercard", tier: null, familia: "brou-alfabrou", url_oficial: "https://www.brou.com.uy/web/guest/personas/tarjetas/prepaga-alfabrou" },
  { id: "brou-tuapp", fuente_id: "brou", nombre: "TuApp", instrumento: "saldo", red: "propia", tier: null },

  // Santander — catálogo oficial (santander.com.uy/todas-las-tarjetas, 2026-09-22),
  // una fila por plástico. "Soy Santander" se emite Visa o Mastercard; los packs
  // Trilogy traen Visa Infinite + Mastercard Black + débito.
  { id: "santander-visa", fuente_id: "santander", nombre: "Soy Santander Internacional Visa", instrumento: "credito", red: "visa", tier: null, familia: "santander-soy", url_oficial: "https://www.santander.com.uy/todas-las-tarjetas/tarjeta-soy-santander" },
  { id: "santander-mastercard", fuente_id: "santander", nombre: "Soy Santander Internacional Mastercard", instrumento: "credito", red: "mastercard", tier: null, familia: "santander-soy", url_oficial: "https://www.santander.com.uy/todas-las-tarjetas/tarjeta-soy-santander" },
  { id: "santander-visa-platinum", fuente_id: "santander", nombre: "Soy Santander Platinum Visa", instrumento: "credito", red: "visa", tier: "platinum", familia: "santander-soy-platinum", url_oficial: "https://www.santander.com.uy/todas-las-tarjetas/tarjeta-soy-santander" },
  { id: "santander-mastercard-platinum", fuente_id: "santander", nombre: "Soy Santander Platinum Mastercard", instrumento: "credito", red: "mastercard", tier: "platinum", familia: "santander-soy-platinum", url_oficial: "https://www.santander.com.uy/todas-las-tarjetas/tarjeta-soy-santander" },
  { id: "santander-debito", fuente_id: "santander", nombre: "Débito Soy Santander", instrumento: "debito", red: "mastercard", tier: null },
  { id: "santander-farmacard", fuente_id: "santander", nombre: "Farmacard Santander", instrumento: "credito", red: "mastercard", tier: null, url_oficial: "https://www.santander.com.uy/todas-las-tarjetas/farmacard" },
  { id: "santander-hipermas", fuente_id: "santander", nombre: "Hipermás Santander", instrumento: "credito", red: "mastercard", tier: null, url_oficial: "https://www.santander.com.uy/todas-las-tarjetas/hipermas" },
  { id: "santander-amex", fuente_id: "santander", nombre: "American Express Santander", instrumento: "credito", red: "amex", tier: null },
  { id: "santander-aadvantage-visa", fuente_id: "santander", nombre: "AAdvantage Visa", instrumento: "credito", red: "visa", tier: null, familia: "santander-aadvantage", url_oficial: "https://www.santander.com.uy/todas-las-tarjetas/Tarjeta-Aadvantage" },
  { id: "santander-aadvantage-mastercard", fuente_id: "santander", nombre: "AAdvantage Mastercard", instrumento: "credito", red: "mastercard", tier: null, familia: "santander-aadvantage", url_oficial: "https://www.santander.com.uy/todas-las-tarjetas/Tarjeta-Aadvantage" },
  { id: "santander-select", fuente_id: "santander", nombre: "Select Visa Infinite", instrumento: "credito", red: "visa", tier: "infinite", familia: "santander-select", url_oficial: "https://www.santander.com.uy/select/pack-trilogy-soy" },
  { id: "santander-select-mastercard-black", fuente_id: "santander", nombre: "Select Mastercard Black", instrumento: "credito", red: "mastercard", tier: "black", familia: "santander-select", url_oficial: "https://www.santander.com.uy/select/pack-trilogy-soy" },
  { id: "santander-select-debito", fuente_id: "santander", nombre: "Débito Select", instrumento: "debito", red: "visa", tier: null, familia: "santander-select", url_oficial: "https://www.santander.com.uy/select/pack-trilogy-soy" },
  { id: "santander-private", fuente_id: "santander", nombre: "Private Banking Visa Infinite", instrumento: "credito", red: "visa", tier: "infinite", familia: "santander-private", url_oficial: "https://www.santander.com.uy/tarjetas/pack-trilogy-soy-private-banking" },
  { id: "santander-private-mastercard-black", fuente_id: "santander", nombre: "Private Banking Mastercard Black", instrumento: "credito", red: "mastercard", tier: "black", familia: "santander-private", url_oficial: "https://www.santander.com.uy/tarjetas/pack-trilogy-soy-private-banking" },
  { id: "santander-private-debito", fuente_id: "santander", nombre: "Débito Private Banking", instrumento: "debito", red: "visa", tier: null, familia: "santander-private", url_oficial: "https://www.santander.com.uy/tarjetas/pack-trilogy-soy-private-banking" },
  { id: "santander-aadvantage-visa-infinite", fuente_id: "santander", nombre: "AAdvantage Visa Infinite", instrumento: "credito", red: "visa", tier: "infinite", familia: "santander-aadvantage-trilogy", url_oficial: "https://www.santander.com.uy/select/pack-trilogy-aadvantage" },
  { id: "santander-aadvantage-mastercard-black", fuente_id: "santander", nombre: "AAdvantage Mastercard Black", instrumento: "credito", red: "mastercard", tier: "black", familia: "santander-aadvantage-trilogy", url_oficial: "https://www.santander.com.uy/select/pack-trilogy-aadvantage" },
  { id: "santander-aadvantage-debito", fuente_id: "santander", nombre: "Débito Select AAdvantage", instrumento: "debito", red: "visa", tier: null, familia: "santander-aadvantage-trilogy", url_oficial: "https://www.santander.com.uy/select/pack-trilogy-aadvantage" },

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
  // Internacional se emite Visa o Mastercard: una familia, como Soy Santander.
  { id: "bbva-credito", fuente_id: "bbva", nombre: "Visa Internacional BBVA", instrumento: "credito", red: "visa", tier: null, familia: "bbva-internacional" },
  { id: "bbva-mastercard-internacional", fuente_id: "bbva", nombre: "Mastercard Internacional BBVA", instrumento: "credito", red: "mastercard", tier: null, familia: "bbva-internacional", url_oficial: "https://www.bbva.com.uy/personas/productos/tarjetas/tarjeta-de-credito/tarjetas-mastercard-/mastercard-internacional.html" },
  // Oro y Platinum también se emiten Visa o Mastercard.
  { id: "bbva-oro", fuente_id: "bbva", nombre: "Visa Oro BBVA", instrumento: "credito", red: "visa", tier: "gold", familia: "bbva-oro" },
  { id: "bbva-mastercard-oro", fuente_id: "bbva", nombre: "Mastercard Oro BBVA", instrumento: "credito", red: "mastercard", tier: "gold", familia: "bbva-oro", url_oficial: "https://www.bbva.com.uy/personas/productos/tarjetas/tarjeta-de-credito/tarjetas-mastercard-/mastercard-oro.html" },
  { id: "bbva-platinum", fuente_id: "bbva", nombre: "Visa Platinum BBVA", instrumento: "credito", red: "visa", tier: "platinum", familia: "bbva-platinum" },
  { id: "bbva-mastercard-platinum", fuente_id: "bbva", nombre: "Mastercard Platinum BBVA", instrumento: "credito", red: "mastercard", tier: "platinum", familia: "bbva-platinum", url_oficial: "https://www.bbva.com.uy/personas/productos/tarjetas/tarjeta-de-credito/tarjetas-mastercard-/mastercard-platinum.html" },
  { id: "bbva-black", fuente_id: "bbva", nombre: "Mastercard Black BBVA", instrumento: "credito", red: "mastercard", tier: "black" },
  { id: "bbva-infinite", fuente_id: "bbva", nombre: "Visa Infinite BBVA", instrumento: "credito", red: "visa", tier: "infinite" },
  { id: "bbva-comunidad-plus", fuente_id: "bbva", nombre: "Comunidad Plus BBVA (Ta-Ta)", instrumento: "credito", red: "mastercard", tier: null },
  { id: "bbva-sodimac", fuente_id: "bbva", nombre: "BBVA Sodimac", instrumento: "credito", red: "mastercard", tier: null },
  { id: "bbva-consolid-travel", fuente_id: "bbva", nombre: "BBVA Consolid Travel", instrumento: "credito", red: "mastercard", tier: null },

  // Prex
  { id: "prex-saldo", fuente_id: "prex", nombre: "Saldo Prex", instrumento: "saldo", red: "propia", tier: null },
  { id: "prex-mastercard", fuente_id: "prex", nombre: "Prex Mastercard", instrumento: "prepaga", red: "mastercard", tier: null },
] as const;
