import { BeneficioNormalizadoSchema, PRODUCTOS, type BeneficioNormalizado, type TopePeriodo } from "@tarjetazo/core";
import { mapearProductos, sinFechaComodin, topeDevolucion } from "../normalizador.js";
import { slugificar } from "../slug.js";
import type { Crudo, Extraido, SucursalDeFuente } from "../tipos.js";
import type { DatosSantander } from "./santander.js";
import { clausulas, diasDe, diasEnTitulo, iso, sinAcentos, vigenciaDelLegal, type Clausula } from "./legales.js";

/**
 * Santander, sin modelo. Cada ficha tiene el título del comercio, un resumen
 * de una o dos frases ("25% con Platinum, Select y Private Banking.", "15% con
 * crédito y débito.") y las condiciones; casi todas salen de dos plantillas:
 *
 * - **Ruta Gourmet** (restaurantes): 25% con Platinum, Select y Private
 *   Banking y 15% con crédito y débito, con un tope mensual de devolución por
 *   segmento (Private Banking, Select y "el resto de los segmentos").
 * - **Comercios adheridos**: "15% de descuento todos los días", sin tarjeta
 *   nombrada (vale con cualquiera) y sin tope.
 *
 * Cada porcentaje del resumen es un tramo; si las condiciones dan un tope
 * distinto por segmento, el tramo se parte en uno por tope. Una tarjeta que
 * ya tiene un porcentaje mayor en la misma página (los mismos días o más) no
 * se repite en el menor: "15% con crédito y débito" es para las que no son
 * Platinum, Select ni Private Banking. Las fichas sin porcentaje, 2x1 ni
 * cuotas ("El comercio acepta canje de puntos") no son beneficios.
 */

const FUENTE = "santander";

// ---------------------------------------------------------------- tarjetas

const NOMBRE_TARJETA =
  /\b(farmacard|hiperm[aá]s|private|select|a{1,2}dvantage|infinite|black|platinum|visa|mastercard|credito|debito)\b/;

/**
 * Las tarjetas que nombra una frase, como ids del catálogo. "Tarjetas
 * Santander" o "todas las tarjetas" no nombran ninguna: vale cualquiera
 * (lista vacía). "Débito Select" es la débito del pack, no el pack entero; el
 * "débito automático" es una forma de pago, no una tarjeta. Exportada para
 * los tests.
 */
