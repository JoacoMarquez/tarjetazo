import { BeneficioNormalizadoSchema, Departamento, type BeneficioNormalizado } from "@tarjetazo/core";
import { mapearProductos, sinFechaComodin, topeDevolucion } from "../normalizador.js";
import { slugificar } from "../slug.js";
import { PaginaPendiente, type Crudo, type Extraido } from "../tipos.js";
import type { DatosOca } from "./oca.js";
import { clausulas, diasDe, diasEnTitulo, sinAcentos, topeDelTramo, topesDelLegal, type Clausula } from "./legales.js";

/**
 * OCA, sin modelo. Su API ya trae casi todo estructurado: las tarjetas
 * (`product`), los días, las fechas, los medios de pago y los departamentos.
 * Del texto solo se leen los tramos ("10% de dto. + 12 cuotas*", del título
 * del beneficio) y los topes de las condiciones.
 *
 * OCA publica un ítem por producto ("Bela TC" con Visa y Mastercard, "Bela
 * Blue" con la débito) y también promociones que no son de un comercio
 * (Metros, préstamos, "Días OCA de Ciberdescuentos", "0% de recargo en el
 * exterior"): esas no son beneficios.
 */

const FUENTE = "oca";

/** `product` → plásticos. 4 (préstamos) y 5 (seguros) no son tarjetas. */
const PRODUCTO: Record<number, string> = { 1: "oca-visa", 2: "oca-mastercard", 3: "oca-blue-debito" };

/** `location`: 1..19, los departamentos en orden alfabético (10 = Montevideo). */
const DEPARTAMENTOS = [...Departamento.options].sort((a, b) => a.localeCompare(b, "es"));

/**
 * `payment_method`, como los nombra el sitio: 1 tarjeta física, 2
 * contactless, 3 pagos online, 4 TOKE, 5 QR, 6 NFC, 7 App de OCA, 8 Google
 * Pay, 9 Apple Pay, 10 QR OCA, 11 OCA Pay, 12 Click 2 Pay, 13 transferencia,
 * 14 Metros, 15 cupón web.
 */
const MEDIOS_WEB = new Set([3, 12, 15]);
const MEDIOS_LOCAL = new Set([1, 2, 5, 6, 8, 9, 10]);

/** Categorías de OCA → las nuestras (solo para comercios nuevos: la base no pisa la de uno que ya existe). */
const CATEGORIAS: Record<string, string> = {
  gastronomia: "restaurantes",
  supermercado: "supermercados",
  moda: "indumentaria",
  tecnologia: "electro-tecnologia",
  hogar: "hogar-deco",
  ferreterias: "hogar-deco",
  libreria: "libreria-juguetes",
  ninos: "libreria-juguetes",
  deportes: "deportes",
  bienestar: "salud-belleza",
  salud: "salud-belleza",
  mascotas: "mascotas",
  transporte: "transporte",
  telefonia: "servicios",
  educacion: "servicios",
  entretenimiento: "entretenimiento",
  viajes: "viajes",
};

/**
 * Promociones que no son de un comercio: programas de OCA, campañas que
 * agrupan comercios (cada uno tiene su propio ítem) y productos financieros.
 */
const NO_ES_COMERCIO =
  /^(?:test?e\b|los mejores comercios|d[ií]as? oca\b|d[ií]a del ni[nñ]o|educaci[oó]n$|cuotas en el exterior|\d+ cuotas|0% de recargo|(?:hasta )?\d+ puntos|sum[aá] metros|\d[\d.]* metros|present[aá] a un amigo|retiro en efectivo|transfer|tipo de cambio|pr[eé]stamos?|prestaciones|d[eé]bitos autom)/i;

/**
 * El comercio: la marca, salvo que no aparezca en el título (OCA a veces
 * copia la de otro ítem: "LOi - Ciberdescuentos - TC" con marca
 * Electroventas, "Duty Free - TC" con marca "12 cuotas", "Kentucky TC" con
 * "Kentchucky"); entonces el título sin lo que es del producto o la campaña.
 * Exportada para los tests.
 */
export function comercioDe(d: Pick<DatosOca, "titulo" | "marca">): string {
  const marca = d.marca.replace(/\s+/g, " ").trim();
  const titulo = d.titulo.replace(/\s+/g, " ").trim();
  if (marca && sinAcentos(titulo).includes(sinAcentos(marca))) return marca;
  return titulo
    .split(/\s+-\s+/)[0]!
    .replace(/\s+(?:TC\s*\+\s*BLUE|TC|Blue|DDN)$/i, "")
    .replace(/\s+\d+%$/, "")
    .trim();
}

