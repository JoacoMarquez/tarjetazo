import type { BeneficioNormalizado } from "@tarjetazo/core";
import { bajarTexto } from "../http.js";
import { htmlATexto } from "../texto.js";
import { slugificar } from "../slug.js";
import type { Crudo, Extraido } from "../tipos.js";
import { MESES, diasDe, vigenciaDelLegal } from "./legales.js";

/**
 * Club El País (#10). WordPress con una ficha por comercio (`/comercio/<slug>/`)
 * listada en el sitemap. Todas usan la misma plantilla: el descuento grande
 * ("20% dto.", "2x1"), el rubro en la miga de pan, los días como fichas
 * activas (L M M J V S D), la modalidad (Local / Online), una dirección o un
 * link a las sucursales, y los legales en un modal. Se lee sin modelo.
 * Los legales mandan sobre las fichas: días ("los días lunes, martes y
 * miércoles" con todas las fichas marcadas), vigencia ("durante el mes de
 * setiembre de 2026", "del 4 al 8 de agosto") y un segundo tramo en oración
 * propia ("Aplica un 10% de descuento en el resto de los productos …").
 *
 * La tarjeta es de socio (viene con la suscripción al diario): instrumento
 * "membresia", fuera del catálogo público de tarjetas. Los "eventos" del sitio
 * (2x1 en entradas) no se cargan: vencen en días y no tienen un lugar fijo.
 */

const BASE = "https://www.clubelpais.com.uy";
const SITEMAP = `${BASE}/sitemap.xml`;
const PRODUCTO = "club-el-pais-socio";

/** Rubros del club → categorías de Tarjetazo. */
const RUBRO: Record<string, string> = {
  vestimenta: "indumentaria",
  hogar: "hogar-deco",
  turismo: "viajes",
  gastronomia: "restaurantes",
  ninos: "libreria-juguetes",
  bienestar: "salud-belleza",
  educacion: "servicios",
  entretenimiento: "entretenimiento",
};

/** "Niños" y "Bienestar" mezclan ropa, mascotas y clubes: el nombre manda. */
const RUBRO_POR_NOMBRE: [RegExp, string][] = [
  [/\bkids\b|\bgap\b|baby/, "indumentaria"],
  [/papeleria|libreria/, "libreria-juguetes"],
  [/\bvet\b|puntovet|lavakan/, "mascotas"],
  [/racket|club del bosque|futvolt/, "deportes"],
];

const DIAS_FICHA = [1, 2, 3, 4, 5, 6, 0]; // L M M J V S D

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const texto = (html: string) => htmlATexto(html).replace(/\s+/g, " ").trim();

/**
 * El departamento se lee de la dirección. Un nombre de departamento seguido de
 * un número ("Rio Negro 1310", "Soriano 929") o precedido de "Av."/"Br." es una
 * calle de Montevideo; entre varios, gana el último ("Florida 1221, Ciudad de
 * Paysandú").
 */
const DEPARTAMENTOS: [RegExp, string][] = [
  [/montevideo|pocitos|carrasco|punta carretas/g, "montevideo"],
  [/canelones|las piedras|\bpando\b|ciudad de la costa|atlantida|giannattasio|costa urbana|via disegno|horneros/g, "canelones"],
  [/maldonado|punta del este|piriapolis|san carlos|la barra|san rafael|playa brava|playa mansa|roosevelt|gorlero|pedragosa sierra|punta colorada/g, "maldonado"],
  [/colonia/g, "colonia"],
  [/paysandu/g, "paysandu"],
  [/\bsalto\b/g, "salto"],
  [/rivera/g, "rivera"],
  [/rocha|la paloma/g, "rocha"],
  [/tacuarembo/g, "tacuarembo"],
  [/artigas/g, "artigas"],
  [/durazno/g, "durazno"],
  [/\bflores\b|trinidad/g, "flores"],
  [/\bflorida\b/g, "florida"],
  [/lavalleja|\bminas\b/g, "lavalleja"],
  [/soriano|mercedes|dolores/g, "soriano"],
  [/rio negro|fray bentos/g, "rio-negro"],
  [/cerro largo|\bmelo\b/g, "cerro-largo"],
  [/treinta y tres/g, "treinta-y-tres"],
  [/san jose/g, "san-jose"],
];

