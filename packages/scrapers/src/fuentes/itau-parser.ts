import { BeneficioNormalizadoSchema, Departamento, type BeneficioNormalizado } from "@tarjetazo/core";
import { mapearProductos, sinFechaComodin, topeDevolucion } from "../normalizador.js";
import { departamentoDeLugar, departamentos as departamentosQueNombra } from "../geo/lugares.js";
import { slugificar } from "../slug.js";
import type { Crudo, Extraido } from "../tipos.js";
import type { DatosItauFeed } from "./itau.js";
import type { DatosItauLanding } from "./itau-landings.js";
import {
  MARCA,
  MESES,
  clausulas,
  diasDe,
  diasEnTitulo,
  sinAcentos,
  topeDelTramo,
  topesDelLegal,
  vigenciaDelLegal,
  type Clausula,
} from "./legales.js";

export { clausulas };

/**
 * Itaú, sin modelo. Dos formas de página, las dos con los campos ya
 * estructurados en `crudo.datos`:
 *
 * - **Landings de restaurantes** (~200 páginas, una por restaurante): cada
 *   tramo es un encabezado fijo ("Restaurantes 25% menos Todos los días, con
 *   tarjetas de débito y crédito Personal Bank. Incluye Infinite y Black.")
 *   con las pestañas donde aparece (Montevideo, Punta del Este, Interior) y las
 *   condiciones de su landing.
 * - **Items del feed** (~35): título, descripción y bases escritas a mano, a
 *   veces con varios porcentajes en una frase ("25% menos los martes y jueves
 *   con Personal Bank y 20% menos con tarjetas Platinum. 15% menos todos los
 *   días con todas las tarjetas de crédito"). Se parten en cláusulas, una por
 *   porcentaje, 2x1 o cuotas.
 *
 * Las tarjetas pasan por `mapearProductos` (las reglas de itau y las del
 * backoffice). Lo que no encaja se descarta o va a revisión, nunca se inventa.
 */

const FUENTE = "itau";

// ---------------------------------------------------------------- tarjetas

/** Palabras que hacen de un pedazo de frase el nombre de una tarjeta de Itaú. */
const NOMBRE_TARJETA =
  /\b(volar|latam|infinite|signature|black|platinum|personal bank|junior|u ?25|pocket|alimentacion|sueldos?|azul(es)?|visa|mastercard|credito|debito)\b/;

/** Lo que dice a qué tarjetas NO aplica: "No aplica a Itaú Cuenta Pocket.", "No incluye tarjeta Pocket." */
const NEGACION = /\bno (?:aplica|incluye|es valid[oa])\b[^.]*(?:\.|$)/g;

/**
 * Las tarjetas que nombra una frase, como ids del catálogo: parte la lista y
 * pasa cada nombre por `mapearProductos`. Antes arregla lo que las reglas
 * genéricas leerían mal:
 * - "débito y crédito Personal Bank": el paquete entero (las tres Infinite);
 * - "débito Personal Bank" solo, la Débito Infinite; "crédito Personal Bank",
 *   las Visa Infinite de crédito;
 * - "todas las tarjetas de crédito (Visa y Mastercard)": todas las de crédito,
 *   no la Visa Volar Internacional.
 * Exportada para los tests.
 */
