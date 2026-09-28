import { BeneficioNormalizadoSchema, Departamento, type BeneficioNormalizado } from "@tarjetazo/core";
import { mapearProductos, sinFechaComodin, topeDevolucion } from "../normalizador.js";
import { departamentoDeLugar, departamentos as departamentosQueNombra } from "../geo/lugares.js";
import { slugificar } from "../slug.js";
import type { Crudo, Extraido } from "../tipos.js";
import type { DatosItauFeed } from "./itau.js";
import type { DatosItauLanding } from "./itau-landings.js";
import { diasDe, sinAcentos, topeDelTramo, topesDelLegal, vigenciaDelLegal } from "./legales.js";

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
    const tarjetas = tarjetasDe(t.encabezado.slice(m.index! + m[0].length));
    desconocidos.push(...tarjetas.desconocidos);
    const vigencia = vigenciaDeLanding(t.condiciones, t.ubicaciones);
    if (vigencia.ambigua) desconocidos.push(`tramo ${i}: las condiciones dan fechas distintas para ${t.ubicaciones.join(", ")}`);
    const topes = topesDelLegal(t.condiciones, (f) => tarjetasDe(f).ids);
    const r = topeDelTramo(topes, { pct: porcentaje, ids: tarjetas.ids });
    if (r.ambiguo) desconocidos.push(`tramo ${i}: los legales publican varios topes y no se puede saber cuál es el de este tramo`);
    validar(
      candidato({
        comercio_key: key,
        titulo: `${m[1] ? "Hasta " : ""}${porcentaje}% de descuento`,
        descuento_raw: `${t.encabezado} En: ${t.ubicaciones.join(", ")}.`,
        porcentaje,
        cuotas: null,
        tipo: "porcentaje",
        dias_semana: diasDe(t.encabezado),
        vigencia_desde: vigencia.desde,
        vigencia_hasta: sinFechaComodin(vigencia.hasta),
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

/** Marcas de un tramo: un porcentaje, un 2x1 o unas cuotas. */
const MARCA = /(?:hasta\s+)?\d{1,2}\s*%|\b2\s*x\s*1\b|\b\d{1,2}(?:\s*(?:y|o|,)\s*\d{1,2})*\s+cuotas\b/gi;

interface Clausula {
  tipo: BeneficioNormalizado["tipo"];
  porcentaje: number | null;
  cuotas: number | null;
  hasta: boolean;
  texto: string;
  /** Oración del texto (las cláusulas de una misma oración comparten días y tarjetas). */
  oracion: number;
}

/**
 * Parte un texto en cláusulas, una por marca: "20% menos … los días martes y
 * jueves y 15% menos todos los días pagando con tarjetas Platinum" → dos.
 * Exportada para los tests.
 */
export function clausulas(texto: string): Clausula[] {
  const t = texto.replace(/\s+/g, " ").trim();
  const marcas = [...t.matchAll(MARCA)];
  // Fin de oración: un punto seguido de espacio o pegado a la próxima marca ("Black).15% menos").
  const finales = [...t.matchAll(/\.(?=\s|\d|$)/g)].map((m) => m.index!);
  return marcas.map((m, k) => {
    const desde = m.index!;
    const hasta = k + 1 < marcas.length ? marcas[k + 1]!.index! : t.length;
    const pedazo = t.slice(desde, hasta).replace(/\s+y\s*$/, "").trim();
    const marca = sinAcentos(m[0]);
    const oracion = finales.filter((f) => f < desde).length;
    if (/cuotas/.test(marca)) {
      const nums = marca.match(/\d{1,2}/g)!.map(Number);
      return { tipo: "cuotas" as const, porcentaje: null, cuotas: Math.max(...nums), hasta: nums.length > 1, texto: pedazo, oracion };
    }
    if (/2\s*x\s*1/.test(marca)) return { tipo: "2x1" as const, porcentaje: null, cuotas: null, hasta: false, texto: pedazo, oracion };
    return { tipo: "porcentaje" as const, porcentaje: Number(marca.match(/\d{1,2}/)![0]), cuotas: null, hasta: /hasta/.test(marca), texto: pedazo, oracion };
  });
}

/** "… solo para compras en el locales de Montevideo y Maldonado" → esos departamentos. */
function departamentosDeBases(bases: string): BeneficioNormalizado["departamentos"] {
  const m = sinAcentos(bases).match(/(?:solo|unicamente) (?:para compras )?en (?:el |los )?locales? de ([a-z ,]+?)(?:\.|$| no | para )/);
  if (!m) return [];
  return departamentosQueNombra(m[1]!) as BeneficioNormalizado["departamentos"];
}

function tituloDe(c: Clausula): string {
  if (c.tipo === "cuotas") {
    const sinQue = /sin inter[eé]s/i.test(c.texto) ? " sin interés" : /sin recargo/i.test(c.texto) ? " sin recargo" : "";
    return `${c.hasta ? "Hasta " : ""}${c.cuotas} cuotas${sinQue}`;
  }
  // "2x1 en helados de kilo y cucuruchos grandes": lo que se lleva, sin las tarjetas.
  if (c.tipo === "2x1") {
    const que = c.texto.replace(/^2\s*x\s*1\s*/i, "").split(/\s+(?:con|pagando|todos los d[ií]as)\b|[.,]/i)[0]!.trim();
    return que ? `2x1 ${que}`.slice(0, 120) : "2x1 en entradas o productos";
  }
  return `${c.hasta ? "Hasta " : ""}${c.porcentaje}% de descuento`;
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
  const departamentos: BeneficioNormalizado["departamentos"] =
    comercio.departamento ? [comercio.departamento as BeneficioNormalizado["departamentos"][number]] : departamentosDeBases(bases);
  const canal = canalDe(todo);
  const acumulable = acumulableDe(todo);
  const topes = topesDelLegal(bases, (f) => tarjetasDe(f).ids);

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
    validar(
      candidato({
        comercio_key: key,
        titulo: tituloDe(l.c),
        descuento_raw: l.c.texto.replace(/[\s.,;]+$/, ""),
        porcentaje: l.c.porcentaje,
        cuotas: l.c.cuotas,
        tipo: l.c.tipo,
        dias_semana: dias,
        vigencia_desde: vigencia.desde,
        vigencia_hasta: sinFechaComodin(vigencia.hasta),
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
        canal,
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
