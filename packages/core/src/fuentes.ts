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
  { id: "midinero", nombre: "Midinero", tipo: "billetera", logo_url: null, url: "https://www.midinero.com.uy", activa: true },
  { id: "nativa", nombre: "Nativa", tipo: "emisor", logo_url: null, url: "https://www.nativacabal.com.uy", activa: true },
  { id: "club-el-pais", nombre: "Club El País", tipo: "club", logo_url: null, url: "https://www.clubelpais.com.uy", activa: true },
  { id: "anda", nombre: "ANDA", tipo: "emisor", logo_url: null, url: "https://anda.com.uy", activa: true },
] as const;

const BROU = "https://www.brou.com.uy/personas";
const SCOTIA = "https://www.scotiabank.com.uy/Personas/Tarjetas/Tipos-de-tarjetas";
const ITAU = "https://www.itau.com.uy/inst";
const BBVA = "https://www.bbva.com.uy/personas/productos/tarjetas";

/**
 * Catálogo auditado contra el sitio oficial de cada banco (2026-09-25). Los
 * dados de baja (`activo: false`) no se borran: `EQUIVALENCIAS_PRODUCTO`
 * (catalogo.ts) dice a qué plástico real pasan sus beneficios y billeteras.
 */
export const PRODUCTOS: readonly Producto[] = [
  // BROU — nombres tal como los publica beneficios.brou.com.uy. Visa acumula
  // ANCAPuntos y Mastercard es BROU Recompensa; la Black es solo Mastercard.
  { id: "brou-visa-debito", fuente_id: "brou", nombre: "BROU Visa Débito", instrumento: "debito", red: "visa", tier: null, url_oficial: `${BROU}/tarjetas/redbrou-visa/visa-institucional` },
  { id: "brou-visa", fuente_id: "brou", nombre: "BROU Visa", instrumento: "credito", red: "visa", tier: null, url_oficial: `${BROU}/tarjetas/visa/productos` },
  { id: "brou-visa-platinum", fuente_id: "brou", nombre: "BROU Visa Platinum", instrumento: "credito", red: "visa", tier: "platinum", url_oficial: `${BROU}/tarjetas/visa-platinum` },
  { id: "brou-visa-gold", fuente_id: "brou", nombre: "BROU Visa Oro", instrumento: "credito", red: "visa", tier: "gold", url_oficial: `${BROU}/tarjetas/visa/productos` },
  { id: "brou-recompensa-debito", fuente_id: "brou", nombre: "BROU Recompensa Mastercard Débito", instrumento: "debito", red: "mastercard", tier: null, url_oficial: `${BROU}/tarjetas/debito-mastercard/brou-recompensa-mastercard-debito` },
  // La débito Mastercard sin programa de puntos: reemplaza a la Maestro.
  { id: "brou-mastercard-debito", fuente_id: "brou", nombre: "BROU Mastercard Débito", instrumento: "debito", red: "mastercard", tier: null, url_oficial: `${BROU}/tarjetas/debito-mastercard/brou-mastercard-debito` },
  { id: "brou-recompensa", fuente_id: "brou", nombre: "BROU Recompensa Mastercard", instrumento: "credito", red: "mastercard", tier: null, url_oficial: `${BROU}/tarjetas/mastercard/brou-recompensa` },
  { id: "brou-recompensa-platinum", fuente_id: "brou", nombre: "BROU Recompensa Mastercard Platinum", instrumento: "credito", red: "mastercard", tier: "platinum", url_oficial: `${BROU}/tarjetas/mastercard/mastercard-platinum` },
  { id: "brou-recompensa-gold", fuente_id: "brou", nombre: "BROU Recompensa Mastercard Oro", instrumento: "credito", red: "mastercard", tier: "gold", url_oficial: `${BROU}/tarjetas/master/productos` },
  { id: "brou-recompensa-black", fuente_id: "brou", nombre: "BROU Recompensa Mastercard Black", instrumento: "credito", red: "mastercard", tier: "black", url_oficial: `${BROU}/tarjetas/mastercard-black` },
  // MI BROU es una Visa Débito para 14 a 29 años (al cumplir 30 pasa a la Visa Débito común).
  { id: "brou-mi-brou", fuente_id: "brou", nombre: "MI BROU Tarjeta Joven", instrumento: "debito", red: "visa", tier: null, url_oficial: `${BROU}/tarjetas/redbrou-visa/mi-brou` },
  // AlfaBROU es la "Prepaga Internacional" de BROU; se emite Visa o Mastercard.
  { id: "brou-alfabrou-visa", fuente_id: "brou", nombre: "Prepaga AlfaBROU Visa", instrumento: "prepaga", red: "visa", tier: null, familia: "brou-alfabrou", url_oficial: `${BROU}/tarjetas/prepaga-alfabrou` },
  { id: "brou-alfabrou-mastercard", fuente_id: "brou", nombre: "Prepaga AlfaBROU Mastercard", instrumento: "prepaga", red: "mastercard", tier: null, familia: "brou-alfabrou", url_oficial: `${BROU}/tarjetas/prepaga-alfabrou` },
  // App de pagos con QR: un medio de pago, no una tarjeta (fuera de /tarjetas).
  { id: "brou-tuapp", fuente_id: "brou", nombre: "TuApp", instrumento: "saldo", red: "propia", tier: null, url_oficial: `${BROU}/beneficios/tuapp` },
  { id: "brou-visa-black", fuente_id: "brou", nombre: "BROU Visa Black", instrumento: "credito", red: "visa", tier: "black", activo: false },

  // Santander — catálogo oficial (santander.com.uy/todas-las-tarjetas, 2026-09-22),
  // una fila por plástico. "Soy Santander" se emite Visa o Mastercard; los packs
  // Trilogy traen Visa Infinite + Mastercard Black + débito.
  { id: "santander-visa", fuente_id: "santander", nombre: "Soy Santander Internacional Visa", instrumento: "credito", red: "visa", tier: null, familia: "santander-soy", url_oficial: "https://www.santander.com.uy/todas-las-tarjetas/tarjeta-soy-santander" },
  { id: "santander-mastercard", fuente_id: "santander", nombre: "Soy Santander Internacional Mastercard", instrumento: "credito", red: "mastercard", tier: null, familia: "santander-soy", url_oficial: "https://www.santander.com.uy/todas-las-tarjetas/tarjeta-soy-santander" },
  { id: "santander-visa-platinum", fuente_id: "santander", nombre: "Soy Santander Platinum Visa", instrumento: "credito", red: "visa", tier: "platinum", familia: "santander-soy-platinum", url_oficial: "https://www.santander.com.uy/todas-las-tarjetas/tarjeta-soy-santander" },
  { id: "santander-mastercard-platinum", fuente_id: "santander", nombre: "Soy Santander Platinum Mastercard", instrumento: "credito", red: "mastercard", tier: "platinum", familia: "santander-soy-platinum", url_oficial: "https://www.santander.com.uy/todas-las-tarjetas/tarjeta-soy-santander" },
  // El manual de tarifas la llama "Tarjeta de Débito Visa Santander".
  { id: "santander-debito", fuente_id: "santander", nombre: "Débito Soy Santander", instrumento: "debito", red: "visa", tier: null, url_oficial: "https://www.santander.com.uy/todas-las-cuentas/soy-santander" },
  { id: "santander-farmacard", fuente_id: "santander", nombre: "Farmacard Santander", instrumento: "credito", red: "mastercard", tier: null, url_oficial: "https://www.santander.com.uy/todas-las-tarjetas/farmacard" },
  { id: "santander-hipermas", fuente_id: "santander", nombre: "Hipermás Santander", instrumento: "credito", red: "mastercard", tier: null, url_oficial: "https://www.santander.com.uy/todas-las-tarjetas/hipermas" },
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
  // En Uruguay la American Express la emite solo Scotiabank.
  { id: "santander-amex", fuente_id: "santander", nombre: "American Express Santander", instrumento: "credito", red: "amex", tier: null, activo: false },

  // Scotiabank — nombra por tier y sello; la débito Premium (Visa Débito
  // Infinite) viene con la Cuenta Premium. Visa: Internacional, Platinum e
  // Infinite; Gold y Signature no existen.
  { id: "scotiabank-amex-gold", fuente_id: "scotiabank", nombre: "American Express Gold Scotiabank", instrumento: "credito", red: "amex", tier: "gold", url_oficial: `${SCOTIA}/american-express/amex-gold` },
  { id: "scotiabank-amex-platinum", fuente_id: "scotiabank", nombre: "The Platinum Card American Express Scotiabank", instrumento: "credito", red: "amex", tier: "platinum", url_oficial: `${SCOTIA}/american-express/amex-metal` },
  { id: "scotiabank-amex-copa-platinum", fuente_id: "scotiabank", nombre: "American Express Copa Platinum Scotiabank", instrumento: "credito", red: "amex", tier: "platinum", url_oficial: `${SCOTIA}/american-express/amex-copa-platinum` },
  { id: "scotiabank-visa-platinum", fuente_id: "scotiabank", nombre: "Visa Platinum Scotiabank", instrumento: "credito", red: "visa", tier: "platinum", url_oficial: `${SCOTIA}/visa/visa-platinum` },
  { id: "scotiabank-visa-infinite", fuente_id: "scotiabank", nombre: "Visa Infinite Scotiabank", instrumento: "credito", red: "visa", tier: "infinite", url_oficial: `${SCOTIA}/visa/visa-infinite` },
  { id: "scotiabank-amex", fuente_id: "scotiabank", nombre: "American Express Scotiabank", instrumento: "credito", red: "amex", tier: null, url_oficial: `${SCOTIA}/american-express/amex-internacional` },
  { id: "scotiabank-debito-premium", fuente_id: "scotiabank", nombre: "Débito Premium Scotiabank", instrumento: "debito", red: "visa", tier: "infinite", url_oficial: "https://www.scotiabank.com.uy/Banca-Premium/Productos/Productos/paquete-premium" },
  { id: "scotiabank-debito", fuente_id: "scotiabank", nombre: "Débito Scotiabank", instrumento: "debito", red: "visa", tier: null, url_oficial: `${SCOTIA}/visa/visa-debito` },
  { id: "scotiabank-visa", fuente_id: "scotiabank", nombre: "Visa Scotiabank", instrumento: "credito", red: "visa", tier: null, url_oficial: `${SCOTIA}/visa/visa-internacional` },
  { id: "scotiabank-mastercard", fuente_id: "scotiabank", nombre: "Mastercard Scotiabank", instrumento: "credito", red: "mastercard", tier: null, url_oficial: `${SCOTIA}/mastercard/master-internacional` },
  { id: "scotiabank-visa-gold", fuente_id: "scotiabank", nombre: "Visa Gold Scotiabank", instrumento: "credito", red: "visa", tier: "gold", activo: false },
  { id: "scotiabank-visa-signature", fuente_id: "scotiabank", nombre: "Visa Signature Scotiabank", instrumento: "credito", red: "visa", tier: "signature", activo: false },

  // Itaú — todas las de crédito son del programa Volar o LATAM Pass, y todas
  // las débito son Visa (tarifario del 01/09/2026). La Visa Infinite y la débito
  // Infinite vienen solo en el Paquete Personal Bank (familia `itau-personal-bank`).
  { id: "itau-debito-volar", fuente_id: "itau", nombre: "Visa Débito Volar", instrumento: "debito", red: "visa", tier: null, url_oficial: `${ITAU}/abriTuCuenta.html` },
  { id: "itau-debito-junior", fuente_id: "itau", nombre: "Visa Débito Junior", instrumento: "debito", red: "visa", tier: null, url_oficial: `${ITAU}/cuentaJunior.html` },
  { id: "itau-debito-sueldo", fuente_id: "itau", nombre: "Itaú Débito Sueldos", instrumento: "debito", red: "visa", tier: null },
  { id: "itau-alimentacion", fuente_id: "itau", nombre: "Itaú Tarjeta Alimentación", instrumento: "prepaga", red: "visa", tier: null, url_oficial: `${ITAU}/tarjetaAlimentacion.html` },
  { id: "itau-visa", fuente_id: "itau", nombre: "Visa Volar Internacional", instrumento: "credito", red: "visa", tier: null, url_oficial: `${ITAU}/tarjetaVolar.html` },
  { id: "itau-mastercard", fuente_id: "itau", nombre: "Mastercard Volar Internacional", instrumento: "credito", red: "mastercard", tier: null, url_oficial: `${ITAU}/tarjetaVolar.html` },
  { id: "itau-visa-platinum", fuente_id: "itau", nombre: "Visa Volar Platinum", instrumento: "credito", red: "visa", tier: "platinum", url_oficial: `${ITAU}/tarjetaVolar.html` },
  { id: "itau-mastercard-black", fuente_id: "itau", nombre: "Mastercard Volar Black", instrumento: "credito", red: "mastercard", tier: "black", url_oficial: `${ITAU}/tarjetaVolar.html` },
  { id: "itau-latam-pass", fuente_id: "itau", nombre: "Visa LATAM Pass Internacional", instrumento: "credito", red: "visa", tier: null, url_oficial: `${ITAU}/tarjetaLatam.html` },
  { id: "itau-latam-pass-platinum", fuente_id: "itau", nombre: "Visa LATAM Pass Platinum", instrumento: "credito", red: "visa", tier: "platinum", url_oficial: `${ITAU}/tarjetaLatam.html` },
  { id: "itau-visa-infinite-volar", fuente_id: "itau", nombre: "Visa Infinite Volar", instrumento: "credito", red: "visa", tier: "infinite", familia: "itau-personal-bank", url_oficial: `${ITAU}/personalBank_personal.html` },
  { id: "itau-latam-pass-infinite", fuente_id: "itau", nombre: "Visa LATAM Pass Infinite", instrumento: "credito", red: "visa", tier: "infinite", familia: "itau-personal-bank", url_oficial: `${ITAU}/personalBank_personal.html` },
  { id: "itau-debito-infinite", fuente_id: "itau", nombre: "Visa Débito Infinite Volar", instrumento: "debito", red: "visa", tier: "infinite", familia: "itau-personal-bank", url_oficial: `${ITAU}/personalBank_personal.html` },
  // Cuentas y paquetes, no plásticos: U25 y Pocket traen la Visa Débito Volar;
  // Personal Bank, los tres Infinite de arriba. `itau-debito` duplicaba la Volar.
  { id: "itau-debito-u25", fuente_id: "itau", nombre: "Itaú Débito U25", instrumento: "debito", red: "visa", tier: null, activo: false, url_oficial: `${ITAU}/cuentaU25.html` },
  { id: "itau-pocket", fuente_id: "itau", nombre: "Itaú Cuenta Pocket", instrumento: "debito", red: "visa", tier: null, activo: false, url_oficial: `${ITAU}/cuentapocket.html` },
  { id: "itau-personal-bank", fuente_id: "itau", nombre: "Itaú Personal Bank", instrumento: "debito", red: "visa", tier: null, activo: false, url_oficial: `${ITAU}/personalBank_personal.html` },
  { id: "itau-debito", fuente_id: "itau", nombre: "Débito Itaú", instrumento: "debito", red: "visa", tier: null, activo: false },
  { id: "itau-visa-signature", fuente_id: "itau", nombre: "Itaú Visa Signature", instrumento: "credito", red: "visa", tier: "signature", activo: false },

  // OCA — dos tarjetas de crédito sin tier. OCA Blue es una cuenta de dinero
  // electrónico; su plástico es la Visa Débito.
  { id: "oca-blue-debito", fuente_id: "oca", nombre: "OCA Blue Débito", instrumento: "debito", red: "visa", tier: null, url_oficial: "https://ocablue.uy/" },
  { id: "oca-mastercard", fuente_id: "oca", nombre: "OCA Mastercard", instrumento: "credito", red: "mastercard", tier: null, url_oficial: "https://oca.uy/tarjeta-de-credito/" },
  { id: "oca-visa", fuente_id: "oca", nombre: "OCA Visa", instrumento: "credito", red: "visa", tier: null, url_oficial: "https://oca.uy/tarjeta-de-credito/" },
  { id: "oca-blue", fuente_id: "oca", nombre: "OCA Blue", instrumento: "credito", red: "propia", tier: null, activo: false, url_oficial: "https://ocablue.uy/" },

  // BBVA — Internacional, Oro y Platinum en Mastercard; Internacional, Oro e
  // Infinite en Visa. Las de marca (Sodimac, Comunidad Plus) son Visa; Consolid
  // Travel y Abtour se eligen Visa o Mastercard; las de los clubes son
  // Mastercard en tres niveles, una familia por nivel.
  { id: "bbva-debito", fuente_id: "bbva", nombre: "Débito BBVA", instrumento: "debito", red: "visa", tier: null, url_oficial: `${BBVA}/tarjeta-de-debito.html` },
  { id: "bbva-credito", fuente_id: "bbva", nombre: "Visa Internacional BBVA", instrumento: "credito", red: "visa", tier: null, familia: "bbva-internacional", url_oficial: `${BBVA}/tarjeta-de-credito/tarjetas-visa/visa-internacional.html` },
  { id: "bbva-mastercard-internacional", fuente_id: "bbva", nombre: "Mastercard Internacional BBVA", instrumento: "credito", red: "mastercard", tier: null, familia: "bbva-internacional", url_oficial: `${BBVA}/tarjeta-de-credito/tarjetas-mastercard-/mastercard-internacional.html` },
  { id: "bbva-oro", fuente_id: "bbva", nombre: "Visa Oro BBVA", instrumento: "credito", red: "visa", tier: "gold", familia: "bbva-oro", url_oficial: `${BBVA}/tarjeta-de-credito/tarjetas-visa/visa-oro.html` },
  { id: "bbva-mastercard-oro", fuente_id: "bbva", nombre: "Mastercard Oro BBVA", instrumento: "credito", red: "mastercard", tier: "gold", familia: "bbva-oro", url_oficial: `${BBVA}/tarjeta-de-credito/tarjetas-mastercard-/mastercard-oro.html` },
  { id: "bbva-mastercard-platinum", fuente_id: "bbva", nombre: "Mastercard Platinum BBVA", instrumento: "credito", red: "mastercard", tier: "platinum", url_oficial: `${BBVA}/tarjeta-de-credito/tarjetas-mastercard-/mastercard-platinum.html` },
  { id: "bbva-black", fuente_id: "bbva", nombre: "Mastercard Black BBVA", instrumento: "credito", red: "mastercard", tier: "black", url_oficial: `${BBVA}/tarjeta-de-credito/tarjetas-mastercard-/mastercard-black.html` },
  { id: "bbva-infinite", fuente_id: "bbva", nombre: "Visa Infinite BBVA", instrumento: "credito", red: "visa", tier: "infinite", url_oficial: `${BBVA}/tarjeta-de-credito/tarjetas-visa/visa-infinite.html` },
  { id: "bbva-comunidad-plus", fuente_id: "bbva", nombre: "Comunidad Plus BBVA (Ta-Ta)", instrumento: "credito", red: "visa", tier: null, url_oficial: `${BBVA}/tarjeta-de-credito/tarjeta-comunidad-plus.html` },
  { id: "bbva-sodimac", fuente_id: "bbva", nombre: "BBVA Sodimac", instrumento: "credito", red: "visa", tier: null, url_oficial: `${BBVA}/tarjeta-de-credito/sodimac.html` },
  { id: "bbva-consolid-travel", fuente_id: "bbva", nombre: "BBVA Consolid Travel Mastercard", instrumento: "credito", red: "mastercard", tier: null, familia: "bbva-consolid-travel", url_oficial: `${BBVA}/tarjeta-de-credito/consolid-travel.html` },
  { id: "bbva-consolid-travel-visa", fuente_id: "bbva", nombre: "BBVA Consolid Travel Visa", instrumento: "credito", red: "visa", tier: null, familia: "bbva-consolid-travel", url_oficial: `${BBVA}/tarjeta-de-credito/consolid-travel.html` },
  { id: "bbva-abtour-visa", fuente_id: "bbva", nombre: "BBVA Abtour Visa", instrumento: "credito", red: "visa", tier: null, familia: "bbva-abtour", url_oficial: `${BBVA}/tarjeta-de-credito/abtour.html` },
  { id: "bbva-abtour-mastercard", fuente_id: "bbva", nombre: "BBVA Abtour Mastercard", instrumento: "credito", red: "mastercard", tier: null, familia: "bbva-abtour", url_oficial: `${BBVA}/tarjeta-de-credito/abtour.html` },
  { id: "bbva-penarol-internacional", fuente_id: "bbva", nombre: "Peñarol BBVA Mastercard Internacional", instrumento: "credito", red: "mastercard", tier: null, url_oficial: `${BBVA}/tarjeta-de-credito/tarjeta_peniarol.html` },
  { id: "bbva-penarol-oro", fuente_id: "bbva", nombre: "Peñarol BBVA Mastercard Oro", instrumento: "credito", red: "mastercard", tier: "gold", url_oficial: `${BBVA}/tarjeta-de-credito/tarjeta_peniarol.html` },
  { id: "bbva-penarol-platinum", fuente_id: "bbva", nombre: "Peñarol BBVA Mastercard Platinum", instrumento: "credito", red: "mastercard", tier: "platinum", url_oficial: `${BBVA}/tarjeta-de-credito/tarjeta_peniarol.html` },
  { id: "bbva-nacional-internacional", fuente_id: "bbva", nombre: "Nacional BBVA Mastercard Internacional", instrumento: "credito", red: "mastercard", tier: null, url_oficial: `${BBVA}/tarjeta-de-credito/tarjeta_nacional.html` },
  { id: "bbva-nacional-oro", fuente_id: "bbva", nombre: "Nacional BBVA Mastercard Oro", instrumento: "credito", red: "mastercard", tier: "gold", url_oficial: `${BBVA}/tarjeta-de-credito/tarjeta_nacional.html` },
  { id: "bbva-nacional-platinum", fuente_id: "bbva", nombre: "Nacional BBVA Mastercard Platinum", instrumento: "credito", red: "mastercard", tier: "platinum", url_oficial: `${BBVA}/tarjeta-de-credito/tarjeta_nacional.html` },
  // BBVA no emite Visa Platinum: el tarifario de Visa llega a Internacional, Oro e Infinite.
  { id: "bbva-platinum", fuente_id: "bbva", nombre: "Visa Platinum BBVA", instrumento: "credito", red: "visa", tier: "platinum", activo: false },

  // Midinero (Redpagos): la prepaga Mastercard y la de alimentación, que el
  // empleador le da al trabajador (como la de Itaú).
  { id: "midinero-mastercard", fuente_id: "midinero", nombre: "Midinero Mastercard", instrumento: "prepaga", red: "mastercard", tier: null, url_oficial: "https://www.midinero.com.uy/productos/midinero-tarjeta-prepaga-uruguay/" },
  { id: "midinero-alimentacion", fuente_id: "midinero", nombre: "Midinero Alimentación", instrumento: "prepaga", red: "mastercard", tier: null, url_oficial: "https://www.midinero.com.uy/productos/midinero-alimentacion/" },

  // Nativa: tarjeta de crédito de la red Cabal (#79).
  { id: "nativa-cabal", fuente_id: "nativa", nombre: "Nativa Cabal", instrumento: "credito", red: "cabal", tier: null, url_oficial: "https://www.nativacabal.com.uy/tarjeta/" },

  // Club El País: la tarjeta de socio que viene con la suscripción al diario.
  // No es un medio de pago; el descuento se pide mostrándola al pagar.
  // ANDA: la tarjeta de crédito propia, la ANDA VISA y la prepaga DEANDA Visa.
  { id: "anda-credito", fuente_id: "anda", nombre: "Tarjeta ANDA", instrumento: "credito", red: "propia", tier: null, url_oficial: "https://anda.com.uy/tarjeta-de-credito/" },
  { id: "anda-visa", fuente_id: "anda", nombre: "ANDA VISA", instrumento: "credito", red: "visa", tier: null, url_oficial: "https://anda.com.uy/tarjeta-de-credito/" },
  { id: "anda-deanda", fuente_id: "anda", nombre: "DEANDA Visa Prepaga", instrumento: "prepaga", red: "visa", tier: null, url_oficial: "https://anda.com.uy/tarjeta-prepaga/" },

  { id: "club-el-pais-socio", fuente_id: "club-el-pais", nombre: "Socio Club El País", instrumento: "membresia", red: "propia", tier: null, url_oficial: "https://www.clubelpais.com.uy/suscribite/" },

  // Prex: una sola tarjeta. El saldo (QR Toke) es un medio de pago, no una tarjeta.
  { id: "prex-saldo", fuente_id: "prex", nombre: "Saldo Prex", instrumento: "saldo", red: "propia", tier: null, url_oficial: "https://www.prexcard.com/toke" },
  { id: "prex-mastercard", fuente_id: "prex", nombre: "Prex Mastercard", instrumento: "prepaga", red: "mastercard", tier: null, url_oficial: "https://www.prexcard.com/" },
] as const;