export function tarjetasDe(frase: string): { ids: string[]; desconocidos: string[] } {
  const f = sinAcentos(frase)
    .replace(/debito automatico/g, " ")
    .replace(/\bmaster ?card\b/g, "mastercard")
    .replace(/[()*"“”]/g, " ");
  const nombres: string[] = [];
  for (let pedazo of f.split(/,|;|:|\/|\.|\s+y\s+|\s+e\s+|\s+o\s+/)) {
    pedazo = pedazo.replace(/\s+/g, " ").trim();
    // "15% de descuento con tarjetas de crédito" → "tarjetas de crédito".
    const con = pedazo.lastIndexOf(" con ");
    if (con >= 0) pedazo = pedazo.slice(con + 5);
    pedazo = pedazo.replace(/\s+(emitidas?|del banco|de banco|en (?:el|la|los|las|categorias|restaurantes)|todos los dias).*$/, "").trim();
    if (NOMBRE_TARJETA.test(pedazo)) nombres.push(pedazo);
  }
  const ids = new Set<string>();
  const desconocidos: string[] = [];
  for (const nombre of nombres) {
    const r = mapearProductos(FUENTE, [nombre]);
    desconocidos.push(...r.desconocidos);
    // "débito Select" → solo la de débito del pack; "crédito Select" → las de crédito.
    const debito = /\bdebito\b/.test(nombre);
    const credito = /\bcredito\b/.test(nombre);
    const instrumento = debito && !credito ? "debito" : credito && !debito ? "credito" : null;
    const filtrados = instrumento
      ? r.ids.filter((id) => PRODUCTOS.find((p) => p.id === id)?.instrumento === instrumento)
      : r.ids;
    for (const id of filtrados.length > 0 ? filtrados : r.ids) ids.add(id);
  }
  return { ids: [...ids].sort(), desconocidos };
}

// ---------------------------------------------------------------- topes

interface TopeSantander {
  monto: number;
  moneda: "UYU" | "USD";
  periodo: TopePeriodo;
  /** A quiénes aplica: ids, "resto" ("para el resto de los segmentos") o null (a todos). */
  para: string[] | "resto" | null;
}

const MONTO = /(usd|u\$s|us\$|\$)\s*(\d{1,3}(?:\.\d{3})+|\d+)/;

/**
 * Los topes de las condiciones, que en Santander son siempre de devolución:
 *
 * - "Tope de Devolución mensual (por cliente, …):" seguido de una línea por
 *   segmento: "Clientes bajo segmento Private Banking: hasta UYU 6.000…",
 *   "Para el resto de los segmentos: hasta UYU 2.000…".
 * - "Para tarjetas de débito Select la devolución es de hasta UYU 4.000 … por
 *   mes", "Para el resto de las tarjetas … $ 2.000 por mes".
 * - "Tope mensual de descuento por socio Farmacard de $U 5.000.", "Tope
 *   mensual por usuario de $3.000.".
 *
 * El período es el de la línea o, si no lo dice, el del bloque ("mensual" en
 * el encabezado o "por mes" en otra línea del mismo bloque); sin ninguno, por
 * compra. Exportada para los tests.
 */
export function topesDe(condiciones: string): TopeSantander[] {
  const out: TopeSantander[] = [];
  const lineas = condiciones.split("\n");
  // Un bloque arranca en una viñeta ("•") o en una línea que habla del tope.
  const bloques: string[][] = [];
  for (const l of lineas) {
    if (l.startsWith("•") || bloques.length === 0) bloques.push([l]);
    else bloques[bloques.length - 1]!.push(l);
  }
  for (const bloque of bloques) {
    const texto = sinAcentos(bloque.join("\n")).replace(/\$\s*u\b|\buyu\b/g, "$");
    if (!/\btope\b|\bla devolucion es\b/.test(texto)) continue;
    const mensual = /mensual|por mes\b/.test(texto);
    for (const linea of texto.split("\n")) {
      const m = linea.match(MONTO);
      if (!m || !/\btope\b|\bhasta\b/.test(linea)) continue;
      const periodo: TopePeriodo = /por dia\b|diari/.test(linea)
        ? "dia"
        : /por mes\b|mensual/.test(linea)
          ? "mes"
          : /por compra\b/.test(linea)
            ? "compra"
            : mensual
              ? "mes"
              : "compra";
      const antes = linea.slice(0, m.index!);
      let para: TopeSantander["para"] = null;
      if (/\bresto de (?:los|las)\b/.test(antes)) para = "resto";
      else {
        const quien = antes.match(/(?:segmento|para tarjetas?(?: de)?|por socio)\s+([^:$]*?)\s*(?::|la devolucion|de\s*$|$)/)?.[1];
        const ids = quien ? tarjetasDe(quien).ids : [];
        if (ids.length > 0) para = ids;
      }
      out.push({
        monto: Number(m[2]!.replace(/\./g, "")),
        moneda: m[1] === "$" ? "UYU" : "USD",
        periodo,
        para,
      });
    }
  }
  return out;
}

/**
 * Parte los ids de un tramo según el tope que les toca: el de su segmento si
 * lo nombra una línea, si no el del resto, si no el general. Un tramo sin
 * tarjetas (vale con cualquiera) se queda con el general o el del resto.
 */
function partirPorTope(ids: string[], topes: TopeSantander[]): { ids: string[]; tope: TopeSantander | null }[] {
  const resto = topes.find((t) => t.para === "resto") ?? null;
  const general = topes.find((t) => t.para === null) ?? null;
  // "15% de descuento todos los días" con la tabla de topes por segmento
  // (la que termina en "el resto de los segmentos"): el tramo vale con
  // cualquier tarjeta, pero cada segmento tiene su tope.
  const porSegmento = resto !== null && topes.some((t) => Array.isArray(t.para));
  if (ids.length === 0 && porSegmento) ids = tarjetasDe("crédito y débito").ids;
  if (ids.length === 0) return [{ ids, tope: general ?? resto }];
  const grupos = new Map<TopeSantander | null, string[]>();
  for (const id of ids) {
    const propio = topes.find((t) => Array.isArray(t.para) && t.para.includes(id));
    const tope = propio ?? resto ?? general;
    grupos.set(tope, [...(grupos.get(tope) ?? []), id]);
  }
  return [...grupos].map(([tope, ids]) => ({ ids, tope }));
}

// ---------------------------------------------------------------- comunes

/**
 * Categoría de un comercio nuevo, del filtro del listado donde aparece. Si el
 * comercio ya existe, la base no la pisa.
 */
const CATEGORIAS: Record<string, string> = {
  autos: "transporte",
  "deco y hogar": "hogar-deco",
  farmacia: "farmacias",
  fitness: "deportes",
  heladerias: "cafeterias",
  infantil: "libreria-juguetes",
  libreria: "libreria-juguetes",
  moda: "indumentaria",
  "ruta gourmet": "restaurantes",
  supermercados: "supermercados",
  tecnologia: "electro-tecnologia",
  "viajes y turismo": "viajes",
};

function categoriaDe(rubro: string | null): string {
  return (rubro && CATEGORIAS[sinAcentos(rubro).trim()]) || "otros";
}

/** Las fechas de las condiciones, más "convenio vigente 31/03/2026" (Buquebus). */
function vigenciaDe(condiciones: string): { desde: string | null; hasta: string | null } {
  const v = vigenciaDelLegal(condiciones);
  if (v.desde || v.hasta) return v;
  const m = sinAcentos(condiciones).match(/\bvigente\s+(?:hasta\s+(?:el\s+)?)?(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  return m ? { desde: null, hasta: iso(m[3]!, Number(m[2]), m[1]!) } : v;
}

function acumulableDe(texto: string): boolean | null {
  const t = sinAcentos(texto);
  if (/no (?:es )?acumulable|no se acumula|no acumula/.test(t)) return false;
  if (/\bes acumulable\b/.test(t)) return true;
  return null;
}

/** "El descuento se realiza directamente en el checkout de la aplicación PedidosYa". */
function canalDe(condiciones: string, locales: SucursalDeFuente[]): BeneficioNormalizado["canal"] {
  const t = sinAcentos(condiciones);
  return locales.length === 0 && /checkout|en la aplicacion|compras? (?:online|web)|tienda online/.test(t)
    ? "online"
    : "presencial";
}

/**
 * El título de un tramo, con lo que se compra y los días: "10% de descuento en
 * paquetes a Argentina", "15% de descuento en restaurantes los martes y
 * sábados", "12 cuotas sin recargo". Exportada para los tests.
 */
export function tituloDe(c: Clausula, dias: number[]): string {
  let valor: string;
  if (c.tipo === "cuotas") {
    const sinQue = /sin inter[eé]s/i.test(c.texto) ? " sin interés" : /sin recargo/i.test(c.texto) ? " sin recargo" : "";
    valor = `${c.hasta ? "Hasta " : ""}${c.cuotas} cuotas${sinQue}`;
  } else if (c.tipo === "2x1") {
    valor = "Promoción 2x1";
  } else {
    valor = `${c.hasta ? "Hasta " : ""}${c.porcentaje}% de descuento`;
  }
  const objeto = c.texto
    .replace(/[*“”"]/g, "")
    .match(/\ben\s+(.+?)(?=\s+(?:con|todos|los|las|pagando)\b|[,.;]|$)/i)?.[1]
    ?.trim();
  const en = objeto && !/tarjeta|el punto de venta/i.test(objeto) ? ` en ${objeto}` : "";
  return `${valor}${en}${diasEnTitulo(dias)}`.slice(0, 160);
}

function esSantander(d: unknown): d is DatosSantander {
  const x = d as DatosSantander | undefined;
  return !!x && typeof x.titulo === "string" && Array.isArray(x.resumen) && typeof x.condiciones === "string";
}

// ---------------------------------------------------------------- tramos

interface Tramo {
  c: Clausula;
  /** Párrafo del resumen del que sale, sin espacios de más. */
  parrafo: string;
  dias: number[];
  ids: string[];
  desconocidos: string[];
}

/**
 * Las cláusulas de cada párrafo del resumen, con sus días y tarjetas. Los días
 * pueden ir antes del primer porcentaje ("Martes, jueves y domingos 15% con
 * Santander y 25% con Farmacard") y valen para todo el párrafo; las tarjetas
 * que una cláusula no dice las toma de la siguiente del mismo párrafo ("25%
 * de descuento en la matrícula" no nombra ninguna: vale con cualquiera).
 */
function tramosDe(resumen: string[]): Tramo[] {
  const out: Tramo[] = [];
  for (const crudo of resumen) {
    const parrafo = crudo.replace(/\s+/g, " ").trim();
    const cs = clausulas(parrafo);
    if (cs.length === 0) continue;
    const prefijo = parrafo.slice(0, parrafo.indexOf(cs[0]!.texto));
    const diasDelParrafo = /todos los d[ií]as/i.test(prefijo) ? [] : diasDe(prefijo);
    for (const c of cs) {
      const propios = /todos los d[ií]as/i.test(c.texto) ? [] : diasDe(c.texto);
      const tarjetas = tarjetasDe(c.texto);
      out.push({
        c,
        parrafo,
        dias: propios.length > 0 ? propios : diasDelParrafo,
        ids: tarjetas.ids,
        desconocidos: tarjetas.desconocidos,
      });
    }
  }
  return out;
}

/** `a` cubre todos los días de `b` (vacío = todos los días). */
const cubreDias = (a: number[], b: number[]) => a.length === 0 || (b.length > 0 && b.every((d) => a.includes(d)));

/**
 * Saca de cada tramo las tarjetas que ya tienen un porcentaje mayor en la
 * página, los mismos días o más. Un tramo que se queda sin tarjetas se va.
 */
function sinDominados(tramos: Tramo[]): Tramo[] {
  return tramos
    .map((t) => {
      if (t.c.tipo !== "porcentaje" || t.ids.length === 0) return t;
      const mejores = tramos.filter(
        (o) => o !== t && o.c.tipo === "porcentaje" && (o.c.porcentaje ?? 0) > (t.c.porcentaje ?? 0) && cubreDias(o.dias, t.dias),
      );
      const ids = t.ids.filter((id) => !mejores.some((o) => o.ids.includes(id)));
      return ids.length > 0 ? { ...t, ids } : null;
    })
    .filter((t): t is Tramo => t !== null);
}

export function normalizarSantander(crudo: Crudo): Extraido {
  const d = crudo.datos;
  // Sin los campos estructurados no hay nada confiable que leer. Tirar hace
  // que la página cuente como fallida y sus beneficios sigan publicados.
  if (!esSantander(d)) throw new Error(`santander: ${crudo.external_id} no trae los datos de la ficha`);

  const tramos = sinDominados(tramosDe(d.resumen));
  if (tramos.length === 0) {
    return { crudo, comercio: null, beneficios: [], productos_desconocidos: [], es_beneficio: false };
  }

  const key = slugificar(d.titulo);
  const locales = crudo.sucursales ?? [];
  const vigencia = vigenciaDe(d.condiciones);
  const canal = canalDe(d.condiciones, locales);
  const acumulable = acumulableDe(d.condiciones);
  const topes = topesDe(d.condiciones);

  const beneficios: BeneficioNormalizado[] = [];
  const desconocidos: string[] = [];
  let i = 0;
  for (const t of tramos) {
    desconocidos.push(...t.desconocidos);
    const partes = t.c.tipo === "porcentaje" ? partirPorTope(t.ids, topes) : [{ ids: t.ids, tope: null }];
    for (const parte of partes) {
      const candidato = {
        comercio_key: key,
        titulo: tituloDe(t.c, t.dias),
        descuento_raw: t.parrafo,
        porcentaje: t.c.porcentaje,
        cuotas: t.c.cuotas,
        tipo: t.c.tipo,
        dias_semana: t.dias,
        vigencia_desde: vigencia.desde,
        vigencia_hasta: sinFechaComodin(vigencia.hasta),
        // Los completa el runner con el departamento de cada local (departamentosDeLocales).
        departamentos: [],
        productos_elegibles: parte.ids,
        ...topeDevolucion({
          tipo: t.c.tipo,
          porcentaje: t.c.porcentaje,
          tope_monto: parte.tope?.monto ?? null,
          tope_moneda: parte.tope?.moneda ?? null,
          tope_sobre: "devolucion",
          tope_periodo: parte.tope?.periodo ?? null,
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
      i++;
    }
  }
  return {
    crudo,
    comercio: beneficios.length > 0 ? { key, nombre: d.titulo, categoria: categoriaDe(d.categoria) } : null,
    beneficios,
    productos_desconocidos: [...new Set(desconocidos)],
    departamentosDeLocales: true,
  };
}
