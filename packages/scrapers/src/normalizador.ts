import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import {
  BeneficioNormalizadoSchema,
  CATEGORIAS,
  PRODUCTOS,
  normalizarNombreTarjeta,
  type BeneficioNormalizado,
} from "@tarjetazo/core";
import { SIN_REGLAS, type ReglasDb } from "./reglas-db.js";
import { slugificar } from "./slug.js";
import type { Crudo, Extraido } from "./tipos.js";

/** Fijado en docs/03-spec.md. */
export const MODELO = "claude-sonnet-5";

const SLUGS_CATEGORIA = CATEGORIAS.map((c) => c.slug) as [string, ...string[]];

const DEPARTAMENTOS = [
  "artigas", "canelones", "cerro-largo", "colonia", "durazno", "flores", "florida",
  "lavalleja", "maldonado", "montevideo", "paysandu", "rio-negro", "rivera", "rocha",
  "salto", "san-jose", "soriano", "tacuarembo", "treinta-y-tres",
] as const;

/**
 * Schema de extracción, distinto del de la base: acá todo es obligatorio (con
 * `null` para lo ausente) porque los structured outputs no manejan defaults, y
 * los productos vienen como texto libre para mapearlos nosotros.
 */
const TramoSchema = z.object({
  titulo: z.string().describe("Una línea, sin el nombre del banco. Ej: '25% de descuento'"),
  descuento_raw: z.string().describe("El texto original del descuento, tal cual lo publica la fuente"),
  tipo: z.enum(["porcentaje", "cuotas", "reintegro", "2x1"]),
  porcentaje: z.number().nullable().describe("Solo si tipo=porcentaje o reintegro"),
  cuotas: z.number().int().nullable().describe("Solo si tipo=cuotas"),
  productos: z
    .array(z.string())
    .describe("Tarjetas o medios de pago que dan ESTE tramo, con el nombre que usa la página. Vacío = todos los de la fuente"),
  dias_semana: z.array(z.number().int().min(0).max(6)).describe("0=domingo … 6=sábado. Vacío = todos los días"),
  vigencia_desde: z.string().nullable().describe("YYYY-MM-DD"),
  vigencia_hasta: z.string().nullable().describe("YYYY-MM-DD"),
  departamentos: z.array(z.enum(DEPARTAMENTOS)).describe("Vacío = todo el país"),
  tope_monto: z.number().nullable().describe("En pesos uruguayos"),
  tope_periodo: z.enum(["dia", "semana", "mes", "compra", "beneficio"]).nullable(),
  canal: z.enum(["presencial", "online", "ambos"]),
  mecanica: z.array(z.enum(["qr", "nfc", "app"])),
  acumulable: z.boolean().nullable(),
  compra_minima: z.number().nullable(),
  requiere_activacion: z.boolean(),
  como_usarlo: z.array(z.string()).describe("Pasos concretos, si la página los explica"),
});

const PaginaSchema = z.object({
  es_beneficio: z.boolean().describe("false si la página es institucional, un sorteo o un listado, no un beneficio"),
  comercio_nombre: z.string().describe("Nombre del comercio, sin adjetivos ni el nombre del banco"),
  categoria: z.enum(SLUGS_CATEGORIA),
  legales_raw: z.string().nullable().describe("El bloque de condiciones/letra chica, textual"),
  tramos: z
    .array(TramoSchema)
    .describe("Un tramo por combinación de descuento y tarjetas. '25% con Platinum y 15% con clásicas' son DOS tramos"),
});

