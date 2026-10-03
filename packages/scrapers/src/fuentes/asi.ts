import type { BeneficioNormalizado } from "@tarjetazo/core";
import { bajarTexto } from "../http.js";
import { slugificar } from "../slug.js";
import type { Crudo, Extraido, SucursalDeFuente } from "../tipos.js";
import { clausulas, diasDe, diasEnTitulo } from "./legales.js";

/**
 * Club ASI (#10). El club de descuentos de ASI (financiera, tarjeta ASI
 * Mastercard) corre sobre Mashkady, una plataforma que comparte los mismos
 * descuentos entre varios clubes (ASI, CINTEPA, COPAC). La web es una app de
 * Next.js que pide todo a una API JSON pública: título, porcentaje, rubros,
 * texto y cada local con coordenadas. Se lee sin modelo.
 *
 * El descuento se pide con un código del club (entrás con la cédula), no
 * pagando con una tarjeta: el producto es una membresía, como Club El País.
 * Los locales del Shopping Tres Cruces que publica el club piden la "Tarjeta
 * Sonrisas" del shopping, no ser cliente de ASI: no se cargan.
 */

const API = "https://api-fenix.servicios-ya.com/api/v3/mashkady/discounts";
const COMPANY_ASI = "66d9d09d6a5127533d1e6586";
const WEB = "https://www.asi-clubdescuentos.com.uy";
const PRODUCTO = "club-asi";

export interface DescuentoMashkady {
  _id: string;
  title: string;
  percentage: string;
  tags?: { name: string }[];
  shortDescription?: string;
  code?: string | null;
  usageLimit?: string | null;
  expirationDate?: string | null;
  selectedAddresses?: { title?: string; description?: string; department?: string; lat?: string; lng?: string }[];
}

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Los de Tres Cruces se piden con la tarjeta del shopping, no con el club. */
export function esDeOtroPrograma(d: DescuentoMashkady): boolean {
  return /tarjeta sonrisas/i.test(d.shortDescription ?? "") || (d.tags ?? []).some((t) => /tres cruces/i.test(t.name));
}

export function crudoDeDescuento(d: DescuentoMashkady): Crudo {
  const sucursales: SucursalDeFuente[] = [];
  const deptos = new Set<string>();
  for (const a of d.selectedAddresses ?? []) {
    if (a.department) deptos.add(slugificar(a.department));
    const lat = Number(a.lat);
    const lng = Number(a.lng);
    if (!a.description || !(lat < -30 && lat > -35.2 && lng < -53 && lng > -58.6)) continue;
    sucursales.push({ nombre: a.title?.trim() || null, direccion: a.description.trim(), lat, lng });
  }
  const contenido = [
    d.title.trim(),
    `Beneficio: ${d.percentage}`,
    `Rubros según el club: ${(d.tags ?? []).map((t) => t.name).join(", ") || "sin rubro"}.`,
    `Departamentos según el club: ${[...deptos].sort().join(", ") || "sin dato"}.`,
    `Vence: ${d.expirationDate?.slice(0, 10) ?? "sin fecha"}.`,
    `Uso: ${d.usageLimit ?? "sin dato"}.`,
    ...(d.code ? [`Código: ${d.code}`] : []),
    ...(sucursales.length > 0 ? ["Locales:", ...sucursales.map((s) => `- ${s.nombre ?? d.title}: ${s.direccion}`)] : []),
    "Detalle:",
    (d.shortDescription ?? "").trim(),
  ].join("\n");
  return {
    // El título solo no alcanza: "Pedidos Ya" y "Delishop" tienen dos descuentos.
    fuente_id: "asi",
    external_id: `${slugificar(d.title)}-${d._id.slice(-6)}`,
    url_fuente: `${WEB}/discounts/${d._id}`,
    contenido,
    fetched_at: new Date().toISOString(),
    sucursales,
  };
}

export async function fetchAsi(): Promise<Crudo[]> {
  // Sin el header `countrycode` la API contesta 401.
  const json = await bajarTexto(`${API}?companyId=${COMPANY_ASI}&limit=1000`, 3, { headers: { countrycode: "UY" } });
  const { docs } = JSON.parse(json) as { docs: DescuentoMashkady[] };
  const limite = Number(process.env.SCRAPER_LIMITE) || Infinity;
  return docs.filter((d) => !esDeOtroPrograma(d)).map(crudoDeDescuento).slice(0, limite);
}

