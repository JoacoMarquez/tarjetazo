import type { BeneficioNormalizado } from "@tarjetazo/core";
import { bajarTexto } from "../http.js";
import { htmlATexto } from "../texto.js";
import { slugificar } from "../slug.js";
import type { Crudo, Extraido } from "../tipos.js";

/**
 * Club El País (#10). WordPress con una ficha por comercio (`/comercio/<slug>/`)
 * listada en el sitemap. Todas usan la misma plantilla: el descuento grande
 * ("20% dto.", "2x1"), el rubro en la miga de pan, los días como fichas
 * activas (L M M J V S D), la modalidad (Local / Online), una dirección o un
 * link a las sucursales, y los legales en un modal. Se lee sin modelo.
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

  const contenido = [
    nombre,
    `Beneficio: ${promo || "sin dato"}`,
    `Rubro según Club El País: ${rubro || "sin rubro"}.`,
    `Días (0 = domingo): ${dias}.`,
    `Modalidad: ${modalidad || "sin dato"}.`,
    direccion ? `Dirección: ${direccion}` : linkSucursales ? `Sucursales: ${linkSucursales}` : "Sin dirección.",
    ...(telefono ? [`Teléfono: ${telefono}`] : []),
    ...(bajada ? [bajada] : []),
    ...(descripcion ? [descripcion] : []),
    "Términos y condiciones:",
    legales,
  ].join("\n");

  return {
    fuente_id: "club-el-pais",
    external_id: slugificar(new URL(url).pathname.replace(/^\/comercio\//, "").replace(/\/$/, "")),
    url_fuente: url,
    contenido,
    fetched_at: new Date().toISOString(),
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

/** "válido desde el 18/08/2026 hasta el 25/08/2026". */
function vigencia(legales: string): { desde: string | null; hasta: string | null } {
  const fecha = (m: RegExpMatchArray | null) => {
    if (!m) return null;
    const anio = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
    return `${anio}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  };
  const t = sinAcentos(legales);
  return {
    desde: fecha(t.match(/desde el (\d{1,2})\/(\d{1,2})\/(\d{2,4})/)),
    hasta: fecha(t.match(/hasta el (\d{1,2})\/(\d{1,2})\/(\d{2,4})/)),
  };
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
  const depto = direccion ? departamentoDeDireccion(direccion) : null;
  const l = sinAcentos(legales);
  const acumulable = /no (es |siendo )?acumulable|ni se acumula|no se acumula/.test(l) ? false : /acumulable con otras/.test(l) ? true : null;
  const v = vigencia(legales);
  const t = tope(legales);

  const beneficio = {
    comercio_key: comercio.key,
    // El esquema pide 4 letras: "2x1" solo no alcanza.
    titulo: pct ? `${pct[1]}% de descuento` : "2x1 para socios",
    descuento_raw: promo,
    porcentaje: pct ? Number(pct[1]) : null,
    cuotas: null,
    tipo: pct ? "porcentaje" : "2x1",
    dias_semana: diasTxt && diasTxt !== "todos los días" ? diasTxt.split(",").map(Number) : [],
    vigencia_desde: v.desde,
    vigencia_hasta: v.hasta,
    departamentos: depto ? [depto] : [],
    productos_elegibles: [PRODUCTO],
    tope_monto: t?.monto ?? null,
    tope_periodo: t?.periodo ?? null,
    canal,
    mecanica: [],
    acumulable,
    compra_minima: null,
    requiere_activacion: false,
    legales_raw: legales || null,
    como_usarlo: ["Mostrá la tarjeta de socio y tu documento al pagar."],
    url_fuente: crudo.url_fuente,
  } as BeneficioNormalizado;

  return { crudo, comercio, beneficios: [beneficio], productos_desconocidos: [], es_beneficio: true };
}
