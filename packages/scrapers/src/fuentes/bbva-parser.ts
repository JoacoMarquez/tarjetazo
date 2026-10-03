import type { BeneficioNormalizado, Moneda, TopePeriodo } from "@tarjetazo/core";
import type { Crudo, Extraido } from "../tipos.js";
import { slugificar } from "../slug.js";

/**
 * BBVA escribe todas sus fichas con la misma plantilla, así que no hace falta
 * un modelo para leerlas: este parser las convierte en tramos de forma
 * determinista y gratis, y lo que no encaja en la plantilla cae en revisión.
 */

const RUBRO: Record<string, string> = {
  gastronomia: "restaurantes",
  "cuidado-personal": "salud-belleza",
  opticas: "salud-belleza",
  moda: "indumentaria",
  "hogar-y-decoracion": "hogar-deco",
  "vida-activa": "deportes",
  "librerias-y-papelerias": "libreria-juguetes",
  "mundo-infantil": "libreria-juguetes",
  viajes: "viajes",
  autos: "servicios",
  experiencias: "entretenimiento",
  tecnologia: "electro-tecnologia",
  mascotas: "mascotas",
  otros: "otros",
};

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, setiembre: 9, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const DEPARTAMENTOS: Record<string, string> = {
  montevideo: "montevideo", canelones: "canelones", maldonado: "maldonado", colonia: "colonia",
  "san jose": "san-jose", "san josé": "san-jose", rocha: "rocha", salto: "salto", paysandu: "paysandu",
  paysandú: "paysandu", rivera: "rivera", tacuarembo: "tacuarembo", tacuarembó: "tacuarembo",
  artigas: "artigas", durazno: "durazno", flores: "flores", florida: "florida", lavalleja: "lavalleja",
  soriano: "soriano", "rio negro": "rio-negro", "río negro": "rio-negro", "cerro largo": "cerro-largo",
  "treinta y tres": "treinta-y-tres",
};

const DIAS: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, miércoles: 3, jueves: 4, viernes: 5, sabado: 6, sábado: 6,
};