const SISTEMA = `Sos un extractor de beneficios de tarjetas para un agregador uruguayo.

Recibís el texto de una página de beneficios de un banco y devolvés datos estructurados.

Reglas:
- Un tramo por combinación distinta de descuento y tarjetas. Si la página dice "25% con Platinum y Black, 15% con las clásicas", son dos tramos.
- No inventes. Lo que la página no dice va en null o en lista vacía.
- \`porcentaje\` es cuánto se descuenta del precio de una compra. Una bonificación de un costo, un trámite o una comisión ("garantía de alquiler gratis", "sin costo de emisión") no es un descuento del 100%: si el beneficio no entra en ninguno de los tipos, poné es_beneficio=false.
- \`descuento_raw\` y \`legales_raw\` van textuales, sin reescribir: se muestran como letra chica.
- Las fechas del texto vienen en DD/MM/AAAA; devolvelas como AAAA-MM-DD.
- Los montos son en pesos uruguayos salvo que diga USD. Sacá los separadores de miles.
- En \`productos\` copiá el nombre de cada tarjeta como aparece en la página, sin normalizar, y listalas por separado: "tarjetas de crédito y débito BROU VISA" son dos entradas ("BROU VISA crédito", "BROU VISA débito").
- Si la página no describe un beneficio en un comercio concreto, poné es_beneficio=false y dejá tramos vacío. Eso incluye páginas institucionales, sorteos, listados y las características de la tarjeta en sí (compras en el exterior, seguros, asistencia al viajero): no son comercios.

Categorías disponibles: ${CATEGORIAS.map((c) => `${c.slug} (${c.label})`).join(", ")}.`;

/**
 * Los nombres que usa cada fuente para sus tarjetas contra los ids del
 * catálogo. Se compara sobre el texto en minúsculas y sin acentos, de más
 * específico a más general (para que "recompensa mastercard black" no caiga en
 * "recompensa mastercard").
 */
/** Todos los productos activos de una fuente que usan cierto instrumento. */
function porInstrumento(fuenteId: string, ...instrumentos: string[]): string[] {
  return PRODUCTOS.filter(
    (p) => p.fuente_id === fuenteId && p.activo !== false && instrumentos.includes(p.instrumento),
  ).map((p) => p.id);
}

/**
 * Los productos activos de una fuente con cierto plástico. Es como las páginas
 * de descuentos nombran las tarjetas ("15% con Infinite"): por red y tier, no
 * por producto comercial. Un tier puede estar en varios productos (la Visa
 * Infinite de Santander viene en tres packs) y el beneficio vale para todos.
 */
function porPlastico(
  fuenteId: string,
  plastico: { red?: string; tier?: string | null; instrumento?: string },
): string[] {
  return PRODUCTOS.filter(
    (p) =>
      p.fuente_id === fuenteId &&
      p.activo !== false &&
      (plastico.red === undefined || p.red === plastico.red) &&
      (plastico.tier === undefined || p.tier === plastico.tier) &&
      (plastico.instrumento === undefined || p.instrumento === plastico.instrumento),
  ).map((p) => p.id);
}

/** Todos los plásticos de una familia (un "Select" vale para el pack entero). */
function porFamilia(fuenteId: string, ...familias: string[]): string[] {
  return PRODUCTOS.filter(
    (p) => p.fuente_id === fuenteId && p.activo !== false && familias.includes(p.familia ?? p.id),
  ).map((p) => p.id);
}

/**
 * Reglas por fuente, de más específica a más general. Una regla puede resolver
 * a varios productos: las páginas a veces dicen "tarjetas de crédito BROU" sin
 * nombrar ninguna, y eso son todas las de crédito.
 */