/** Los tramos del título del beneficio ("10% de dto. + 12 cuotas*"); si no tiene, del de la lista. */
function tramosDe(d: DatosOca): Clausula[] {
  // "2 puntos de IVA menos en todas tus recargas en STM" es un descuento del 2%.
  const conIva = (t: string) => t.replace(/\b(\d{1,2}) puntos de (?:devoluci[oó]n de )?iva\b/gi, "$1% de IVA");
  for (const texto of [d.tituloBeneficio, d.tituloLista]) {
    const cs = clausulas(conIva(texto));
    if (cs.length > 0) return cs;
  }
  return [];
}

/**
 * "12 cuotas válidas únicamente para Mastercard de OCA", "Promoción 12
 * cuotas válida con tarjeta de crédito Mastercard de OCA": las cuotas son
 * solo con la Mastercard, salvo que la misma frase nombre también la VISA.
 */
function cuotasSoloMastercard(condiciones: string): boolean {
  return sinAcentos(condiciones)
    .split(/(?<=\.)\s|\n/)
    .some((f) => /cuotas/.test(f) && /master ?card/.test(f) && !/\bvisa\b/.test(f));
}

/**
 * Presencial u online según lo que dice la ficha ("En locales físicos", "En
 * compras web", "En compras presenciales y web"); si no dice, según los
 * medios de pago.
 */
function canalDe(d: DatosOca): BeneficioNormalizado["canal"] {
  const t = sinAcentos(`${d.descripcion} ${d.tituloBeneficio} ${d.condiciones}`);
  if (/locales fisicos|exclusivamente para compras en locales/.test(t)) return "presencial";
  const web = /compras web|en la web|online/.test(t);
  const local = /presencial|locales y la web|en locales/.test(t);
  if (web && local) return "ambos";
  if (web) return "online";
  const medioWeb = d.medios.some((m) => MEDIOS_WEB.has(m));
  const medioLocal = d.medios.some((m) => MEDIOS_LOCAL.has(m));
  return medioWeb && medioLocal ? "ambos" : medioWeb ? "online" : "presencial";
}

function acumulableDe(texto: string): boolean | null {
  const t = sinAcentos(texto);
  if (/no (?:es )?(?:combinable ni )?acumulable|no se acumula|no acumula/.test(t)) return false;
  if (/\bes acumulable\b/.test(t)) return true;
  return null;
}

function tituloDe(c: Clausula, dias: number[]): string {
  let valor: string;
  if (c.tipo === "cuotas") {
    const sinQue = /sin inter[eé]s/i.test(c.texto) ? " sin interés" : /sin recargo/i.test(c.texto) ? " sin recargo" : "";
    valor = `${c.hasta ? "Hasta " : ""}${c.cuotas} cuotas${sinQue}`;
  } else if (c.tipo === "2x1") {
    const que = c.texto.match(/2\s*x\s*1\s+en\s+([^.*+]+?)(?=\s+todos|\s+con|[.*+]|$)/i)?.[1]?.trim();
    valor = `2x1${que ? ` en ${que}` : " en entradas"}`;
  } else {
    valor = `${c.hasta ? "Hasta " : ""}${c.porcentaje}% de descuento`;
  }
  return `${valor}${diasEnTitulo(dias)}`.slice(0, 160);
}

/**
 * Los días. OCA: 0 = lunes; el esquema: 0 = domingo. Si la API dice los
 * siete pero el título o las condiciones los acotan ("20% de dto de lunes a
 * viernes", "Promoción válida de lunes a jueves"), valen esos. Exportada
 * para los tests.
 */
export function diasDeOca(d: Pick<DatosOca, "dias" | "tituloBeneficio" | "condiciones">): number[] {
  if (d.dias.length > 0 && d.dias.length < 7) return [...new Set(d.dias.map((x) => (x + 1) % 7))].sort((a, b) => a - b);
  const delTitulo = diasDe(d.tituloBeneficio);
  if (delTitulo.length > 0) return delTitulo.sort((a, b) => a - b);
  const frase = d.condiciones.split(/(?<=\.)\s|\n/).find((f) => /promoci[oó]n v[aá]lida|descuento/i.test(f) && diasDe(f).length > 0);
  return frase ? diasDe(frase).sort((a, b) => a - b) : [];
}

function esOca(d: unknown): d is DatosOca {
  const x = d as DatosOca | undefined;
  return !!x && typeof x.titulo === "string" && Array.isArray(x.productos) && Array.isArray(x.dias);
}