function sinAcentos(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Todas las de crédito de consumo: lo que vale un tramo que no nombra tarjeta. */
const CREDITO = [
  "bbva-credito", "bbva-mastercard-internacional", "bbva-oro", "bbva-mastercard-oro",
  "bbva-mastercard-platinum", "bbva-black", "bbva-infinite",
];

/**
 * Tarjetas de un club: una por nivel. "Internacionales, Oro y Platinum BBVA
 * Club Atlético Peñarol" son esos tres niveles; "Tarjetas de crédito BBVA Club
 * Atlético Peñarol" a secas, los tres.
 */
function nivelesDelClub(f: string, club: "penarol" | "nacional"): string[] {
  const niveles = [
    [/internacional/, "internacional"],
    [/\boro\b/, "oro"],
    [/platinum/, "platinum"],
  ] as const;
  const nombrados = niveles.filter(([re]) => re.test(f)).map(([, n]) => n);
  return (nombrados.length > 0 ? nombrados : niveles.map(([, n]) => n)).map((n) => `bbva-${club}-${n}`);
}

/**
 * Las tarjetas de marca: si la frase nombra una, los niveles que la acompañan
 * ("Comunidad Plus Internacional, Oro e Infinite", "Internacionales, Oro y
 * Platinum BBVA Club Nacional de Football") son de esa tarjeta, no las
 * genéricas de BBVA.
 */
function deMarca(f: string): string[] {
  const ids: string[] = [];
  // "Nacional" a secas está dentro de "Internacional": el club se nombra entero.
  if (/penarol/.test(f)) ids.push(...nivelesDelClub(f, "penarol"));
  if (/club nacional|nacional de football/.test(f)) ids.push(...nivelesDelClub(f, "nacional"));
  // Abtour y Consolid Travel se eligen Visa o Mastercard.
  if (/abtour/.test(f)) ids.push("bbva-abtour-visa", "bbva-abtour-mastercard");
  if (/consolid/.test(f)) ids.push("bbva-consolid-travel", "bbva-consolid-travel-visa");
  if (/comunidad plus/.test(f)) ids.push("bbva-comunidad-plus");
  if (/sodimac/.test(f)) ids.push("bbva-sodimac");
  return ids;
}

/** "Tarjetas de Crédito Internacional, Oro, Pymes y Corporativas" → ids. Exportada para los tests. */
export function productos(frase: string): { ids: string[]; desconocidos: string[] } {
  const f = sinAcentos(frase);
  const marca = deMarca(f);
  if (marca.length > 0) return { ids: marca, desconocidos: [] };
  const ids = new Set<string>();
  const desconocidos: string[] = [];
  if (/debito/.test(f)) ids.add("bbva-debito");
  // "Internacional" sin red: BBVA la emite Visa y Mastercard.
  if (/internacional/.test(f)) {
    ids.add("bbva-credito");
    ids.add("bbva-mastercard-internacional");
  }
  // Oro sin red: BBVA la emite Visa y Mastercard. La Platinum es solo Mastercard.
  if (/\boro\b/.test(f)) {
    ids.add("bbva-oro");
    ids.add("bbva-mastercard-oro");
  }
  if (/platinum/.test(f)) ids.add("bbva-mastercard-platinum");
  if (/black/.test(f)) ids.add("bbva-black");
  if (/infinite/.test(f)) ids.add("bbva-infinite");
  // "Tarjetas de Crédito BBVA" a secas: todas las de crédito.
  // Pymes y corporativas van siempre junto a Internacional/Oro; no son
  // tarjetas de consumo y no se listan aparte.
  if (/credito/.test(f) && ids.size === 0) {
    for (const id of CREDITO) ids.add(id);
  }
  return { ids: [...ids], desconocidos };
}

/**
 * "Descuentos todos los días de la semana" | "Descuentos de Lunes a Viernes" |
 * "Descuentos los Sábados" | "Lunes a Viernes:" | "Sábados y Domingos:".
 */
function dias(encabezado: string): number[] {
  const e = sinAcentos(encabezado);
  if (/todos los dias/.test(e)) return [];
  const rango = e.match(/(?:^|de )(lunes|martes|miercoles|jueves|viernes|sabado|domingo)s? a (lunes|martes|miercoles|jueves|viernes|sabado|domingo)/);
  if (rango) {
    const a = DIAS[rango[1]!]!, b = DIAS[rango[2]!]!;
    const out: number[] = [];
    for (let d = a; ; d = (d + 1) % 7) { out.push(d); if (d === b) break; }
    return out;
  }
  const sueltos = [...e.matchAll(/\b(lunes|martes|miercoles|jueves|viernes|sabados?|domingos?)\b/g)]
    .map((m) => DIAS[m[1]!.replace(/s$/, "")] ?? DIAS[m[1]!])
    .filter((d): d is number => d !== undefined);
  return [...new Set(sueltos)];
}

const DIA = "(?:lunes|martes|miercoles|jueves|viernes|sabados?|domingos?)";
/** "miércoles", "lunes y jueves", "lunes a viernes", "sábados, domingos y feriados". */
const LISTA_DE_DIAS = `${DIA}(?:\\s*(?:,|\\by\\b|\\ba\\b)\\s*${DIA})*`;
/** Un encabezado que es solo días: "Lunes a Viernes:", "Sábados y Domingos:". */
const ENCABEZADO_DE_DIAS = new RegExp(`^${LISTA_DE_DIAS}:$`);
/** "Miércoles 25% en BAS", "Miércoles de Sodimac": la promo de un día. */
const TITULO_CON_DIAS = new RegExp(`^(${LISTA_DE_DIAS})\\b`);
/**
 * La condición que restringe la promo a unos días: "Promoción válida los días
 * miércoles…", "El descuento aplicará a las compras realizadas los días
 * Miércoles". Dentro de una oración. Los horarios de atención ("reservas al
 * 0800-8757 de lunes a viernes de 9 a 18 hs") no dicen "los días" y no
 * cuentan; tampoco un adicional ("Los días martes se sumará un descuento
 * especial…"), que no empieza con "válida" ni "aplica".
 */
const CONDICION_DE_DIAS = new RegExp(
  `\\b(?:valida|valido|aplica\\w*|realizadas?)\\b[^.]*?\\blos dias (${LISTA_DE_DIAS})\\b`,
);

/**
 * Los días a los que la ficha entera restringe la promo, por el título o por
 * las condiciones; [] si no los restringe. Vale para los tramos que no tienen
 * días propios (ni encabezado ni días delante). Exportada para los tests.
 */
export function diasDeLaPromo(contenido: string): number[] {
  const t = sinAcentos(contenido);
  const titulo = t.split("\n", 1)[0]!.trim();
  const delTitulo = titulo.match(TITULO_CON_DIAS);
  if (delTitulo) return dias(delTitulo[1]!);
  for (const linea of t.split("\n")) {
    const m = linea.match(CONDICION_DE_DIAS);
    if (m) return dias(m[1]!);
  }
  return [];
}

/**
 * Las fichas de las tarjetas de marca se titulan con la promo ("Si aún no
 * tenés la tarjeta, solicitala y sumá 10% off…") y no con el comercio.
 * Nombre y clave son los del comercio que ya está en la base.
 */
const MARCAS: [RegExp, { key: string; nombre: string }][] = [
  [/abtour/, { key: "abtour", nombre: "Abtour" }],
  [/consolid/, { key: "consolid", nombre: "Consolid" }],
  [/sodimac/, { key: "sodimac", nombre: "Sodimac" }],
];

/** Dominios de comercio que no se escriben como se nombran. */
const DOMINIOS: Record<string, { key: string; nombre: string }> = {
  tata: { key: "tata", nombre: "Ta-Ta" },
};

/**
 * El comercio de la ficha. Casi siempre es el título, pero:
 * - Las de los clubes son "Peñarol - Descuento en compra y renovación de
 *   butacas": una ficha por promo, el comercio es el club.
 * - Las promos de un día o de sacar la tarjeta se titulan con la promo
 *   ("Miércoles 25% en BAS", "Miércoles de 10%", "Si aún no tenés la
 *   tarjeta…"): el comercio sale del título ("en BAS", "de Sodimac"), de la
 *   tarjeta de marca (Abtour, Consolid) o de la web que nombra la ficha
 *   ("tata.com.uy").
 * En las de los clubes, lo que va después del guion queda como `detalle`
 * ("compra y renovación de butacas") para el título del beneficio: si no, el
 * club tendría tres "10% de descuento" sin decir en qué. Exportada para los
 * tests.
 */
export function comercioDeLaFicha(contenido: string): { key: string; nombre: string; detalle?: string } {
  const titulo = (contenido.split("\n", 1)[0] ?? "").trim();
  const t = sinAcentos(titulo);
  const club = t.match(/^(penarol|nacional)\s*[-–]\s*/);
  if (club) {
    const detalle = titulo.slice(club[0].length).replace(/^descuentos? en\s+/i, "").trim();
    const deClub =
      club[1] === "penarol"
        ? { key: "club-atletico-penarol", nombre: "Club Atlético Peñarol" }
        : { key: "club-nacional-de-football", nombre: "Club Nacional de Football" };
    return detalle ? { ...deClub, detalle } : deClub;
  }
  // "100% Artesanal" es un nombre; "25% en BAS", "10% off en…", una promo.
  const esPromo = TITULO_CON_DIAS.test(t) || /^si aun no tenes/.test(t) || /\d\s*%\s*(?:off\s+)?en\s/.test(t);
  if (!esPromo) return { key: slugificar(titulo), nombre: titulo };
  const nombrado =
    titulo.match(/\d\s*%\s+en\s+([^%]+?)\.?$/i)?.[1] ??
    (TITULO_CON_DIAS.test(t) ? titulo.match(/^\S+\s+de\s+(\D[^%]*?)\.?$/i)?.[1] : undefined);
  if (nombrado) {
    const marca = MARCAS.find(([re]) => re.test(sinAcentos(nombrado)))?.[1];
    return marca ?? { key: slugificar(nombrado), nombre: nombrado };
  }
  const c = sinAcentos(contenido.replace(/\nLegales:[\s\S]*$/, ""));
  const marca = MARCAS.find(([re]) => re.test(c))?.[1];
  if (marca) return marca;
  const dominio = c.match(/\b(?:www\.)?([a-z0-9-]+)\.com\.uy\b/)?.[1];
  if (dominio && dominio !== "bbva") {
    return DOMINIOS[dominio] ?? { key: slugificar(dominio), nombre: dominio[0]!.toUpperCase() + dominio.slice(1) };
  }
  return { key: slugificar(titulo), nombre: titulo };
}

function fecha(texto: string): string | null {
  const m = texto.match(/(\d{1,2}) de (\w+) (?:de )?(\d{4})/i);
  if (!m) return null;
  const mes = MESES[sinAcentos(m[2]!)];
  if (!mes) return null;
  return `${m[3]}-${String(mes).padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
}

/** Un tope ya leído: cuánto te devuelven como máximo, en qué moneda y cada cuánto. */
export interface Tope {
  monto: number;
  moneda: Moneda;
  periodo: TopePeriodo;
}

/** "USD100", "USD 100", "U$S 1.000", "US$ 100" (sobre el texto sin acentos y en minúsculas). */
const MONTO_USD = /(?:usd|u\$s|us\$)\s?(\d{1,3}(?:[.,]\d{3})+|\d+)/;
/** "tope de devolución/descuento … USD 100", dentro de la misma oración. */
const TOPE_USD = new RegExp(`tope de (?:devolucion|descuento)\\b(?:[^.]|\\.\\d)*?${MONTO_USD.source}`);

/** La oración de `l` que contiene la posición `i` (un punto seguido de espacio la corta; "2.000" no). */
function oracion(l: string, i: number): string {
  const antes = l.slice(0, i).split(/\.\s/).at(-1) ?? "";
  const despues = l.slice(i).split(/\.(?:\s|$)/)[0] ?? "";
  return antes + despues;
}

/**
 * Tope en dólares de una línea. BBVA los escribe distinto que los de pesos:
 * "Tope de descuento por cuenta … por primera compra por única vez … sera de
 * USD100 dolares americanos". "Por única vez" es un tope del beneficio entero;
 * si no dice el período, el mensual de siempre (por cierre de estado de cuenta).
 */
function topeUsd(l: string): { tope: Tope; indice: number } | null {
  const m = TOPE_USD.exec(l);
  if (!m) return null;
  const o = oracion(l, m.index);
  const periodo: TopePeriodo = /por unica vez|primera compra/.test(o)
    ? "beneficio"
    : /por dia\b/.test(o)
      ? "dia"
      : "mes";
  return { tope: { monto: Number(m[1]!.replace(/[.,]/g, "")), moneda: "USD", periodo }, indice: m.index };
}

/**
 * Tope por grupo de tarjetas, leyendo los legales en orden: cada encabezado de
 * grupo ("TARJETAS DE DÉBITO", "Tarjetas de crédito Infinite, Platinum y
 * Black") abre un bloque y el primer "tope de devolución será de N pesos" que
 * sigue es el de ese grupo. BBVA suele partir el descuento en dos mitades: una
 * en el local sin tope y otra en el estado de cuenta con tope mensual; el tope
 * que guardamos es ese.
 *
 * Las fichas de una sola tarjeta (Consolid, Sodimac) no tienen encabezados y
 * lo escriben de otra forma ("con un tope de devolución de 6000 pesos"): el
 * primero antes de cualquier encabezado queda como "general", para los tramos
 * cuyo grupo no tiene tope propio. Los topes en dólares ("USD100") se leen
 * aparte (`topeUsd`). Exportada para los tests.
 */
export function topes(legales: string): Map<string, Tope | null> {
  const out = new Map<string, Tope | null>();
  let grupo = "";
  for (const linea of legales.split("\n")) {
    const l = sinAcentos(linea);
    if (/^tarjetas? de/.test(l) || /^tarjetas de cr/.test(l)) {
      // "Platinium": así lo escribe la ficha de 1900.
      grupo = /platin|black|infinite/.test(l) ? "alto" : /debito/.test(l) ? "debito" : /internacional|oro|credito/.test(l) ? "credito" : grupo;
      continue;
    }
    const clave = grupo || "general";
    // "será de 2000 pesos", "de 6000 pesos", "tope de devolución 2.000 pesos".
    const m = l.match(/tope de devolucion (?:sera )?(?:de )?\$?\s?([\d.]+)\s*pesos/);
    const usd = topeUsd(l);
    // Si la línea tiene los dos, vale el primero que aparece (como con los de pesos).
    const tope: Tope | null =
      usd && (!m || usd.indice < m.index!)
        ? usd.tope
        : m
          ? { monto: Number(m[1]!.replace(/\./g, "")), moneda: "UYU", periodo: "mes" }
          : null;
    if (tope && !out.has(clave)) out.set(clave, tope);
    else if (/sin tope de devolucion\.?$/.test(l) && grupo && !out.has(grupo)) out.set(grupo, null);
  }
  return out;
}

/**
 * Topes por nivel de las tarjetas de los clubes, que los legales escriben en
 * una sola frase: "el tope de devolución será de $3.700 pesos uruguayos para
 * tarjetas Internacionales, $5.000 pesos uruguayos para tarjetas Oro y $6.300
 * pesos uruguayos para tarjetas Platinum", o "$1.000 … para tarjetas
 * internacionales, Oro y Platinum" (el mismo para los tres). Exportada para
 * los tests.
 */
export function topesDeClub(legales: string): Map<"internacional" | "oro" | "platinum", number> {
  const out = new Map<"internacional" | "oro" | "platinum", number>();
  for (const linea of legales.split("\n")) {
    const l = sinAcentos(linea);
    if (!/tope de devolucion/.test(l)) continue;
    for (const m of l.matchAll(/\$\s?([\d.]+)(?:\s*pesos(?: uruguayos)?)?\s+para tarjetas? ([a-z ,]+?)(?=,? ?\$|,? por |\.|$)/g)) {
      const monto = Number(m[1]!.replace(/\./g, ""));
      const niveles = m[2]!;
      if (/internacional/.test(niveles) && !out.has("internacional")) out.set("internacional", monto);
      if (/\boro\b/.test(niveles) && !out.has("oro")) out.set("oro", monto);
      if (/platin/.test(niveles) && !out.has("platinum")) out.set("platinum", monto);
    }
  }
  return out;
}

const NIVEL_DE_CLUB = /^bbva-(?:penarol|nacional)-(internacional|oro|platinum)$/;
const NOMBRE_NIVEL = { internacional: "Internacional", oro: "Oro", platinum: "Platinum" } as const;

/** ["bbva-nacional-internacional", "bbva-nacional-oro"] → "Internacional y Oro". */
function nombreNiveles(ids: string[]): string {
  const nombres = ids
    .map((id) => id.match(NIVEL_DE_CLUB)?.[1] as keyof typeof NOMBRE_NIVEL | undefined)
    .filter((n): n is keyof typeof NOMBRE_NIVEL => n !== undefined)
    .map((n) => NOMBRE_NIVEL[n]);
  return nombres.length <= 1 ? (nombres[0] ?? "") : `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`;
}

/** Lo que restringe los tramos que siguen a unos productos: "Productos con Farmadescuento", "Solo en…". */
const CALIFICADOR = /^(Productos|Solo|Sólo|Únicamente|Excepto)\b/i;

/**
 * Los legales del bloque de un calificador: las farmacias los parten en
 * "PRODUCTOS SIN FARMADESCUENTO" y "PRODUCTOS CON FARMADESCUENTO", cada uno
 * con sus topes por grupo de tarjetas (y a veces distintos: Farmacia del
 * Parque devuelve hasta 2000 con débito sin Farmadescuento y 4000 con). Si los
 * legales no nombran el calificador, null. Exportada para los tests.
 */
export function legalesDelCalificador(legales: string, calificador: string): string | null {
  const lineas = legales.split("\n");
  const buscado = sinAcentos(calificador).trim();
  const desde = lineas.findIndex((l) => sinAcentos(l).trim().replace(/:$/, "") === buscado);
  if (desde < 0) return null;
  // Termina en el encabezado del bloque siguiente (sin punto: una oración de
  // los legales que empiece con "Solo…" no corta el bloque).
  const hasta = lineas.findIndex((l, k) => k > desde && CALIFICADOR.test(l.trim()) && !/[.%]/.test(l));
  return lineas.slice(desde + 1, hasta < 0 ? undefined : hasta).join("\n");
}

export function normalizarBbva(crudo: Crudo): Extraido {
  const lineas = crudo.contenido.split("\n").map((l) => l.trim()).filter(Boolean);
  const { detalle, ...comercio } = comercioDeLaFicha(lineas.join("\n"));
  // "Peñarol - Entradas de Campeonato Uruguayo": el título del beneficio dice en qué.
  const enQue = detalle ? ` en ${detalle[0]!.toLowerCase()}${detalle.slice(1)}` : "";
  const rubroBbva = crudo.contenido.match(/Rubro según BBVA: ([a-z-]+)\./)?.[1] ?? "otros";
  const categoria = RUBRO[rubroBbva] ?? "otros";

  // "Farmacia en Carmelo, Colonia" → departamento; varios deptos = todo el país.
  const ubicacion = lineas[1] ?? "";
  const departamentos: string[] = [];
  for (const [nombreDepto, slug] of Object.entries(DEPARTAMENTOS)) {
    if (new RegExp(`\\b${nombreDepto}\\b`, "i").test(sinAcentos(ubicacion))) departamentos.push(slug);
  }
  const vigencia_hasta = fecha(lineas.find((l) => /^Vigencia/i.test(l)) ?? "");
  const i = crudo.contenido.indexOf("\nLegales:");
  const legales_raw = i > 0 ? crudo.contenido.slice(i + 9).replace(/\n\nRubro según BBVA.*$/s, "").trim() : null;
  const tope = topes(legales_raw ?? "");

  const tramos: BeneficioNormalizado[] = [];
  const desconocidos: string[] = [];
  let diasActuales: number[] = [];
  // Los días que el título o las condiciones imponen a toda la ficha
  // ("Promoción válida los días miércoles"): para los tramos sin días propios.
  const diasDeLaFicha = diasDeLaPromo(lineas.join("\n"));
  let calificador = "";
  // Los legales repiten los porcentajes en prosa ("20% en el total de la
  // compra…"): la forma sin "Off" solo se acepta antes de ellos.
  const inicioLegales = lineas.findIndex((l) => /^Legales:?/i.test(l));
  // Tarjetas de crédito de los tramos ya leídos: las cuotas sin tarjeta
  // nombrada ("Hasta 12 cuotas sin interés en pesos") valen para esas.
  const creditoDeLaPagina = new Set<string>();
  for (const [k, l] of lineas.entries()) {
    const enLegales = inicioLegales >= 0 && k >= inicioLegales;
    if ((/^Descuentos?\b/i.test(l) && /:$/.test(l)) || ENCABEZADO_DE_DIAS.test(sinAcentos(l))) { diasActuales = dias(l); continue; }
    if (CALIFICADOR.test(l) && !/% ?Off/i.test(l)) { calificador = l.replace(/:$/, ""); continue; }
    // "Hasta 12 cuotas sin interés con Tarjetas…", o "Hasta 12 cuotas sin
    // recargo en pesos y 18 … en dólares" (se toma la primera: la de pesos).
    // Sin tarjeta nombrada vale para las de crédito de los tramos anteriores.
    const cuotas = l.match(/^Hasta (\d{1,2}) cuotas sin (?:inter[eé]s|recargo)(.*)$/i);
    if (cuotas && !enLegales) {
      const tarjetas = cuotas[2]!.match(/con (.+?)\.?$/)?.[1];
      const ids = tarjetas ? productos(tarjetas).ids : (creditoDeLaPagina.size > 0 ? [...creditoDeLaPagina] : [...CREDITO]);
      tramos.push({
        comercio_key: comercio.key, titulo: `${cuotas[1]} cuotas sin interés${enQue}`, descuento_raw: l,
        porcentaje: null, cuotas: Number(cuotas[1]), tipo: "cuotas", dias_semana: diasActuales.length ? diasActuales : diasDeLaFicha,
        vigencia_desde: null, vigencia_hasta, departamentos: departamentos.length === 1 ? (departamentos as BeneficioNormalizado["departamentos"]) : [],
        productos_elegibles: ids, tope_monto: null, tope_periodo: null, tope_moneda: "UYU", canal: "presencial", mecanica: [],
        acumulable: null, compra_minima: null, requiere_activacion: false, legales_raw, como_usarlo: [], url_fuente: crudo.url_fuente,
      });
      continue;
    }
    // "15% Off en Alquiler de autos en Uruguay" (sin tarjeta): todas las de crédito.
    // Lo que aplica en otro país no es un beneficio de acá.
    // "20% en membresías…" (sin "Off") es un tramo, pero solo fuera de los legales.
    const m =
      l.match(/^(?:(.*?)\s)?(\d{1,2})\s*%\s*Off (?:con|en|sobre) (.+)$/i) ??
      (enLegales ? null : l.match(/^(?:(Hasta)\s)?(\d{1,2})\s*%\s*(?:de descuento\s+)?(?:en|con|sobre) (.+)$/i));
    if (!m) continue;
    // "25% en la primera compra con Tarjeta…": promo para sacar la tarjeta, no
    // un beneficio en un comercio. Solo en la forma nueva, sin "Off": la de
    // siempre ya publicaba "10% Off en primera compra" (Consolid) y se mantiene.
    if (!/% ?Off/i.test(l) && /primera compra/i.test(l)) continue;
    // "Hasta 40% Off…": el porcentaje es un máximo; se guarda y el "hasta"
    // queda en `descuento_raw`.
    const hasta = /^hasta$/i.test(m[1] ?? "");
    // Las farmacias con Farmadescuento escriben el calificador adelante del
    // primer tramo de cada bloque ("Productos sin Farmadescuento 20% Off con
    // Tarjetas de Débito") y no en una línea aparte: vale para ese tramo y los
    // que lo siguen, igual que si estuviera solo en su línea. No son días.
    const prefijo = m[1] && !hasta ? m[1] : "";
    if (CALIFICADOR.test(prefijo)) calificador = prefijo;
    // A veces los días van adelante del tramo: "Martes y Jueves 10% Off con…".
    // Cualquier otro prefijo no es un tramo de la ficha.
    const diasDelTramo = prefijo && !CALIFICADOR.test(prefijo) ? dias(prefijo) : [];
    if (prefijo && !CALIFICADOR.test(prefijo) && diasDelTramo.length === 0) continue;
    if (/estados unidos|argentina|brasil|chile|exterior/i.test(m[2]!)) continue;
    const porcentaje = Number(m[2]);
    const { ids, desconocidos: d } = /tarjeta/i.test(m[3]!)
      ? productos(m[3]!)
      : { ids: [...CREDITO], desconocidos: [] };
    desconocidos.push(...d);
    const f = sinAcentos(m[3]!);
    const clave = /platinum|black|infinite/.test(f) ? "alto" : /debito/.test(f) ? "debito" : "credito";
    for (const id of ids) if (id !== "bbva-debito") creditoDeLaPagina.add(id);
    // Con calificador, los topes de su bloque de los legales, si lo tiene.
    const delBloque = calificador ? legalesDelCalificador(legales_raw ?? "", calificador) : null;
    const topesDelTramo = delBloque !== null ? topes(delBloque) : tope;
    const topeDelTramo =
      (topesDelTramo.has(clave) ? topesDelTramo.get(clave) : tope.has(clave) ? tope.get(clave) : tope.get("general")) ?? null;
    // Las tarjetas de un club tienen un tope por nivel: si los legales los
    // separan, va un tramo por tope (un beneficio guarda un solo tope).
    const porNivel = ids.every((id) => NIVEL_DE_CLUB.test(id)) ? topesDeClub(legales_raw ?? "") : new Map<string, number>();
    // Agrupados por tope (monto, moneda y período): la clave es el texto.
    const grupos = new Map<string, { tope: Tope | null; ids: string[] }>();
    for (const id of ids) {
      const nivel = id.match(NIVEL_DE_CLUB)?.[1] as "internacional" | "oro" | "platinum" | undefined;
      const deClub = nivel ? porNivel.get(nivel) : undefined;
      const t: Tope | null = deClub ? { monto: deClub, moneda: "UYU", periodo: "mes" } : topeDelTramo;
      const k = t ? `${t.monto}|${t.moneda}|${t.periodo}` : "";
      const g = grupos.get(k) ?? { tope: t, ids: [] };
      g.ids.push(id);
      grupos.set(k, g);
    }
    for (const { tope: t, ids: idsDelGrupo } of grupos.values()) tramos.push({
      comercio_key: comercio.key,
      // Partido por tope, cada tramo dice de qué nivel es: si no, en la web se
      // ven tres "10% de descuento" iguales que solo cambian el tope.
      titulo: `${hasta ? "Hasta " : ""}${porcentaje}% de descuento${enQue}${grupos.size > 1 ? ` con ${nombreNiveles(idsDelGrupo)}` : ""}${calificador ? ` (${calificador.toLowerCase()})` : ""}`,
      // Si el calificador ya va adelante del tramo, la línea lo dice.
      descuento_raw: calificador && calificador !== prefijo ? `${calificador}: ${l}` : l,
      porcentaje,
      cuotas: null,
      tipo: "porcentaje",
      dias_semana: diasDelTramo.length ? diasDelTramo : diasActuales.length ? diasActuales : diasDeLaFicha,
      vigencia_desde: null,
      vigencia_hasta,
      departamentos: departamentos.length === 1 ? (departamentos as BeneficioNormalizado["departamentos"]) : [],
      productos_elegibles: idsDelGrupo,
      tope_monto: t?.monto ?? null,
      tope_periodo: t?.periodo ?? null,
      tope_moneda: t?.moneda ?? "UYU",
      canal: "presencial",
      mecanica: [],
      acumulable: /no acumulable/i.test(legales_raw ?? "") ? false : null,
      compra_minima: null,
      requiere_activacion: false,
      legales_raw,
      como_usarlo: ["Identificate como cliente BBVA antes de pedir la factura."],
      url_fuente: crudo.url_fuente,
    });
  }

  return {
    crudo,
    comercio: tramos.length > 0 ? { ...comercio, categoria } : null,
    beneficios: tramos,
    productos_desconocidos: [...new Set(desconocidos)],
  };
}