const ALIAS: Record<string, [RegExp, string[]][]> = {
  // BROU nombra la misma tarjeta de dos formas según la página: "BROU
  // Recompensa Mastercard Black" y, más corto, "Mastercard Black".
  brou: [
    // Van primero: "MI BROU Visa Débito" y "AlfaBROU Mastercard" también
    // matchean las reglas de red de abajo.
    [/mi ?brou|tarjeta joven/, ["brou-mi-brou"]],
    [/alfa ?brou|prepag[ao] internacional/, porFamilia("brou", "brou-alfabrou")],
    [/mastercard.*black|black.*mastercard|recompensa.*black/, ["brou-recompensa-black"]],
    [/mastercard.*platinum|recompensa.*platinum/, ["brou-recompensa-platinum"]],
    [/mastercard.*(oro|gold)|recompensa.*(oro|gold)/, ["brou-recompensa-gold"]],
    [/mastercard.*debito|debito.*mastercard|recompensa.*debito/, ["brou-recompensa-debito"]],
    [/mastercard|recompensa/, ["brou-recompensa"]],
    [/visa.*black/, ["brou-visa-black"]],
    [/visa.*platinum/, ["brou-visa-platinum"]],
    [/visa.*(oro|gold)/, ["brou-visa-gold"]],
    [/visa.*debito|debito.*visa/, ["brou-visa-debito"]],
    [/visa/, ["brou-visa"]],
    [/tuapp|tu app/, ["brou-tuapp"]],
    // Las corporativas son otra línea de producto y no están en el catálogo:
    // mejor a revisión que mapearlas a las de consumo. Lista vacía = no mapea.
    [/corporativ/, []],
    // Menciones genéricas, sin nombrar una tarjeta en particular.
    [/credito/, porInstrumento("brou", "credito")],
    [/debito/, porInstrumento("brou", "debito")],
    [/prepaga/, porInstrumento("brou", "prepaga")],
  ],

  santander: [
    [/farmacard/, ["santander-farmacard"]],
    [/hiperm[aá]s/, ["santander-hipermas"]],
    [/amex|american express/, ["santander-amex"]],
    // Segmentos: vale para todos los plásticos del pack.
    [/private/, porFamilia("santander", "santander-private")],
    [/select/, porFamilia("santander", "santander-select")],
    [/a{1,2}dvantage/, porFamilia("santander", "santander-aadvantage", "santander-aadvantage-trilogy")],
    // Tiers: por red + tier, en todos los productos que lo tengan.
    [/mastercard.*black|black.*mastercard/, porPlastico("santander", { red: "mastercard", tier: "black" })],
    [/visa.*infinite|infinite.*visa|infinite/, porPlastico("santander", { red: "visa", tier: "infinite" })],
    [/black/, porPlastico("santander", { tier: "black" })],
    [/mastercard.*platinum|platinum.*mastercard/, porPlastico("santander", { red: "mastercard", tier: "platinum" })],
    [/visa.*platinum|platinum.*visa/, porPlastico("santander", { red: "visa", tier: "platinum" })],
    [/platinum/, porPlastico("santander", { tier: "platinum" })],
    // Red a secas: la clásica de esa red.
    [/mastercard/, ["santander-mastercard"]],
    [/visa/, ["santander-visa"]],
    [/debito/, porInstrumento("santander", "debito")],
    [/credito/, porInstrumento("santander", "credito")],
    // "Santander" a secas: cualquier tarjeta del banco. "Puntos" es el
    // programa de puntos, no una tarjeta: queda en revisión a propósito.
    [/^santander$/, porInstrumento("santander", "credito", "debito")],
  ],

  itau: [
    [/latam.*platinum|platinum.*latam/, ["itau-latam-pass-platinum"]],
    [/latam/, ["itau-latam-pass", "itau-latam-pass-platinum"]],
    [/\bu ?25\b|universitari/, ["itau-debito-u25"]],
    [/volar/, ["itau-debito-volar"]],
    [/junior/, ["itau-debito-junior"]],
    [/pocket/, ["itau-pocket"]],
    [/personal bank/, ["itau-personal-bank"]],
    [/alimentacion/, ["itau-alimentacion"]],
    // "Azules" es como Itaú llama a las de débito por pago de sueldos.
    [/sueldo|azul/, ["itau-debito-sueldo"]],
    [/mastercard.*black|black/, ["itau-mastercard-black"]],
    [/visa.*signature|infinite/, ["itau-visa-signature"]],
    // En las landings de restaurantes dice "tarjetas de crédito Platinum" a secas.
    [/platinum/, ["itau-visa-platinum", "itau-latam-pass-platinum"]],
    [/mastercard/, ["itau-mastercard"]],
    [/visa/, ["itau-visa"]],
    [/debito/, porInstrumento("itau", "debito")],
    [/credito/, porInstrumento("itau", "credito")],
  ],

  scotiabank: [
    // Las Amex van primero: "Amex Gold" y "The Platinum Card" también matchean
    // las reglas de nivel de abajo, que antes las mandaban a las Visa.
    [/(copa|connectmiles).*(gold|oro)|(gold|oro).*(copa|connectmiles)/, ["scotiabank-amex-gold"]],
    [/copa|connectmiles/, ["scotiabank-amex-copa-platinum"]],
    [/platinum card/, ["scotiabank-amex-platinum"]],
    [/(amex|american express).*platinum|platinum.*(amex|american express)/, ["scotiabank-amex-platinum", "scotiabank-amex-copa-platinum"]],
    [/(amex|american express).*(gold|oro)|(gold|oro).*(amex|american express)|gold card/, ["scotiabank-amex-gold"]],
    [/infinite|signature/, ["scotiabank-visa-infinite", "scotiabank-visa-signature"]],
    [/visa.*platinum|platinum.*visa/, ["scotiabank-visa-platinum"]],
    [/visa.*(gold|oro)|(gold|oro).*visa/, ["scotiabank-visa-gold"]],
    // "Platinum" o "Gold" a secas: todas las de ese nivel. Scotiabank ya no
    // vende la Visa Gold, pero quien la tiene sigue entrando.
    [/platinum/, ["scotiabank-visa-platinum", "scotiabank-amex-platinum", "scotiabank-amex-copa-platinum"]],
    [/gold|oro/, ["scotiabank-visa-gold", "scotiabank-amex-gold"]],
    [/amex|american express/, ["scotiabank-amex"]],
    [/debito.*premium|premium/, ["scotiabank-debito-premium"]],
    [/mastercard/, ["scotiabank-mastercard"]],
    [/visa/, ["scotiabank-visa"]],
    [/debito/, porInstrumento("scotiabank", "debito")],
    [/credito/, porInstrumento("scotiabank", "credito")],
    // "Tarjetas Scotiabank" a secas: cualquiera del banco.
    [/scotia/, porInstrumento("scotiabank", "credito", "debito")],
  ],

  oca: [
    [/blue.*debito|debito.*blue/, ["oca-blue-debito"]],
    [/blue/, ["oca-blue"]],
    // OCA abrevia "Mastercard" como "Master" en varias fichas.
    [/mastercard|master\b/, ["oca-mastercard"]],
    [/visa/, ["oca-visa"]],
    [/debito/, porInstrumento("oca", "debito")],
    [/credito/, porInstrumento("oca", "credito")],
  ],
};