export function departamentoDeDireccion(direccion: string): string | null {
  const d = sinAcentos(direccion);
  let mejor: { pos: number; depto: string } | null = null;
  for (const [re, depto] of DEPARTAMENTOS) {
    for (const m of d.matchAll(re)) {
      const pos = m.index!;
      const antes = d.slice(0, pos);
      const despues = d.slice(pos + m[0].length);
      if (/^\s*(n°\s*)?\d/.test(despues)) continue;
      if (/\b(av|avda|avenida|br|bv|bulevar|boulevard|rambla|calle)\.?\s+$/.test(antes)) continue;
      if (!mejor || pos > mejor.pos) mejor = { pos, depto };
    }
  }
  if (mejor) return mejor.depto;
  // Una calle y un número sin ciudad son, en este sitio, de Montevideo; en una
  // ruta o un kilómetro no se puede adivinar.
  return /\bruta\b|\bkm\b/.test(d) ? null : "montevideo";
}

/** "Cebollatí 1474, Montevideo | Av. Italia …, Punta del Este": un local por tramo. */
export function departamentosDeDireccion(direccion: string): string[] {
  const deptos = direccion.split(/\s[|\/]\s/).map(departamentoDeDireccion);
  // Si un tramo no se puede ubicar, mejor todo el país que dejarlo afuera.
  if (deptos.includes(null)) return [];
  return [...new Set(deptos as string[])];
}