export function tarjetasDe(frase: string): { ids: string[]; desconocidos: string[]; nombres: string[] } {
  let f = sinAcentos(frase)
    .replace(NEGACION, " ")
    .replace(/\bmaster ?card\b/g, "mastercard")
    .replace(/\btarjetad e\b/g, "tarjeta de")
    .replace(/[()*"“”]/g, " ");
  const nombres: string[] = [];
  const quitar = (re: RegExp, ...agregar: string[]) => {
    if (re.test(f)) {
      nombres.push(...agregar);
      f = f.replace(re, " ");
    }
  };
  quitar(/\b(?:debito y credito|credito y debito) personal bank\b/g, "personal bank");
  quitar(/\bdebito personal bank\b/g, "debito infinite");
  quitar(/\bcredito personal bank\b/g, "credito infinite");
  quitar(/\bcredito (?:de )?visa (?:y|o) mastercard\b/g, "credito");
  for (let pedazo of f.split(/,|;|:|\/|\.|\s+y\s+|\s+e\s+|\s+o\s+/)) {
    pedazo = pedazo.replace(/\s+/g, " ").trim();
    const i = pedazo.indexOf("tarjeta");
    if (i > 0) pedazo = pedazo.slice(i);
    pedazo = pedazo.replace(/\s+(emitidas?|de banco itau|del banco|de itau uruguay|en el|en la|en los|en todos|todos los dias).*$/, "").trim();
    // "Incluye Infinite y Black" deja "incluye infinite": el nombre es lo que sigue.
    pedazo = pedazo.replace(/^incluye\s+/, "");
    if (NOMBRE_TARJETA.test(pedazo)) nombres.push(pedazo);
  }
  if (nombres.length === 0) return { ids: [], desconocidos: [], nombres };
  const { ids, desconocidos } = mapearProductos(FUENTE, nombres);
  return { ids: ids.sort(), desconocidos, nombres };
}

/**
 * Las listas del feed donde sale el item: lo único que dice de qué tarjeta es
 * un item sin texto ("15% menos en Loop"). Los paquetes no dicen nada.
 */
function tarjetasDeListas(listas: string[]): string[] {
  const nombres = listas
    .map((l) => sinAcentos(l))
    .flatMap((l) => (/credito/.test(l) ? ["credito"] : /debito/.test(l) ? ["debito"] : /alimentacion/.test(l) ? ["alimentacion"] : []));
  return nombres.length > 0 ? mapearProductos(FUENTE, nombres).ids.sort() : [];
}

// ---------------------------------------------------------------- comunes

/** "El descuento es acumulable con ofertas existentes" / "No acumulable con otras campañas". */
function acumulableDe(texto: string): boolean | null {
  const t = sinAcentos(texto);
  if (/no (?:es )?acumulable|no se acumula|no acumula con|no se suma/.test(t)) return false;
  if (/\bes acumulable\b/.test(t)) return true;
  return null;
}

/**
 * Canal: "Comprando en la web o en locales" → ambos; solo web → online;
 * "solo para compras en el local" o nada → presencial.
 */
function canalDe(texto: string): BeneficioNormalizado["canal"] {
  const t = sinAcentos(texto);
  if (/solo para compras en (?:el|los) locale?s?\b|valido solo para compras en el local/.test(t)) return "presencial";
  // "Cuenta Pocket válida únicamente en compras web" (Movie) habla de una
  // tarjeta, no del beneficio: solo cuenta "comprando en la web".
  const web = /comprando en la web|en la web o\b|pagina web|sitio web|tienda online|compras online/.test(t);
  if (!web) return "presencial";
  return /locale?s?\b|establecimiento|tienda fisica|sucursal/.test(t) ? "ambos" : "online";
}

// ---------------------------------------------------------------- fechas del tramo

type Vigencia = { desde: string | null; hasta: string | null };

const MES = "(enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre)";
const ANIO = "(?:\\s+(?:del?\\s+)?(\\d{4}))?";
/** "del 9 al 18 de octubre", "del 28 de setiembre al 3 de octubre", "del 1 al 31 octubre", con o sin año. */
const RANGO = new RegExp(
  `\\b(?:del|desde)\\s+(?:el\\s+)?(\\d{1,2})(?:\\s+de\\s+${MES}${ANIO})?\\s+(?:al|hasta(?:\\s+el)?)\\s+(?:el\\s+)?(\\d{1,2})\\s+(?:de\\s+)?${MES}${ANIO}`,
);
/** "Hasta el 10 de octubre tenés 20% menos…": solo el fin. */
const HASTA = new RegExp(`\\bhasta\\s+el\\s+(\\d{1,2})\\s+de\\s+${MES}${ANIO}`);

const DIA_MS = 86_400_000;
const fecha = (anio: number, mes: number, dia: number): string | null => {
  const f = new Date(Date.UTC(anio, mes - 1, dia));
  return f.getUTCMonth() === mes - 1 && f.getUTCDate() === dia ? f.toISOString().slice(0, 10) : null;
};
const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/**
 * Las fechas que escribe el propio tramo ("25% menos en Mosca del 9 al 18 de
 * octubre…", "Hasta el 10 de octubre tenés 20% menos…"), que mandan sobre las
 * de la página. Sin año, se toma el que deja el rango más cerca de la vigencia
 * de la página (o de la fecha de la bajada, si la página no da ninguna); si
 * el fin cae en un mes anterior al inicio, es del año siguiente. Solo el fin:
 * el inicio sigue siendo el de la página. Sin fechas en el texto, null.
 * Exportada para los tests.
 */
export function vigenciaDelTramo(texto: string, pagina: Vigencia, bajada: string): Vigencia | null {
  const t = sinAcentos(texto).replace(/°|º/g, "").replace(/\s+/g, " ");
  const ref0 = pagina.desde ?? pagina.hasta ?? bajada.slice(0, 10);
  const ref1 = pagina.hasta ?? pagina.desde ?? bajada.slice(0, 10);
  const lejania = (a: string, b: string) => Math.max(0, ms(ref0) - ms(b), ms(a) - ms(ref1)) / DIA_MS;
  const anioRef = Number(ref0.slice(0, 4));

  // Cada candidato es una vigencia para un año supuesto; gana la más cercana a la de la página.
  const elegir = (armar: (anio: number) => Vigencia | null, anioEscrito: number | null): Vigencia | null => {
    const anios = anioEscrito ? [anioEscrito] : [anioRef, anioRef - 1, anioRef + 1];
    let mejor: { v: Vigencia; d: number } | null = null;
    for (const a of anios) {
      const v = armar(a);
      if (!v?.hasta) continue;
      const d = lejania(v.desde ?? v.hasta, v.hasta);
      if (!mejor || d < mejor.d) mejor = { v, d };
    }
    return mejor?.v ?? null;
  };

  const r = t.match(RANGO);
  if (r) {
    const [, d1, m1, a1, d2, m2, a2] = r;
    const mesFin = MESES[m2!]!;
    const mesIni = m1 ? MESES[m1]! : mesFin;
    const anioFin = a2 ? Number(a2) : null;
    return elegir((a) => {
      const fin = anioFin ?? (mesFin < mesIni ? a + 1 : a);
      const ini = a1 ? Number(a1) : mesFin < mesIni ? fin - 1 : fin;
      const desde = fecha(ini, mesIni, Number(d1));
      const hasta = fecha(fin, mesFin, Number(d2));
      return desde && hasta && desde <= hasta ? { desde, hasta } : null;
    }, anioFin);
  }
  const h = t.match(HASTA);
  if (h) {
    const [, d, m, a] = h;
    const v = elegir((anio) => ({ desde: null, hasta: fecha(anio, MESES[m!]!, Number(d)) }), a ? Number(a) : null);
    if (!v) return null;
    return { desde: pagina.desde && pagina.desde <= v.hasta! ? pagina.desde : null, hasta: v.hasta };
  }
  return null;
}

/**
 * Lo que va antes de la primera marca de cada oración de un texto, en el
 * orden de `clausulas`: "Del 31 de agosto al 12 de setiembre, tenés 15% menos…"
 * → "Del 31 de agosto al 12 de setiembre, tenés". Las fechas que dice valen
 * para los tramos de esa oración.
 */
function introducciones(texto: string): Map<number, string> {
  const t = texto.replace(/\s+/g, " ").trim();
  const finales = [...t.matchAll(/\.(?=\s|\d|$)/g)].map((m) => m.index!);
  const out = new Map<number, string>();
  for (const m of t.matchAll(MARCA)) {
    const oracion = finales.filter((f) => f < m.index!).length;
    if (out.has(oracion)) continue;
    const inicio = oracion === 0 ? 0 : finales[oracion - 1]! + 1;
    out.set(oracion, t.slice(inicio, m.index!).trim());
  }
  return out;
}

function candidato(campos: Omit<BeneficioNormalizado, "mecanica" | "compra_minima" | "requiere_activacion" | "como_usarlo">) {
  return { ...campos, mecanica: [], compra_minima: null, requiere_activacion: false, como_usarlo: [] };
}

function validar(c: unknown, i: number, beneficios: BeneficioNormalizado[], desconocidos: string[]) {
  const parsed = BeneficioNormalizadoSchema.safeParse(c);
  if (parsed.success) beneficios.push(parsed.data);
  else desconocidos.push(`tramo ${i}: ${parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}`);
}

function esLanding(d: unknown): d is DatosItauLanding {
  const x = d as DatosItauLanding | undefined;
  return !!x && x.tipo === "landing" && typeof x.nombre === "string" && Array.isArray(x.tramos);
}

function esFeed(d: unknown): d is DatosItauFeed {
  const x = d as DatosItauFeed | undefined;
  return !!x && x.tipo === "feed" && typeof x.titulo === "string" && Array.isArray(x.listas);
}

// ---------------------------------------------------------------- landings

/**
 * Pestañas de las landings → departamentos. "Interior" es todo menos
 * Montevideo (no dice cuáles); con Montevideo también, todo el país.
 */
function departamentosDeUbicaciones(ubicaciones: string[]): BeneficioNormalizado["departamentos"] {
  const us = ubicaciones.map((u) => sinAcentos(u).trim());
  const out = new Set<string>();
  for (const u of us) {
    if (u === "interior") for (const d of Departamento.options) if (d !== "montevideo") out.add(d);
    const d = departamentoDeLugar(u);
    if (d) out.add(d);
  }
  if (out.size === Departamento.options.length) return [];
  return [...out].sort() as BeneficioNormalizado["departamentos"];
}

/**
 * La vigencia de un tramo de landing. Las condiciones a veces la dan por
 * ubicación ("Punta del este - Vigencia de la campaña: … Montevideo e
 * interior - Vigencia de la campaña: …"): vale la de las pestañas del tramo.
 * Si esas pestañas tienen fechas distintas, no se elige: `ambigua`.
 */
function vigenciaDeLanding(
  condiciones: string,
  ubicaciones: string[],
): { desde: string | null; hasta: string | null; ambigua: boolean } {
  // "Montevideo e interior - Vigencia…" es una sola etiqueta: no se corta en "interior".
  const partes = condiciones.split(/(?=\b(?:punta del este|montevideo(?: e interior)?|(?<!\be )interior)\s*-\s*vigencia)/i);
  if (partes.length <= 1) return { ...vigenciaDelLegal(condiciones), ambigua: false };
  const us = ubicaciones.map((u) => sinAcentos(u));
  const deLasPestanas = partes
    .filter((p) => {
      const etiqueta = sinAcentos(p.split("-")[0] ?? "");
      return us.some((u) => etiqueta.includes(u));
    })
    .map((p) => vigenciaDelLegal(p));
  const distintas = new Set(deLasPestanas.map((v) => `${v.desde}|${v.hasta}`));
  if (distintas.size === 1) return { ...deLasPestanas[0]!, ambigua: false };
  if (distintas.size === 0) return { ...vigenciaDelLegal(condiciones), ambigua: false };
  return { desde: null, hasta: null, ambigua: true };
}

function normalizarLanding(crudo: Crudo, d: DatosItauLanding): Extraido {
  const key = slugificar(d.nombre);
  const beneficios: BeneficioNormalizado[] = [];
  const desconocidos: string[] = [];
  for (const [i, t] of d.tramos.entries()) {
    const m = t.encabezado.match(/(hasta\s+)?(\d{1,2})\s*%\s*menos/i);
    if (!m) {
      desconocidos.push(`tramo ${i}: encabezado sin porcentaje: ${t.encabezado.slice(0, 120)}`);
      continue;
    }
    const porcentaje = Number(m[2]);
    const dias = diasDe(t.encabezado);
    const tarjetas = tarjetasDe(t.encabezado.slice(m.index! + m[0].length));
    desconocidos.push(...tarjetas.desconocidos);
    const vigencia = vigenciaDeLanding(t.condiciones, t.ubicaciones);
    if (vigencia.ambigua) desconocidos.push(`tramo ${i}: las condiciones dan fechas distintas para ${t.ubicaciones.join(", ")}`);
    // Las fechas que escribe el encabezado mandan sobre las de las condiciones.
    const { desde, hasta } = vigenciaDelTramo(t.encabezado, vigencia, crudo.fetched_at) ?? vigencia;
    const topes = topesDelLegal(t.condiciones, (f) => tarjetasDe(f).ids);
    const r = topeDelTramo(topes, { pct: porcentaje, ids: tarjetas.ids });
    if (r.ambiguo) desconocidos.push(`tramo ${i}: los legales publican varios topes y no se puede saber cuál es el de este tramo`);
    validar(
      candidato({
        comercio_key: key,
        titulo: `${m[1] ? "Hasta " : ""}${porcentaje}% de descuento${diasEnTitulo(dias)}`,
        descuento_raw: `${t.encabezado} En: ${t.ubicaciones.join(", ")}.`,
        porcentaje,
        cuotas: null,
        tipo: "porcentaje",
        dias_semana: dias,
        vigencia_desde: desde,
        vigencia_hasta: sinFechaComodin(hasta),
        departamentos: departamentosDeUbicaciones(t.ubicaciones),
        productos_elegibles: tarjetas.ids,
        ...topeDevolucion({
          tipo: "porcentaje",
          porcentaje,
          tope_monto: r.tope?.monto ?? null,
          tope_moneda: r.tope?.moneda ?? null,
          tope_sobre: r.tope?.sobre ?? null,
          tope_periodo: r.tope?.periodo ?? null,
        }),
        canal: "presencial",
        acumulable: acumulableDe(t.condiciones),
        legales_raw: t.condiciones || null,
        url_fuente: crudo.url_fuente,
      }),
      i,
      beneficios,
      desconocidos,
    );
  }
  return {
    crudo,
    comercio: beneficios.length > 0 ? { key, nombre: d.nombre, categoria: d.rubro } : null,
    beneficios,
    productos_desconocidos: [...new Set(desconocidos)],
  };
}

// ---------------------------------------------------------------- feed

/** Títulos que nombran un rubro, no un comercio: "25% menos en moda", "15% menos en restaurantes". */
const RUBRO_GENERICO = /^(restaurantes|moda|librerias|farmacias|hoteles|opticas|heladerias|comercios adheridos.*|todos los dias)$/;

/** Categoría para un comercio nuevo (si ya existe, la base no la pisa). */
function categoriaDe(texto: string): string {
  const t = sinAcentos(texto);
  const reglas: [RegExp, string][] = [
    [/farmacia/, "farmacias"],
    [/helad|cafe|confiter|dulce|candy/, "cafeterias"],
    [/restaurant|parrill|pizz|sushi/, "restaurantes"],
    [/librer/, "libreria-juguetes"],
    [/joyer|moda|ropa|calzado/, "indumentaria"],
    [/taxi|peaje|combustible/, "transporte"],
    [/cine|movie|teatro|entradas/, "entretenimiento"],
    [/padel|gimnas|deport|musculo/, "deportes"],
    [/iphone|celular|tecnolog|electro/, "electro-tecnologia"],
    [/supermercado|almacen/, "supermercados"],
    [/hogar|sanitari|bano|cocina/, "hogar-deco"],
  ];
  return reglas.find(([re]) => re.test(t))?.[1] ?? "otros";
}

/**
 * El comercio de un item del feed, del título: "25% y 15% menos en San Roque",
 * "2x1 en Heladería La Nevada - Salto" (la sucursal es un lugar: sale, y da el
 * departamento), "10% menos en Mosca con Personal Bank", "15% menos en
 * farmacias El Túnel". Un título que nombra un rubro ("25% menos en
 * Librerías") usa los comercios que nombran las bases ("en locales de las
 * librerías El Virrey, Escaramuza…"); si no nombran ninguno, no es un
 * beneficio de un comercio. Un título sin porcentaje ("Prat Pádel") es el
 * nombre del comercio; "Beneficios …" es un listado. Exportada para los tests.
 */
export function comercioDelFeed(d: Pick<DatosItauFeed, "titulo" | "descripcion" | "bases">): {
  nombre: string;
  departamento: string | null;
} | null {
  const titulo = d.titulo.replace(/\s+/g, " ").trim();
  let nombre: string;
  const en = titulo.match(/(?:\bmenos|\b2\s*x\s*1|\bcuotas)\b.*?\ben\s+(.+)$/i);
  if (en) nombre = en[1]!;
  else if (!/\d\s*%|2\s*x\s*1/i.test(titulo) && !/^beneficios?\b/i.test(titulo)) nombre = titulo;
  else return null;

  nombre = nombre.replace(/\s+con\s+.*$/i, "").trim();
  // "la compra de Iphone" no es un comercio: el que nombra la descripción ("… en Movigroup").
  if (/^(la )?compras? de\b/i.test(nombre)) {
    const deLaDescripcion = d.descripcion.match(/\ben\s+([A-ZÁÉÍÓÚ][\wÁÉÍÓÚáéíóúñÑ&' ]+?)(?:\s+y\s+|[.,]|$)/);
    if (!deLaDescripcion) return null;
    nombre = deLaDescripcion[1]!.trim();
  }
  const rubro = sinAcentos(nombre);
  if (RUBRO_GENERICO.test(rubro)) {
    const bases = sinAcentos(d.bases).replace(/\s+/g, " ");
    const i = bases.search(new RegExp(`(?:locales de|en) (?:las |los |la |el )?${rubro}\\s+`));
    if (i < 0) return null;
    const desde = bases.slice(i).replace(new RegExp(`^(?:locales de|en) (?:las |los |la |el )?${rubro}\\s+`), "");
    const largo = desde.search(/,?\s+(?:obtene|tenes|pagando|con tarjetas)|\./);
    // Se toma del texto original para conservar mayúsculas y acentos.
    const original = d.bases.replace(/\s+/g, " ");
    // sinAcentos no cambia el largo del texto: las posiciones valen en los dos.
    const inicio = bases.length - desde.length;
    nombre = original.slice(inicio, inicio + (largo > 0 ? largo : desde.length)).trim();
    if (!nombre) return null;
  } else {
    // "farmacias El Túnel" → "El Túnel" (la base ya tiene el alias a "Farmacia El Túnel").
    nombre = nombre.replace(/^farmacias?\s+/i, "");
  }
  let departamento: string | null = null;
  const guion = nombre.match(/^(.+?)\s+[-–]\s+(.+)$/);
  if (guion) {
    const lugar = sinAcentos(guion[2]!).trim();
    const dep = departamentoDeLugar(lugar);
    if (dep && (slugificar(lugar) === dep || departamentosQueNombra(lugar).length === 0)) {
      departamento = dep;
      nombre = guion[1]!;
    }
  }
  return { nombre, departamento };
}

/** "… solo para compras en el locales de Montevideo y Maldonado" → esos departamentos. */
function departamentosDeBases(bases: string): BeneficioNormalizado["departamentos"] {
  const m = sinAcentos(bases).match(/(?:solo|unicamente) (?:para compras )?en (?:el |los )?locales? de ([a-z ,]+?)(?:\.|$| no | para )/);
  if (!m) return [];
  return departamentosQueNombra(m[1]!) as BeneficioNormalizado["departamentos"];
}

/** Dónde termina lo que se compra: "en cuponeras para jugar…", "en la compra de Iphone en Movigroup". */
const FIN_OBJETO =
  /\s+(?:en|con|pagando|para|todos|los|de (?:lunes|martes|miercoles|miércoles|jueves|viernes|sabados?|sábados?|domingos?))\b|[.,;:(]|$/i;

/**
 * Lo que se compra, para el título: "15% menos en cuponeras en PRAT Pádel" →
 * "en cuponeras"; "24 cuotas sin interés en la compra de Iphone en Movigroup"
 * → "en Iphone". Un "en …" que nombra al comercio, un lugar, los locales o la
 * web no cuenta. Exportada para los tests.
 */
export function objetoDe(texto: string, comercio: string): string | null {
  const c = sinAcentos(comercio);
  for (const m of texto.matchAll(/\ben\s+/gi)) {
    const resto = texto.slice(m.index! + m[0].length);
    const x = resto
      .slice(0, resto.search(FIN_OBJETO))
      .replace(/\s+y$/i, "")
      .trim()
      .replace(/^(?:la\s+)?compras?\s+de\s+/i, "");
    const s = sinAcentos(x);
    if (!x || s.includes(c) || c.includes(s)) continue;
    if (/^(?:el |los |la |las )?locale?s?\b|\bweb\b|online|cuotas|comercios adheridos/.test(s)) continue;
    if (departamentoDeLugar(s)) continue;
    return `en ${x}`;
  }
  return null;
}

function tituloDe(c: Clausula, dias: number[], objeto: string | null): string {
  let valor: string;
  if (c.tipo === "cuotas") {
    const sinQue = /sin inter[eé]s/i.test(c.texto) ? " sin interés" : /sin recargo/i.test(c.texto) ? " sin recargo" : "";
    valor = `${c.hasta ? "Hasta " : ""}${c.cuotas} cuotas${sinQue}`;
  } else if (c.tipo === "2x1") {
    // El schema pide al menos 4 caracteres: "2x1" solo no pasa.
    if (!objeto && dias.length === 0) return "Promoción 2x1";
    valor = "2x1";
  } else {
    valor = `${c.hasta ? "Hasta " : ""}${c.porcentaje}% de descuento`;
  }
  return `${valor}${objeto ? ` ${objeto}` : ""}${diasEnTitulo(dias)}`.slice(0, 160);
}

/**
 * Tramos que solo están en las bases, colgados de un tramo de la descripción
 * con otros días y otras tarjetas: "2X1 en Movie todos los días pagando con
 * tarjetas de débito Volar … y de lunes a miércoles con tarjetas de débito por
 * pago de sueldos (azules) y Cuenta Pocket en la compra de entradas". Cada
 * "y de <día> …" / "y los <día> …" con tarjetas propias es un tramo más.
 */
function tramosDeLasBases(bases: string, lista: Clausula[]): Clausula[] {
  const extra: Clausula[] = [];
  for (const b of clausulas(bases)) {
    if (!lista.some((x) => x.tipo === b.tipo && x.porcentaje === b.porcentaje && x.cuotas === b.cuotas)) continue;
    // sinAcentos no cambia el largo: los cortes valen en el texto original.
    const s = sinAcentos(b.texto);
    const cortes = [...s.matchAll(/\s+y\s+(?=(?:de|los)\s+(?:lunes|martes|miercoles|jueves|viernes|sabados?|domingos?)\b)/g)];
    const marca = b.texto.match(MARCA)?.[0] ?? "";
    for (const [k, corte] of cortes.entries()) {
      const desde = corte.index! + corte[0].length;
      const parte = b.texto.slice(desde, k + 1 < cortes.length ? cortes[k + 1]!.index! : undefined).split(/\.(?=\s|$)/)[0]!.trim();
      if (tarjetasDe(parte).nombres.length === 0 || diasDe(parte).length === 0) continue;
      extra.push({ ...b, texto: `${marca} ${parte}`, oracion: -1 });
    }
  }
  return extra;
}

function normalizarFeed(crudo: Crudo, d: DatosItauFeed): Extraido {
  const comercio = comercioDelFeed(d);
  // Los tramos salen de la descripción; si no tiene ninguna marca, del título.
  // Un porcentaje del título que la descripción no repite ("15% menos y 12
  // cuotas…" con una descripción que solo habla de cuotas) también es un tramo.
  const deDescripcion = clausulas(d.descripcion);
  const delTitulo = clausulas(d.titulo);
  const lista: Clausula[] = deDescripcion.length > 0 ? [...deDescripcion] : delTitulo;
  if (deDescripcion.length > 0) {
    for (const c of delTitulo) {
      const igual = (x: Clausula) => x.tipo === c.tipo && x.porcentaje === c.porcentaje && (c.tipo !== "cuotas" || x.cuotas === c.cuotas);
      if (c.tipo !== "cuotas" && !lista.some(igual)) lista.push({ ...c, oracion: -1 });
    }
  }
  lista.push(...tramosDeLasBases(d.bases, lista));
  if (!comercio || lista.length === 0) {
    // Sin comercio (un rubro, un listado) o sin porcentaje, 2x1 ni cuotas.
    return { crudo, comercio: null, beneficios: [], productos_desconocidos: [], es_beneficio: false };
  }

  const key = slugificar(comercio.nombre);
  const bases = d.bases.trim();
  const todo = [d.descripcion, bases].join("\n");
  // Las fechas de las bases; si no dan ninguna, las de la descripción.
  const deBases = vigenciaDelLegal(bases);
  const vigencia = deBases.desde || deBases.hasta ? deBases : vigenciaDelLegal(d.descripcion);
  // Lo que va antes de la primera marca de cada oración del texto de donde salen los tramos.
  const intro = introducciones(deDescripcion.length > 0 ? d.descripcion : d.titulo);
  const departamentos: BeneficioNormalizado["departamentos"] =
    comercio.departamento ? [comercio.departamento as BeneficioNormalizado["departamentos"][number]] : departamentosDeBases(bases);
  const canal = canalDe(todo);
  // "Cuenta Pocket válida únicamente en compras web": un tramo con la Pocket vale también online.
  const pocketWeb = /pocket valida unicamente en compras web/.test(sinAcentos(todo));
  const acumulable = acumulableDe(todo);
  const topes = topesDelLegal(bases, (f) => tarjetasDe(f).ids);
  // "2x1 en Movie": lo que se lleva lo dicen las bases ("… en la compra de entradas").
  const deLasBases2x1 = clausulas(bases).find((c) => c.tipo === "2x1");
  const objetoDe2x1 = deLasBases2x1 ? objetoDe(deLasBases2x1.texto.split(/\.(?=\s|$)/)[0]!, comercio.nombre) : null;

  // Días y tarjetas de cada cláusula; las que no los dicen los toman de sus
  // vecinas de la misma oración ("20% … martes y jueves y 15% … pagando con
  // tarjetas Platinum": el 20% también es con Platinum).
  const leidas = lista.map((c) => {
    const t = sinAcentos(c.texto);
    return {
      c,
      dias: /todos los dias/.test(t) ? [] : diasDe(c.texto),
      explicitos: /todos los dias/.test(t) || diasDe(c.texto).length > 0,
      tarjetas: tarjetasDe(c.texto),
    };
  });
  const beneficios: BeneficioNormalizado[] = [];
  const desconocidos: string[] = [];
  for (const [i, l] of leidas.entries()) {
    const misma = leidas.filter((x) => x.c.oracion === l.c.oracion && x.c.oracion >= 0);
    const k = misma.indexOf(l);
    let dias = l.dias;
    if (!l.explicitos) dias = misma.slice(0, k).reverse().find((x) => x.explicitos)?.dias ?? [];
    let tarjetas = l.tarjetas;
    if (tarjetas.nombres.length === 0) {
      tarjetas =
        misma.slice(k + 1).find((x) => x.tarjetas.nombres.length > 0)?.tarjetas ??
        misma.slice(0, k).reverse().find((x) => x.tarjetas.nombres.length > 0)?.tarjetas ??
        tarjetasDe(bases);
    }
    desconocidos.push(...tarjetas.desconocidos);
    const ids = tarjetas.nombres.length > 0 ? tarjetas.ids : tarjetasDeListas(d.listas);

    let tope = null;
    if (l.c.tipo === "porcentaje") {
      const r = topeDelTramo(topes, { pct: l.c.porcentaje!, ids });
      tope = r.tope;
      if (r.ambiguo) desconocidos.push(`tramo ${i}: los legales publican varios topes y no se puede saber cuál es el de este tramo`);
    }
    // Las fechas del tramo ("25% menos en Mosca del 9 al 18 de octubre…", "Del
    // 31 de agosto al 12 de setiembre, tenés 15% menos…") mandan sobre las de
    // la página; un tramo que no nombra fechas se queda con las de la página.
    const propia =
      vigenciaDelTramo(l.c.texto, vigencia, crudo.fetched_at) ??
      (l.c.oracion >= 0 ? vigenciaDelTramo(intro.get(l.c.oracion) ?? "", vigencia, crudo.fetched_at) : null);
    const { desde, hasta } = propia ?? vigencia;
    validar(
      candidato({
        comercio_key: key,
        titulo: tituloDe(l.c, dias, objetoDe(l.c.texto, comercio.nombre) ?? (l.c.oracion === -1 ? objetoDe(d.titulo, comercio.nombre) : null) ?? (l.c.tipo === "2x1" ? objetoDe2x1 : null)),
        descuento_raw: l.c.texto.replace(/[\s.,;]+$/, ""),
        porcentaje: l.c.porcentaje,
        cuotas: l.c.cuotas,
        tipo: l.c.tipo,
        dias_semana: dias,
        vigencia_desde: desde,
        vigencia_hasta: sinFechaComodin(hasta),
        departamentos,
        productos_elegibles: ids,
        ...topeDevolucion({
          tipo: l.c.tipo,
          porcentaje: l.c.porcentaje,
          tope_monto: tope?.monto ?? null,
          tope_moneda: tope?.moneda ?? null,
          tope_sobre: tope?.sobre ?? null,
          tope_periodo: tope?.periodo ?? null,
        }),
        canal: canal === "presencial" && pocketWeb && /pocket/i.test(l.c.texto) ? "ambos" : canal,
        acumulable,
        legales_raw: bases || null,
        url_fuente: crudo.url_fuente,
      }),
      i,
      beneficios,
      desconocidos,
    );
  }
  return {
    crudo,
    comercio: beneficios.length > 0 ? { key, nombre: comercio.nombre, categoria: categoriaDe(`${d.titulo} ${d.descripcion}`) } : null,
    beneficios,
    productos_desconocidos: [...new Set(desconocidos)],
  };
}

export function normalizarItau(crudo: Crudo): Extraido {
  if (esLanding(crudo.datos)) return normalizarLanding(crudo, crudo.datos);
  if (esFeed(crudo.datos)) return normalizarFeed(crudo, crudo.datos);
  // Sin los campos estructurados no hay nada confiable que leer. Tirar hace
  // que la página cuente como fallida y sus beneficios sigan publicados.
  throw new Error(`itau: ${crudo.external_id} no trae los datos del feed ni de la landing`);
}