/** Rubros del club → categorías de Tarjetazo. */
const RUBRO: Record<string, string> = {
  moda: "indumentaria",
  hogar: "hogar-deco",
  gastronomia: "restaurantes",
  farmacias: "farmacias",
  hoteleria: "viajes",
  opticas: "salud-belleza",
  deporte: "deportes",
  entrenamiento: "deportes",
  papeleria: "libreria-juguetes",
  tecnologia: "electro-tecnologia",
  salud: "salud-belleza",
  bienestar: "salud-belleza",
  entretenimiento: "entretenimiento",
  vehicular: "servicios",
  plataformas: "servicios",
};

const DIAS: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };

/** "de lunes a jueves", "válido los martes": si no lo dice, todos los días. */
function dias(t: string): number[] {
  const rango = t.match(/(?:valido|aplica|vigente)[^.\n]{0,30}?de (lunes|martes|miercoles|jueves|viernes|sabado|domingo) a (lunes|martes|miercoles|jueves|viernes|sabado|domingo)/);
  if (rango) {
    const out: number[] = [];
    for (let d = DIAS[rango[1]!]!; ; d = (d + 1) % 7) {
      out.push(d);
      if (d === DIAS[rango[2]!]) break;
    }
    return out.sort();
  }
  const sueltos = t.match(/(?:valido|aplica)(?: solo| unicamente)? (?:los )?((?:(?:lunes|martes|miercoles|jueves|viernes|sabados?|domingos?)(?:,| y )?\s*)+)/);
  if (!sueltos) return [];
  return [...new Set([...sueltos[1]!.matchAll(/(lunes|martes|miercoles|jueves|viernes|sabado|domingo)/g)].map((m) => DIAS[m[1]!]!))].sort();
}

export interface TramoAsi {
  porcentaje: number;
  /** Vacío = todos los días. */
  dias: number[];
}

/**
 * Porcentajes que el texto ata a unos días, en la misma oración: "10% de
 * descuento en alojamiento los viernes, sábados y domingos, y 5% de descuento
 * de lunes a jueves", "15% OFF los días martes y 10% OFF todos los días". Los
 * días tienen que venir después del porcentaje y antes del punto: así un
 * horario de atención en otra línea ("Lunes a viernes: 9:00 a 19:00") no
 * cuenta. Exportada para los tests.
 */
export function tramosPorDia(t: string): TramoAsi[] {
  const out = new Map<string, TramoAsi>();
  for (const oracion of t.split(/[.!?\n]+/)) {
    for (const c of clausulas(oracion)) {
      if (c.tipo !== "porcentaje" || c.hasta || c.porcentaje === null) continue;
      if (!/todos los dias|\b(lunes|martes|miercoles|jueves|viernes|sabados?|domingos?)\b/.test(c.texto)) continue;
      const dias = diasDe(c.texto).sort();
      out.set(`${c.porcentaje}|${dias.join(",")}`, { porcentaje: c.porcentaje, dias });
    }
  }
  return [...out.values()];
}