export function crudoDeFicha(url: string, html: string): Crudo {
  const nombre = texto(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "");
  const promo = texto(html.match(/font-secundary text-4xl[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "");
  const rubro = html.match(/title="Rubro" href="[^"]*\/rubro\/([^/"]+)\/?"/)?.[1] ?? "";

  const fichasDias = html.match(/dias-de-beneficio-ficha[^>]*>([\s\S]*?)<\/div>/)?.[1];
  let dias = "todos los días";
  if (fichasDias) {
    const activas = [...fichasDias.matchAll(/<span class="block( active)?[^"]*">/g)].map((m) => Boolean(m[1]));
    const nums = DIAS_FICHA.filter((_, k) => activas[k]);
    if (nums.length > 0 && nums.length < 7) dias = nums.join(",");
  }

  const modalidad = texto(html.match(/Modalidad<\/h3>\s*<div class="modalidad-compra[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "");
  const lugar = html.match(/class="lugar-comercio[^"]*"[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? "";
  const linkSucursales = lugar.match(/href="([^"]+)"/)?.[1];
  const direccion = linkSucursales ? null : texto(lugar).replace(/[,.\s]+$/, "");
  const telefono = texto(html.match(/class="telefono-comercio[^"]*">([\s\S]*?)<\/span>/)?.[1] ?? "");
  const bajada = texto(html.match(/max-w-xs" itemprop="description">([\s\S]*?)<\/p>/)?.[1] ?? "");
  const descripcion = texto(html.match(/Descripción del beneficio<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? "");
  const legales = htmlATexto(html.match(/class="terminos-comercio[^"]*">([\s\S]*?)<\/div>/)?.[1] ?? "");
  // Última edición de la ficha (JSON-LD de Yoast): de ahí sale el año de las
  // fechas que los legales escriben sin año ("del 4 al 8 de agosto").
  const modificada = html.match(/"dateModified":"(\d{4}-\d{2}-\d{2})/)?.[1];

  const contenido = [
    nombre,
    `Beneficio: ${promo || "sin dato"}`,
    `Rubro según Club El País: ${rubro || "sin rubro"}.`,
    `Días (0 = domingo): ${dias}.`,
    `Modalidad: ${modalidad || "sin dato"}.`,
    ...(modificada ? [`Ficha modificada: ${modificada}.`] : []),
    direccion ? `Dirección: ${direccion}` : linkSucursales ? `Sucursales: ${linkSucursales}` : "Sin dirección.",
    ...(telefono ? [`Teléfono: ${telefono}`] : []),
    ...(bajada ? [bajada] : []),
    ...(descripcion ? [descripcion] : []),
    "Términos y condiciones:",
    legales,
  ].join("\n");

  // Cada tramo de la dirección ("… | …") es un local; sin departamento no se
  // puede guardar (el runner lo geocodifica y lo valida).
  const direcciones = (direccion ?? "")
    .split(/\s[|\/]\s/)
    .map((d) => ({ direccion: d.trim(), departamento: departamentoDeDireccion(d) }))
    .filter((d): d is { direccion: string; departamento: string } => Boolean(d.direccion && d.departamento));

  return {
    fuente_id: "club-el-pais",
    external_id: slugificar(new URL(url).pathname.replace(/^\/comercio\//, "").replace(/\/$/, "")),
    url_fuente: url,
    contenido,
    fetched_at: new Date().toISOString(),
    direcciones,
  };
}

export async function fetchClubElPais(): Promise<Crudo[]> {
  const sitemap = await bajarTexto(SITEMAP);
  const urls = [...new Set([...sitemap.matchAll(/<loc>([^<]*\/comercio\/[^<]+)<\/loc>/g)].map((m) => m[1]!.trim()))];
  const limite = Number(process.env.SCRAPER_LIMITE) || Infinity;
  const crudos: Crudo[] = [];
  for (const url of urls.slice(0, limite)) {
    try {
      crudos.push(crudoDeFicha(url, await bajarTexto(url)));
    } catch (e) {
      console.error(`  club-el-pais ${url}: ${String(e).slice(0, 120)}`);
    }
  }
  return crudos;
}

type Vigencia = { desde: string | null; hasta: string | null };

const MES = "(enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre)";
const ANIO = "(?:\\s+(?:de\\s+|del\\s+)?(\\d{4}))?";

const fechaIso = (anio: number, mes: number, dia: number) =>
  `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
const ultimoDia = (anio: number, mes: number) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();

/**
 * Año de una fecha escrita sin año: el más reciente en que la promo ya empezó
 * o empieza dentro de los tres meses siguientes a la última edición de la
 * ficha. Editada en setiembre, "del 4 al 8 de agosto" es de ese año (vencida);
 * editada en diciembre, "del 2 al 10 de enero" es del año que viene.
 */
export function anioImplicito(mes: number, dia: number, referencia: string): number {
  const ref = new Date(`${referencia.slice(0, 10)}T00:00:00Z`);
  const tope = ref.getTime() + 92 * 86_400_000;
  let anio = ref.getUTCFullYear() + 1;
  while (Date.UTC(anio, mes - 1, dia) > tope) anio--;
  return anio;
}

/**
 * Vigencia escrita en una oración de los legales. Además de lo que lee
 * `vigenciaDelLegal` (fechas con año), las formas de Club El País:
 * - "durante el mes de setiembre de 2026" → el mes entero;
 * - "del 4 al 8 de agosto", "del 28 de julio al 3 de agosto";
 * - "hasta el 15 de octubre".
 * Sin año, el de `anioImplicito`. Un año imposible ("Vigencia … a 3022") es un
 * comodín de "sin fecha": null.
 */
export function vigenciaDeOracion(oracion: string, referencia: string): Vigencia {
  const t = sinAcentos(oracion).replace(/°|º/g, "").replace(/\s+/g, " ");
  const nada = { desde: null, hasta: null };
  if (/\b(2[1-9]\d\d|[3-9]\d{3})\b/.test(t)) return nada;
  const conAnio = vigenciaDelLegal(t);
  if (conAnio.desde || conAnio.hasta) return conAnio;
  // "válido desde el 18/08/2026 hasta el 25/08/2026 23:59" lo lee vigenciaDelLegal; "hasta el 25/08/26" solo, acá.
  const hastaNum = t.match(/hasta el (\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (hastaNum) {
    const a = Number(hastaNum[3]!.length === 2 ? `20${hastaNum[3]}` : hastaNum[3]);
    return { desde: null, hasta: fechaIso(a, Number(hastaNum[2]), Number(hastaNum[1])) };
  }

  const mesEntero = t.match(new RegExp(`\\b(?:durante|en) (?:todo )?el mes de ${MES}${ANIO}`));
  if (mesEntero) {
    const m = MESES[mesEntero[1]!]!;
    const a = mesEntero[2] ? Number(mesEntero[2]) : anioImplicito(m, 1, referencia);
    return { desde: fechaIso(a, m, 1), hasta: fechaIso(a, m, ultimoDia(a, m)) };
  }
  // "del 28 de julio al 3 de agosto"
  const dosMeses = t.match(new RegExp(`\\bdel (\\d{1,2}) de ${MES} al? (\\d{1,2}) de ${MES}${ANIO}`));
  // "del 4 al 8 de agosto"
  const unMes = t.match(new RegExp(`\\bdel (\\d{1,2}) al? (\\d{1,2}) de ${MES}${ANIO}`));
  const rango = dosMeses
    ? { d1: +dosMeses[1]!, m1: MESES[dosMeses[2]!]!, d2: +dosMeses[3]!, m2: MESES[dosMeses[4]!]!, anio: dosMeses[5] }
    : unMes
      ? { d1: +unMes[1]!, m1: MESES[unMes[3]!]!, d2: +unMes[2]!, m2: MESES[unMes[3]!]!, anio: unMes[4] }
      : null;
  if (rango) {
    const cruza = rango.m1 > rango.m2; // "del 28 de diciembre al 3 de enero"
    const a1 = rango.anio ? Number(rango.anio) - (cruza ? 1 : 0) : anioImplicito(rango.m1, rango.d1, referencia);
    const a2 = a1 + (cruza ? 1 : 0);
    return { desde: fechaIso(a1, rango.m1, rango.d1), hasta: fechaIso(a2, rango.m2, rango.d2) };
  }
  const hasta = t.match(new RegExp(`\\bhasta el (\\d{1,2}) de ${MES}${ANIO}`));
  if (hasta) {
    const m = MESES[hasta[2]!]!;
    const d = Number(hasta[1]);
    const a = hasta[3] ? Number(hasta[3]) : anioImplicito(m, d, referencia);
    return { desde: null, hasta: fechaIso(a, m, d) };
  }
  return nada;
}

/** "+ 15% con tarjetas Santander": la promo de un banco que se suma, no la del club. */
const DE_OTRA_TARJETA =
  /\b(santander|scotia(bank)?|itau|brou|bbva|hsbc|heritage|oca|visa|master(card)?|prex|midinero|creditel|cabal|amex|american express|diners|banco)\b/;

/** Oraciones de los legales: un punto seguido de espacio. */
const oraciones = (legales: string) =>
  legales.replace(/\s+/g, " ").split(/(?<=\.)\s+/).map((o) => o.trim()).filter(Boolean);

/** Oración que fija las condiciones del beneficio del club: de ahí salen los días. */
const ES_CONDICION = /^(dicho |el )?beneficios? (del \d|aplicables?|valido|sera)|^aplicable|^valido/;

/**
 * Días que nombran las oraciones de condición ("… para las formas de pago
 * contado y con tarjeta los días lunes, martes y miércoles."). Vacío si no
 * nombran ninguno: quedan los de la ficha.
 */
function diasDeOraciones(os: string[]): number[] {
  for (const o of os) {
    const t = sinAcentos(o);
    if (!ES_CONDICION.test(t) || /\bno (aplica|es valido|valido)\b/.test(t)) continue;
    const dias = diasDe(t);
    if (dias.length > 0) return dias.sort((a, b) => a - b);
  }
  return [];
}

/** La primera vigencia que nombren las oraciones. */
function vigenciaDeOraciones(os: string[], referencia: string): Vigencia {
  for (const o of os) {
    const v = vigenciaDeOracion(o, referencia);
    if (v.desde || v.hasta) return v;
  }
  return { desde: null, hasta: null };
}

/**
 * Un segundo tramo escrito como oración propia:
 * - "Aplica un 10% de descuento en el resto de los productos los días lunes,
 *   martes y miércoles." (IBER: el 30% de la ficha es solo en vinos);
 * - "En Punta del Este beneficio aplicable los días viernes, sábado y domingo."
 *   (Amadeus: el mismo descuento, otros días en ese local).
 */
interface TramoExtra {
  porcentaje: number | null;
  oracion: string;
  lugar: string | null;
}

function tramoExtra(oracion: string, porcentaje: number | null): TramoExtra | null {
  const t = sinAcentos(oracion);
  const otro = t.match(/^aplica (?:un|el) (\d{1,2}) ?% de descuento\b/);
  if (otro && Number(otro[1]) !== porcentaje) return { porcentaje: Number(otro[1]), oracion, lugar: null };
  const enLugar = oracion.match(/^En (.+?),? (?:el )?beneficio aplicable\b/i);
  if (enLugar && diasDe(t.slice(enLugar[0].length)).length > 0) return { porcentaje, oracion, lugar: enLugar[1]! };
  return null;
}

/** "tope de $ 2.000 por compra". Ninguna ficha lo trae hoy; por si aparece. */
function tope(legales: string): { monto: number; periodo: BeneficioNormalizado["tope_periodo"] } | null {
  const t = sinAcentos(legales);
  const m = t.match(/tope[^$]{0,40}\$\s*(\d{1,3}(?:[.,]\d{3})+|\d+)(?:[^.\n]{0,30}?por (mes|dia|compra|semana))?/);
  if (!m) return null;
  const periodo = ({ mes: "mes", dia: "dia", compra: "compra", semana: "semana" } as const)[m[2] as "mes"] ?? "compra";
  return { monto: Number(m[1]!.replace(/[.,]/g, "")), periodo };
}

export function normalizarClubElPais(crudo: Crudo): Extraido {
  const lineas = crudo.contenido.split("\n");
  const nombre = lineas[0]?.trim() ?? "";
  const promo = crudo.contenido.match(/^Beneficio: (.*)$/m)?.[1] ?? "";
  const rubro = crudo.contenido.match(/^Rubro según Club El País: ([^.]*)\.$/m)?.[1] ?? "";
  const diasTxt = crudo.contenido.match(/^Días \(0 = domingo\): (.*)\.$/m)?.[1] ?? "";
  const modalidad = sinAcentos(crudo.contenido.match(/^Modalidad: (.*)\.$/m)?.[1] ?? "");
  const direccion = crudo.contenido.match(/^Dirección: (.*)$/m)?.[1] ?? null;
  const iLegales = lineas.indexOf("Términos y condiciones:");
  const legales = lineas.slice(iLegales + 1).join("\n").trim();

  const categoria =
    RUBRO_POR_NOMBRE.find(([re]) => re.test(sinAcentos(nombre)))?.[1] ?? RUBRO[rubro] ?? "otros";
  const comercio = nombre ? { key: slugificar(nombre), nombre, categoria } : null;

  const p = sinAcentos(promo);
  const pct = p.match(/(\d{1,2})\s*%/);
  const dosPorUno = /2\s*x\s*1/.test(p);
  if (!comercio || (!pct && !dosPorUno)) {
    return { crudo, comercio, beneficios: [], productos_desconocidos: [], es_beneficio: true };
  }

  const local = /local/.test(modalidad);
  const online = /online/.test(modalidad);
  const canal: BeneficioNormalizado["canal"] = local && online ? "ambos" : online ? "online" : "presencial";
  const l = sinAcentos(legales);
  const acumulable = /no (es |siendo )?acumulable|ni se acumula|no se acumula/.test(l) ? false : /acumulable con otras/.test(l) ? true : null;
  const t = tope(legales);
  // Sin la fecha de edición (páginas guardadas antes de leerla), la de la descarga.
  const referencia = crudo.contenido.match(/^Ficha modificada: (\d{4}-\d{2}-\d{2})\.$/m)?.[1] ?? crudo.fetched_at;

  // Las promos de bancos que se suman ("Del 10 al 16 de setiembre 20% off + 25%
  // adicional pagando con Santander") no son condiciones del club: ni sus
  // fechas ni sus días.
  const os = oraciones(legales).filter((o) => !DE_OTRA_TARJETA.test(sinAcentos(o)));
  const porcentaje = pct ? Number(pct[1]) : null;
  const extras: TramoExtra[] = [];
  const propias: string[] = [];
  for (const o of os) {
    const extra = tramoExtra(o, porcentaje);
    if (extra) extras.push(extra);
    else propias.push(o);
  }

  // Los días de las condiciones mandan sobre las fichas L M M J V S D (Under
  // Armour tiene todas marcadas y el legal dice lunes a miércoles).
  const diasFicha = diasTxt && diasTxt !== "todos los días" ? diasTxt.split(",").map(Number) : [];
  const diasLegal = diasDeOraciones(propias);
  const v = vigenciaDeOraciones(propias, referencia);

  const base = {
    comercio_key: comercio.key,
    // El esquema pide 4 letras: "2x1" solo no alcanza.
    titulo: pct ? `${pct[1]}% de descuento` : "2x1 para socios",
    descuento_raw: promo,
    porcentaje,
    cuotas: null,
    tipo: pct ? "porcentaje" : "2x1",
    dias_semana: diasLegal.length > 0 ? diasLegal : diasFicha,
    vigencia_desde: v.desde,
    vigencia_hasta: v.hasta,
    departamentos: direccion ? departamentosDeDireccion(direccion) : [],
    productos_elegibles: [PRODUCTO],
    tope_monto: t?.monto ?? null,
    tope_periodo: t?.periodo ?? null,
    tope_moneda: "UYU",
    canal,
    mecanica: [],
    acumulable,
    compra_minima: null,
    requiere_activacion: false,
    legales_raw: legales || null,
    como_usarlo: ["Mostrá la tarjeta de socio y tu documento al pagar."],
    url_fuente: crudo.url_fuente,
  } as BeneficioNormalizado;

  const beneficios = [base];
  for (const e of extras) {
    const ve = vigenciaDeOracion(e.oracion, referencia);
    const depto = e.lugar ? departamentoDeDireccion(e.lugar) : null;
    beneficios.push({
      ...base,
      ...(e.porcentaje !== porcentaje && e.porcentaje !== null
        ? { titulo: `${e.porcentaje}% de descuento`, descuento_raw: `${e.porcentaje}% dto.`, porcentaje: e.porcentaje, tipo: "porcentaje" }
        : {}),
      dias_semana: diasDe(e.oracion).sort((a, b) => a - b),
      vigencia_desde: ve.desde,
      vigencia_hasta: ve.hasta,
      ...(depto ? { departamentos: [depto], canal: "presencial" } : {}),
    } as BeneficioNormalizado);
  }

  return { crudo, comercio, beneficios, productos_desconocidos: [], es_beneficio: true };
}