function normalizarTexto(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Reglas creadas desde el backoffice. Se cargan una vez por proceso (el runner
 * y `scrape revisiones` lo hacen al arrancar) en vez de pasarlas por cada
 * normalizador: todos terminan en `mapearProductos`.
 */
let reglasDb: ReglasDb = SIN_REGLAS;

export function usarReglasDb(reglas: ReglasDb): void {
  reglasDb = reglas;
}

/**
 * Un nombre de la página puede corresponder a varios productos: "tarjetas de
 * crédito y débito BROU VISA" son dos.
 */
export function mapearProductos(
  fuenteId: string,
  nombres: string[],
): { ids: string[]; desconocidos: string[] } {
  const reglas = ALIAS[fuenteId] ?? [];
  const aliasDb = reglasDb.alias.get(fuenteId);
  const ignorarDb = reglasDb.ignorar.get(fuenteId);
  const idsValidos = new Set(
    PRODUCTOS.filter((p) => p.fuente_id === fuenteId && p.activo !== false).map((p) => p.id),
  );
  const ids = new Set<string>();
  const desconocidos: string[] = [];

  for (const nombre of nombres) {
    // Las reglas del backoffice van primero y por texto exacto: son la
    // corrección a mano de algo que los regex de abajo no resolvieron.
    const exacto = normalizarNombreTarjeta(nombre);
    if (ignorarDb?.has(exacto)) continue;

    const t = normalizarTexto(nombre);
    // La primera regla que matchea gana: van de más específica a más general.
    const regla = reglas.find(([re]) => re.test(t));
    const encontrados = (aliasDb?.get(exacto) ?? regla?.[1] ?? []).filter((id) =>
      idsValidos.has(id),
    );
    if (encontrados.length > 0) for (const id of encontrados) ids.add(id);
    else desconocidos.push(nombre);
  }
  return { ids: [...ids], desconocidos };
}

/**
 * Los tipos de tarjeta que nombra un texto sin nombrar ninguna tarjeta: "con
 * tarjetas de débito", "tarjetas de crédito y débito". El modelo deja
 * `productos` vacío en esos casos (no hay un nombre de tarjeta que copiar) y
 * vacío significa "todas las de la fuente": un descuento solo con débito
 * terminaba en las páginas de las de crédito.
 */
function instrumentosDe(texto: string | null): string[] {
  if (!texto) return [];
  // "Débito automático" es un medio de pago de facturas, no una tarjeta.
  const t = normalizarTexto(texto).replace(/debitos? automaticos?/g, "");
  const out: string[] = [];
  if (/\bcredito\b/.test(t)) out.push("credito");
  if (/\bdebito\b/.test(t)) out.push("debito");
  if (/\bprepagas?\b/.test(t)) out.push("prepaga");
  return out;
}

/**
 * Productos de un tramo para el que el modelo no nombró tarjetas. Manda el
 * texto del tramo; la letra chica es de toda la página y se usa solo si el
 * tramo no dice nada. Sin mención de un tipo, queda vacío: aplica a todas.
 */
export function productosPorTipo(
  fuenteId: string,
  descuentoRaw: string,
  legalesRaw: string | null,
): string[] {
  const instrumentos = instrumentosDe(descuentoRaw);
  const tipos = instrumentos.length > 0 ? instrumentos : instrumentosDe(legalesRaw);
  return tipos.length > 0 ? porInstrumento(fuenteId, ...tipos) : [];
}

export async function normalizar(crudo: Crudo, cliente = new Anthropic()): Promise<Extraido> {
  const res = await cliente.messages.parse({
    model: MODELO,
    max_tokens: 8000,
    // El sistema no cambia entre páginas: cachearlo abarata cada corrida.
    system: [{ type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `Fuente: ${crudo.fuente_id}\nURL: ${crudo.url_fuente}\n\n---\n${crudo.contenido}`,
      },
    ],
    output_config: { format: zodOutputFormat(PaginaSchema) },
  });

  const uso = {
    entrada: res.usage.input_tokens,
    cache_escritura: res.usage.cache_creation_input_tokens ?? 0,
    cache_lectura: res.usage.cache_read_input_tokens ?? 0,
    salida: res.usage.output_tokens,
  };
  const pagina = res.parsed_output;
  if (!pagina || !pagina.es_beneficio) {
    return { crudo, comercio: null, beneficios: [], productos_desconocidos: [], es_beneficio: false, uso };
  }

  const comercio_key = slugificar(pagina.comercio_nombre);
  const beneficios: BeneficioNormalizado[] = [];
  const desconocidos: string[] = [];

  for (const [i, tramo] of pagina.tramos.entries()) {
    const mapeo = mapearProductos(crudo.fuente_id, tramo.productos);
    desconocidos.push(...mapeo.desconocidos);
    const ids =
      tramo.productos.length === 0
        ? productosPorTipo(crudo.fuente_id, tramo.descuento_raw, pagina.legales_raw)
        : mapeo.ids;

    const candidato = {
      comercio_key,
      titulo: tramo.titulo,
      descuento_raw: tramo.descuento_raw,
      porcentaje: tramo.porcentaje,
      cuotas: tramo.cuotas,
      tipo: tramo.tipo,
      dias_semana: tramo.dias_semana,
      vigencia_desde: tramo.vigencia_desde,
      vigencia_hasta: tramo.vigencia_hasta,
      departamentos: tramo.departamentos,
      productos_elegibles: ids,
      tope_monto: tramo.tope_monto,
      tope_periodo: tramo.tope_periodo,
      canal: tramo.canal,
      mecanica: tramo.mecanica,
      acumulable: tramo.acumulable,
      compra_minima: tramo.compra_minima,
      requiere_activacion: tramo.requiere_activacion,
      legales_raw: pagina.legales_raw,
      como_usarlo: tramo.como_usarlo,
      url_fuente: crudo.url_fuente,
    };

    const parsed = BeneficioNormalizadoSchema.safeParse(candidato);
    if (parsed.success) {
      beneficios.push(parsed.data);
    } else {
      desconocidos.push(
        `tramo ${i}: ${parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}`,
      );
    }
  }

  return {
    crudo,
    comercio: { key: comercio_key, nombre: pagina.comercio_nombre, categoria: pagina.categoria },
    beneficios,
    productos_desconocidos: desconocidos,
    uso,
  };
}

export { PaginaSchema, SISTEMA };