export function normalizarAsi(crudo: Crudo): Extraido {
  const lineas = crudo.contenido.split("\n");
  const titulo = lineas[0]?.trim() ?? "";
  const promo = crudo.contenido.match(/^Beneficio: (.*)$/m)?.[1] ?? "";
  const rubros = crudo.contenido.match(/^Rubros según el club: ([^.]*)\.$/m)?.[1]?.split(", ") ?? [];
  const deptos = crudo.contenido.match(/^Departamentos según el club: ([^.]*)\.$/m)?.[1];
  const vence = crudo.contenido.match(/^Vence: (\d{4}-\d{2}-\d{2})\.$/m)?.[1] ?? null;
  const uso = crudo.contenido.match(/^Uso: ([^.]*)\.$/m)?.[1];
  const codigo = crudo.contenido.match(/^Código: (.*)$/m)?.[1];
  const detalle = lineas.slice(lineas.indexOf("Detalle:") + 1).join("\n").trim();
  const t = sinAcentos(detalle);

  const categoria =
    (/pedidos ?ya|rappi|delivery/.test(sinAcentos(titulo)) ? "delivery" : null) ??
    rubros.map((r) => RUBRO[sinAcentos(r)]).find(Boolean) ??
    "otros";
  const comercio = titulo ? { key: slugificar(titulo), nombre: titulo, categoria } : null;

  const pct = promo.match(/^(\d{1,2})\s*%$/);
  const dosPorUno = /^2\s*x\s*1$/i.test(promo.trim());
  // "Voucher", "3x2", "Matrícula": beneficios, pero no un porcentaje comparable.
  if (!comercio || (!pct && !dosPorUno)) {
    return { crudo, comercio, beneficios: [], productos_desconocidos: [], es_beneficio: true };
  }

  const tieneLocales = (crudo.sucursales ?? []).length > 0;
  const web = /\bweb\b|online|tienda virtual|e-?commerce|en la app|codigo del cupon|al finalizar tu compra/.test(t);
  const soloWeb = /exclusivamente[^.]{0,40}web|no aplica en locales|solo (en la )?web|unicamente[^.]{0,30}web/.test(t);
  // Sin locales es un descuento online (PedidosYa, cursos, plataformas).
  // PedidosYa o una suscripción traen la dirección de una oficina: son online igual.
  const plataforma = categoria === "delivery" || rubros.some((r) => sinAcentos(r) === "plataformas");
  const canal: BeneficioNormalizado["canal"] = !tieneLocales || soloWeb || plataforma ? "online" : web ? "ambos" : "presencial";

  const listaDeptos = deptos && deptos !== "sin dato" ? deptos.split(", ") : [];

  // "10% viernes a domingo y 5% de lunes a jueves": un beneficio por tramo,
  // primero el del porcentaje que publica el club. Solo si el texto nombra
  // ese porcentaje: si no, no se sabe a qué días va.
  const pctClub = pct ? Number(pct[1]) : null;
  const deDias = pctClub === null ? [] : tramosPorDia(t);
  const delClub = deDias.filter((x) => x.porcentaje === pctClub);
  const tramos: (TramoAsi & { conDias: boolean })[] =
    delClub.length === 1 && deDias.length > 1
      ? [...delClub, ...deDias.filter((x) => x.porcentaje !== pctClub)].map((x) => ({ ...x, conDias: true }))
      : delClub.length === 1 && delClub[0]!.dias.length > 0 && dias(t).length === 0
        ? [{ ...delClub[0]!, conDias: true }]
        : [{ porcentaje: pctClub ?? 0, dias: dias(t), conDias: false }];

  const beneficios = tramos.map((tr) => {
    const enDias = tr.conDias ? diasEnTitulo([...tr.dias].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))) : "";
    return {
      comercio_key: comercio.key,
      titulo: pct ? `${tr.porcentaje}% de descuento${enDias}` : "2x1 con el Club ASI",
      descuento_raw: tr.conDias ? `${tr.porcentaje}%${enDias}` : promo,
      porcentaje: pct ? tr.porcentaje : null,
      cuotas: null,
      tipo: pct ? "porcentaje" : "2x1",
      dias_semana: tr.dias,
      vigencia_desde: null,
      vigencia_hasta: vence,
      // Los 19 = todo el país.
      departamentos: listaDeptos.length >= 19 ? [] : listaDeptos,
      productos_elegibles: [PRODUCTO],
      tope_monto: null,
      tope_periodo: null,
      tope_moneda: "UYU",
      canal,
      mecanica: [],
      acumulable: /no (es )?acumulable/.test(t) ? false : null,
      compra_minima: null,
      requiere_activacion: true,
      legales_raw: detalle || null,
      como_usarlo: [
        "Entrá al Club ASI con tu cédula y pedí el código del descuento.",
        ...(codigo && !/^\s*$/.test(codigo) ? [`Código: ${codigo}`] : []),
        ...(uso === "monthly" ? ["Se puede usar una vez por mes."] : uso === "daily" ? ["Se puede usar una vez por día."] : []),
      ],
      url_fuente: crudo.url_fuente,
    } as BeneficioNormalizado;
  });

  return { crudo, comercio, beneficios, productos_desconocidos: [], es_beneficio: true };
}