const noEsBeneficio = (crudo: Crudo): Extraido => ({ crudo, comercio: null, beneficios: [], productos_desconocidos: [], es_beneficio: false });

export function normalizarOca(crudo: Crudo): Extraido {
  const d = crudo.datos;
  if (!esOca(d)) throw new Error(`oca: ${crudo.external_id} no trae los datos de la API`);

  const nombre = comercioDe(d);
  const tarjetas = d.productos.map((p) => PRODUCTO[p]).filter((id): id is string => !!id);
  // Préstamos, seguros, programas de Metros y campañas que agrupan comercios.
  const financiero = d.productos.some((p) => p === 4 || p === 5);
  // Préstamos y seguros (productos 4 y 5) no son tarjetas: "30% de descuento
  // en la tasa de tu préstamo" no es un beneficio de comercio.
  const deOca = NO_ES_COMERCIO.test(nombre);
  if (!nombre || tarjetas.length === 0 || financiero || deOca || d.medios.every((m) => m === 14 || m === 13)) {
    return noEsBeneficio(crudo);
  }
  const tramos = tramosDe(d);
  if (tramos.length === 0) {
    // "La mejor escala de precios" con las cuotas solo en las condiciones:
    // hay un beneficio que no supimos leer.
    if (clausulas(d.condiciones).some((c) => c.tipo === "cuotas" || c.tipo === "porcentaje")) {
      throw new PaginaPendiente("el título no dice el beneficio y las condiciones sí");
    }
    return noEsBeneficio(crudo);
  }

  const key = slugificar(nombre);
  const dias = diasDeOca(d);
  const departamentos = (d.departamentos.length >= DEPARTAMENTOS.length ? [] : d.departamentos.map((i) => DEPARTAMENTOS[i - 1]).filter(Boolean)).sort() as BeneficioNormalizado["departamentos"];
  const canal = canalDe(d);
  const acumulable = acumulableDe(d.condiciones);
  const soloMaster = cuotasSoloMastercard(d.condiciones);
  const topes = topesDelLegal(d.condiciones.replace(/\$\s*u\b/gi, "$"), (f) => mapearProductos(FUENTE, [f]).ids);

  const beneficios: BeneficioNormalizado[] = [];
  const desconocidos: string[] = [];
  for (const [i, c] of tramos.entries()) {
    const ids = c.tipo === "cuotas" && soloMaster ? tarjetas.filter((id) => id === "oca-mastercard") : tarjetas;
    if (ids.length === 0) continue;
    let tope = null;
    if (c.tipo === "porcentaje") {
      const r = topeDelTramo(topes, { pct: c.porcentaje!, ids });
      if (r.ambiguo) throw new PaginaPendiente(`las condiciones publican varios topes y no se sabe cuál es el del ${c.porcentaje}%`);
      tope = r.tope;
    }
    const candidato = {
      comercio_key: key,
      titulo: tituloDe(c, dias),
      descuento_raw: (d.tituloBeneficio || d.tituloLista).replace(/\s+/g, " ").trim(),
      porcentaje: c.porcentaje,
      cuotas: c.cuotas,
      tipo: c.tipo,
      dias_semana: dias,
      vigencia_desde: d.desde,
      vigencia_hasta: sinFechaComodin(d.hasta),
      departamentos,
      productos_elegibles: [...ids].sort(),
      ...topeDevolucion({
        tipo: c.tipo,
        porcentaje: c.porcentaje,
        tope_monto: tope?.monto ?? null,
        tope_moneda: tope?.moneda ?? null,
        tope_sobre: tope?.sobre ?? null,
        tope_periodo: tope?.periodo ?? null,
      }),
      canal,
      mecanica: [],
      acumulable,
      compra_minima: null,
      requiere_activacion: false,
      legales_raw: d.condiciones || null,
      como_usarlo: [],
      url_fuente: crudo.url_fuente,
    };
    const parsed = BeneficioNormalizadoSchema.safeParse(candidato);
    if (parsed.success) beneficios.push(parsed.data);
    else desconocidos.push(`tramo ${i}: ${parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}`);
  }
  const categoria = d.categorias.map((c) => CATEGORIAS[sinAcentos(c).trim()]).find(Boolean) ?? "otros";
  return {
    crudo,
    comercio: beneficios.length > 0 ? { key, nombre, categoria } : null,
    beneficios,
    productos_desconocidos: desconocidos,
  };
}
