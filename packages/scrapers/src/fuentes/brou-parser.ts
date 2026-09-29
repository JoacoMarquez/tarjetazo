import { BeneficioNormalizadoSchema, PRODUCTOS, type BeneficioNormalizado } from "@tarjetazo/core";
import { mapearProductos, sinFechaComodin, topeDevolucion } from "../normalizador.js";
import { slugificar } from "../slug.js";
import { PaginaPendiente, type Crudo, type Extraido } from "../tipos.js";
import type { DatosBrou } from "./brou.js";
import {
  clausulas,
  diasDe,
  diasEnTitulo,
  iso,
  sinAcentos,
  topeDelTramo,
  topesDelLegal,
  vigenciaDelLegal,
  type Clausula,
  type TopeLeido,
} from "./legales.js";

/**
 * BROU, sin modelo. Cada ficha se escribe a mano, pero casi siempre con la
 * misma forma: el nombre, uno o dos badges ("25 % DTO"), una frase de
 * resumen y un cuerpo con una línea por tramo:
 *
 *   25% de descuento con tarjetas de crédito BROU VISA Platinum y BROU
 *   Recompensa Mastercard Platinum y Black.
 *   15% de descuento con tarjetas de débito BROU VISA y BROU Recompensa Mastercard.
 *
 * Los 2x1 de cine ponen el tramo en una línea ("Aprovechá 2x1 en entradas
 * pagando con:") y las tarjetas en las siguientes. Las tarjetas se leen con
 * una gramática chica (instrumento, marca, niveles) y una tarjeta que ya
 * tiene un porcentaje mayor en la misma ficha no se repite en el menor.
 *
 * Lo que no encaja con seguridad (badges que no aparecen en el texto, una
 * frase de descuento sin tarjetas reconocibles, tramos que dependen de ser
 * socio o del mes) no se adivina: la página queda pendiente y sus
 * beneficios de antes siguen publicados.
 */

const FUENTE = "brou";

// ---------------------------------------------------------------- tarjetas

type Instrumento = "credito" | "debito" | "prepaga";
type Marca = "visa" | "recompensa" | "mastercard" | "mibrou" | "alfabrou" | "tuapp" | "todas";
type Nivel = "clasica" | "platinum" | "gold" | "black" | "infinite";

/**
 * Vocabulario de BROU llevado a una palabra por idea: "BROU Recompensa
 * Mastercard" → recompensa, "Platino" → platinum, "Internacional" (la
 * clásica) → clasica, "MI BROU Tarjeta Joven" → mibrou.
 */
function normalizarFrase(frase: string): string {
  return ` ${sinAcentos(frase)} `
    .replace(/[()*"“”:]/g, " ")
    .replace(/\bmi ?brou(?: tarjeta joven)?\b|\btarjeta joven\b/g, " mibrou ")
    .replace(/\balfa ?brou\b/g, " alfabrou ")
    .replace(/\btu ?app\b/g, " tuapp ")
    .replace(/\b(?:brou )?recompensa(?: master ?card)?\b|\bmaster ?card brou recompensa\b/g, " recompensa ")
    .replace(/\bmaster ?card\b/g, " mastercard ")
    .replace(/\bplatino\b/g, "platinum")
    .replace(/\boro\b/g, "gold")
    .replace(/\binternacional\b/g, "clasica")
    .replace(/\bprepagas?\b/g, "prepaga")
    .replace(/\bbrou\b|\bdel banco republica\b|\bbanco republica\b/g, " ")
    .replace(/\s+/g, " ");
}

const TOKEN = /\b(credito|debito|prepaga|visa|recompensa|mastercard|mibrou|alfabrou|tuapp|clasica|platinum|gold|black|infinite|pyme|agro|corporativ[ao]s?|tarjetas?)\b/g;

interface Grupo {
  marca: Marca;
  instrumentos: Instrumento[];
  niveles: Nivel[];
  /** "PYME", "Agro": una línea de producto que no está en el catálogo. */
  otra: string | null;
}

/**
 * Parte una frase en grupos de marca con su instrumento y sus niveles:
 * "tarjetas de crédito y débito VISA, BROU Recompensa Mastercard y MI BROU"
 * → visa (crédito, débito), recompensa (crédito, débito), mibrou.
 *
 * - El instrumento antes de una marca vale para esa y las que siguen, hasta
 *   que aparece otro o una nueva "tarjetas" ("crédito VISA y débito
 *   Mastercard"); el que va después de la marca ("VISA crédito",
 *   "Recompensa Mastercard Débito y Crédito") es solo de esa.
 * - Los niveles van después de la marca: "Platinum y Black", "Internacional y Oro".
 */
function gruposDe(frase: string): Grupo[] {
  const tokens = [...normalizarFrase(frase).matchAll(TOKEN)].map((m) => m[1]!);
  const grupos: Grupo[] = [];
  let previo: Instrumento[] = [];
  let pendiente: Instrumento[] = [];
  let actual: Grupo | null = null;
  let otra: string | null = null;
  for (const [i, t] of tokens.entries()) {
    if (t === "credito" || t === "debito" || t === "prepaga") {
      // ¿Es de la marca anterior o de la siguiente? De la siguiente si
      // después de este bloque de instrumentos viene una marca.
      let j = i;
      while (j < tokens.length && ["credito", "debito", "prepaga"].includes(tokens[j]!)) j++;
      const siguienteEsMarca = j < tokens.length && /^(visa|recompensa|mastercard|mibrou|alfabrou|tuapp|pyme|agro)$/.test(tokens[j]!);
      if (actual && !siguienteEsMarca && pendiente.length === 0) {
        if (!actual.instrumentos.includes(t)) actual.instrumentos.push(t);
      } else {
        pendiente.push(t);
      }
      continue;
    }
    if (t.startsWith("tarjeta")) {
      actual = null;
      continue;
    }
    if (t === "pyme" || t === "agro" || t.startsWith("corporativ")) {
      otra = t;
      continue;
    }
    if (["clasica", "platinum", "gold", "black", "infinite"].includes(t)) {
      if (actual && !actual.niveles.includes(t as Nivel)) actual.niveles.push(t as Nivel);
      continue;
    }
    // Una marca.
    if (pendiente.length > 0) {
      previo = pendiente;
      pendiente = [];
    }
    actual = { marca: t as Marca, instrumentos: [...previo], niveles: [], otra };
    otra = null;
    grupos.push(actual);
  }
  // Instrumentos sin marca ("tarjetas de crédito y prepagas del BROU",
  // "todas las tarjetas de débito"): todas las de ese instrumento.
  if (pendiente.length > 0 && !otra) grupos.push({ marca: "todas", instrumentos: pendiente, niveles: [], otra: null });
  return grupos;
}

const activos = PRODUCTOS.filter((p) => p.fuente_id === FUENTE && p.activo !== false);

/**
 * Los plásticos de un grupo y los niveles que esa marca no tiene ("VISA
 * Infinite"). BROU no emite la VISA Black ("VISA Platinum y Black" aparece
 * en alguna ficha): se ignora.
 */
function productosDe(g: Grupo): { ids: string[]; faltan: string[] } {
  if (g.marca === "mibrou") return { ids: ["brou-mi-brou"], faltan: [] };
  if (g.marca === "tuapp") return { ids: ["brou-tuapp"], faltan: [] };
  if (g.marca === "todas") return { ids: activos.filter((p) => g.instrumentos.includes(p.instrumento as Instrumento)).map((p) => p.id), faltan: [] };
  if (g.marca === "alfabrou") return { ids: activos.filter((p) => p.familia === "brou-alfabrou").map((p) => p.id), faltan: [] };
  const red = g.marca === "visa" ? "visa" : "mastercard";
  // Sin instrumento: crédito si nombra niveles (solo las de crédito los
  // tienen); si no, crédito y débito ("tarjetas BROU Recompensa Mastercard").
  const instrumentos: Instrumento[] =
    g.instrumentos.length > 0 ? g.instrumentos : g.niveles.length > 0 ? ["credito"] : ["credito", "debito"];
  const ids: string[] = [];
  const faltan: string[] = [];
  const nombre = (x: string) => `${g.marca} ${x}`;
  for (const inst of instrumentos) {
    let ps = activos.filter((p) => p.red === red && p.instrumento === inst && p.id !== "brou-mi-brou");
    // "Recompensa Débito" es la del programa; "Mastercard Débito" a secas, las dos.
    if (g.marca === "recompensa" && inst === "debito") ps = ps.filter((p) => p.id === "brou-recompensa-debito");
    if (inst === "credito" && g.niveles.length > 0) {
      const delNivel = (n: Nivel) => ps.filter((p) => (n === "clasica" ? p.tier === null : p.tier === n));
      for (const n of g.niveles) {
        if (delNivel(n).length === 0 && !(g.marca === "visa" && n === "black")) faltan.push(nombre(`${inst} ${n}`));
      }
      ps = g.niveles.flatMap(delNivel);
    }
    if (ps.length === 0 && g.niveles.length === 0) faltan.push(nombre(inst));
    ids.push(...ps.map((p) => p.id));
  }
  return { ids, faltan };
}

/** "Todas las tarjetas del Banco República", "los medios de pago de Tu Banco", "tarjetas BROU". */
const GENERICA = /todas las tarjetas|medios de pago|tarjetas (?:del (?:brou|banco)|brou\b)|con brou\b|tarjetas seleccionadas/;

/**
 * Las tarjetas que nombra una frase. `ids` vacío con `nombra` en false: no
 * nombra ninguna (vale con cualquiera, o las pone otra línea). Las PYME y
 * corporativas no están en el catálogo y se dejan afuera; una combinación
 * que no existe ("VISA Infinite") va a `desconocidos`. Exportada para los tests.
 */
export function tarjetasDe(frase: string): {
  ids: string[];
  desconocidos: string[];
  nombra: boolean;
  generica: boolean;
  /** Solo nombra tarjetas PYME o corporativas: un beneficio para empresas. */
  soloEmpresas: boolean;
} {
  const grupos = gruposDe(frase);
  const deEmpresa = (g: Grupo) => g.otra === "pyme" || !!g.otra?.startsWith("corporativ");
  const ids = new Set<string>();
  const desconocidos: string[] = [];
  for (const g of grupos) {
    if (deEmpresa(g)) continue;
    if (g.otra === "agro") {
      // "BROU Agro VISA": las reglas (y los alias del backoffice) deciden.
      const r = mapearProductos(FUENTE, [`agro ${g.marca}`]);
      r.ids.forEach((id) => ids.add(id));
      desconocidos.push(...r.desconocidos);
      continue;
    }
    const ps = productosDe(g);
    ps.ids.forEach((id) => ids.add(id));
    desconocidos.push(...ps.faltan);
  }
  // "Todas las tarjetas de crédito y débito del Banco República": cualquiera.
  if (grupos.length > 0 && grupos.every((g) => g.marca === "todas") && /todas las tarjetas/.test(sinAcentos(frase))) {
    return { ids: [], desconocidos: [], nombra: false, generica: true, soloEmpresas: false };
  }
  return {
    ids: [...ids].sort(),
    desconocidos,
    nombra: grupos.length > 0,
    generica: grupos.length === 0 && GENERICA.test(sinAcentos(frase)),
    soloEmpresas: grupos.length > 0 && grupos.every(deEmpresa),
  };
}

// ---------------------------------------------------------------- tramos

interface Tramo {
  c: Clausula;
  linea: string;
  dias: number[];
  ids: string[];
  desconocidos: string[];
  soloEmpresas: boolean;
  /** Las tarjetas salen de la propia línea (no de las vecinas ni de las condiciones). */
  propias: boolean;
}

/** Un porcentaje que no es un descuento: "no abonás la comisión del 3% + IVA". */
const NO_ES_DESCUENTO = /comision del|\+ iva|puntos|recargo del/;

function marcas(linea: string): Clausula[] {
  if (NO_ES_DESCUENTO.test(sinAcentos(linea))) return [];
  return clausulas(linea);
}

/**
 * Los tramos: cada línea del cuerpo con un porcentaje, 2x1 o cuotas. Una
 * línea con tramo pero sin tarjetas las toma de las líneas sin tramo del
 * cuerpo ("Tarjetas de Crédito VISA y BROU Recompensa Mastercard." debajo de
 * "Aprovechá 2x1 en entradas pagando con:"; "abonando con tarjetas … accedé
 * a los siguientes beneficios:" arriba de "25% de dto. durante marzo…"). Sin
 * líneas con tramo en el cuerpo, la del resumen.
 */
function tramosDe(d: DatosBrou): Tramo[] {
  let lineas = d.descripcion.filter((l) => marcas(l).length > 0);
  // "Aprovechá hasta 25% de dto. con múltiples medios de pago BROU:" presenta
  // las líneas que siguen: no es un tramo.
  const presenta = (l: string) => /:\s*$/.test(l) && !tarjetasDe(l).nombra;
  if (lineas.some((l) => !presenta(l))) lineas = lineas.filter((l) => !presenta(l));
  if (lineas.length === 0 && marcas(d.resumen).length > 0) lineas = [d.resumen];
  // Las tarjetas que nombran las líneas sin tramo del cuerpo; si ninguna ni
  // tampoco las de los tramos, las de las condiciones ("Beneficios
  // exclusivos para Tarjetas de Crédito…").
  const nombran = (ls: string[]) => ls.filter((l) => marcas(l).length === 0).map((l) => tarjetasDe(l)).filter((t) => t.nombra);
  let deOtras = nombran(d.descripcion);
  if (deOtras.length === 0 && !lineas.some((l) => tarjetasDe(l).nombra)) deOtras = nombran(d.condiciones);
  const comunes = {
    ids: [...new Set(deOtras.flatMap((t) => t.ids))].sort(),
    desconocidos: deOtras.flatMap((t) => t.desconocidos),
    soloEmpresas: deOtras.length > 0 && deOtras.every((t) => t.soloEmpresas),
  };
  const diasDelResumen = diasDe(d.resumen);

  const out: Tramo[] = [];
  for (const linea of lineas) {
    for (const c of marcas(linea)) {
      // Las tarjetas de la cláusula; si no dice, las de la línea entera
      // ("20% y 15% de descuento con tarjetas…"), y si tampoco, las comunes.
      let t = tarjetasDe(c.texto);
      if (!t.nombra) t = tarjetasDe(linea);
      const propias = t.nombra ? t : deOtras.length > 0 ? comunes : t;
      const dias = /todos los d[ií]as/i.test(linea) ? [] : diasDe(linea).length > 0 ? diasDe(linea) : diasDelResumen;
      out.push({ c, linea, dias, ids: propias.ids, desconocidos: propias.desconocidos, soloEmpresas: propias.soloEmpresas, propias: t.nombra });
    }
  }
  // Una línea sin tarjetas propias que repite el tramo de otra que sí las
  // dice ("tenés 2x1 en entradas … en" arriba de "2x1 … con tarjetas VISA…")
  // es una presentación.
  return out.filter(
    (t) => t.propias || !out.some((o) => o.propias && o.c.tipo === t.c.tipo && o.c.porcentaje === t.c.porcentaje && o.c.cuotas === t.c.cuotas),
  );
}

const cubreDias = (a: number[], b: number[]) => a.length === 0 || (b.length > 0 && b.every((x) => a.includes(x)));

/**
 * Saca de cada tramo las tarjetas con un porcentaje mayor en la ficha (los
 * mismos días o más) sobre lo mismo: "20% en las entregas iniciales" no le
 * quita nada a "15% en el resto de los tratamientos".
 */
function sinDominados(tramos: Tramo[]): Tramo[] {
  return tramos
    .map((t) => {
      if (t.c.tipo !== "porcentaje" || t.ids.length === 0) return t;
      const mejores = tramos.filter(
        (o) =>
          o !== t &&
          o.c.tipo === "porcentaje" &&
          (o.c.porcentaje ?? 0) > (t.c.porcentaje ?? 0) &&
          cubreDias(o.dias, t.dias) &&
          objetoDe(o.c) === objetoDe(t.c),
      );
      const ids = t.ids.filter((id) => !mejores.some((o) => o.ids.includes(id)));
      return ids.length > 0 ? { ...t, ids } : null;
    })
    .filter((t): t is Tramo => t !== null);
}

/** Dos tramos iguales (el mismo 15% para iPhone y para PlayStation) son uno. */
function sinRepetidos(tramos: Tramo[]): Tramo[] {
  const vistos = new Set<string>();
  return tramos.filter((t) => {
    const k = JSON.stringify([t.c.tipo, t.c.porcentaje, t.c.cuotas, t.ids, t.dias]);
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

// ---------------------------------------------------------------- comunes

/**
 * El comercio, del nombre de la ficha sin lo que es de la campaña: "Beneficios
 * en Cifer" → Cifer, "Semana BROU en DISTRICOMP" → DISTRICOMP, "Adobe PYMES"
 * → Adobe, "Aprendé inglés en Executive" → Executive. Exportada para los tests.
 */
export function comercioDe(nombre: string): string {
  return nombre
    .replace(/^(?:beneficios?\s+(?!de\b|para\b)(?:en\s+)?|semana brou en\s+|aprend[eé] \S+ en\s+)/i, "")
    .replace(/\s+(?:pymes|semana brou)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function vigenciaDe(d: DatosBrou): { desde: string | null; hasta: string | null } {
  const cond = d.condiciones.join("\n");
  const deCond = vigenciaDelLegal(cond);
  if (deCond.desde || deCond.hasta) return deCond;
  // "Vigencia: hasta el 31/05/2027", "Vigencia: 31/12/2026", "Vigencia hasta el 28/2/27".
  const hasta = sinAcentos(cond).match(/vigencia[^0-9\n]{0,20}?(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (hasta) return { desde: null, hasta: iso(hasta[3]!, Number(hasta[2]), hasta[1]!) };
  const deDesc = vigenciaDelLegal(d.descripcion.join("\n"));
  if (deDesc.desde || deDesc.hasta) return deDesc;
  const cab = d.vigencia?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  return { desde: null, hasta: cab ? iso(cab[3]!, Number(cab[2]), cab[1]!) : null };
}

function acumulableDe(texto: string): boolean | null {
  const t = sinAcentos(texto);
  if (/no (?:es )?(?:combinable ni )?acumulable|no se acumula|no acumula/.test(t)) return false;
  if (/\bes acumulable\b/.test(t)) return true;
  return null;
}

/**
 * Presencial salvo que el texto hable de comprar por internet: "compras web",
 * "código de descuento", "la app", "facturación anual". Con eso y el local
 * ("tanto para compras web como presenciales", "en web y punto de venta"),
 * ambos. "No aplica a compras web" o "(no web)" no cuentan.
 */
function canalDe(texto: string): BeneficioNormalizado["canal"] {
  const t = sinAcentos(texto)
    .replace(/no aplica (?:a|para) compras (?:realizadas )?(?:en la )?(?:web|online)|\(no web\)|plataformas de pago online/g, " ");
  const web = /compras? (?:web|online|por internet)|tienda online|venta online|codigo de descuento|\bla app\b|en la aplicacion|facturacion anual|\ben web\b/.test(t);
  if (!web) return "presencial";
  return /presencial|punto de venta|en locales?\b|tienda fisica/.test(t) ? "ambos" : "online";
}

/** "Tope del descuento tarjetas de crédito …: $ 1.000" nombra tarjetas sin el "para" que espera `topesDelLegal`. */
function topesDe(condiciones: string[]): TopeLeido[] {
  const texto = condiciones.join("\n").replace(/\bto pe\b/gi, "Tope").replace(/\bu\$s\b/gi, "USD").replace(/(tope del descuento) (tarjetas?)/gi, "$1 para $2");
  return topesDelLegal(texto, (f) => tarjetasDe(f).ids);
}

/** Los topes que pueden ser del tramo: los generales y los de tarjetas que lo incluyen. */
function topeDe(topes: TopeLeido[], t: Tramo): { tope: TopeLeido | null; ambiguo: boolean } {
  if (t.c.tipo !== "porcentaje") return { tope: null, ambiguo: false };
  // Los que nombran tarjetas y las incluyen a todas; de esos, el que nombra
  // menos (SODRE: "crédito y débito VISA, Recompensa: $1.000" y "Platino y
  // Black…: $4.000"; el 50% es de las Platino y Black). Si ninguno, los generales.
  const incluyen = topes.filter((x) => x.tarjetas !== null && t.ids.length > 0 && t.ids.every((id) => x.tarjetas!.includes(id)));
  const minimo = Math.min(...incluyen.map((x) => x.tarjetas!.length));
  const posibles =
    incluyen.length > 0
      ? incluyen.filter((x) => x.tarjetas!.length === minimo).map((x) => ({ ...x, tarjetas: t.ids }))
      : topes.filter((x) => x.tarjetas === null);
  return topeDelTramo(posibles, { pct: t.c.porcentaje!, ids: t.ids });
}

/** Lo que se compra: "2x1 en entradas", "20% de descuento en las entregas iniciales…". */
function objetoDe(c: Clausula): string | null {
  const objeto = c.texto
    .replace(/[*“”"]/g, "")
    .match(/\ben\s+(?!el punto|los puntos|la zona|todos los|todas las compras\b)(.+?)(?=\s+(?:con|abonando|pagando|para|todos|los|durante|de (?:lunes|martes|miercoles|miércoles|jueves|viernes|sabados?|sábados?|domingos?))\b|[,.;:]|$)/i)?.[1]
    ?.trim();
  return objeto && !/tarjeta|brou|banco/i.test(objeto) ? objeto : null;
}

function tituloDe(c: Clausula, dias: number[]): string {
  let valor: string;
  if (c.tipo === "cuotas") {
    const sinQue = /sin inter[eé]s/i.test(c.texto) ? " sin interés" : /sin recargo/i.test(c.texto) ? " sin recargo" : "";
    valor = `${c.hasta ? "Hasta " : ""}${c.cuotas} cuotas${sinQue}`;
  } else if (c.tipo === "2x1") {
    valor = "2x1";
  } else {
    valor = `${c.hasta ? "Hasta " : ""}${c.porcentaje}% de descuento`;
  }
  const objeto = objetoDe(c);
  const en = objeto ? ` en ${objeto}` : c.tipo === "2x1" ? " en entradas" : "";
  return `${valor}${en}${diasEnTitulo(dias)}`.slice(0, 160);
}

/** Categoría de un comercio nuevo, de la miga de pan de la ficha. Si ya existe, la base no la pisa. */
const CATEGORIAS: Record<string, string> = {
  ensenanza: "servicios",
  espectaculos: "entretenimiento",
  gastronomia: "restaurantes",
  hogar: "hogar-deco",
  hoteleria: "viajes",
  moda: "indumentaria",
  "salud y estetica": "salud-belleza",
  tecnologia: "electro-tecnologia",
  transporte: "transporte",
  "viajes y turismo": "viajes",
  turismo: "viajes",
};

function esBrou(d: unknown): d is DatosBrou {
  const x = d as DatosBrou | undefined;
  return !!x && typeof x.nombre === "string" && Array.isArray(x.valores) && Array.isArray(x.descripcion) && Array.isArray(x.condiciones);
}

/** "25 % DTO" → 25. */
const valorDeBadge = (v: string) => Number(v.match(/(\d{1,2})\s*%/)?.[1] ?? NaN);

export function normalizarBrou(crudo: Crudo): Extraido {
  const d = crudo.datos;
  if (!esBrou(d)) throw new Error(`brou: ${crudo.external_id} no trae los datos de la ficha`);

  const leidos = tramosDe(d);
  const badges = d.valores.map(valorDeBadge).filter((n) => !Number.isNaN(n));
  if (leidos.length === 0) {
    // Sin tramos pero con un badge de descuento: algo dice que hay un
    // beneficio y no lo supimos leer.
    if (badges.length > 0) throw new PaginaPendiente(`badges ${badges.join(", ")}% sin tramos en el texto`);
    return { crudo, comercio: null, beneficios: [], productos_desconocidos: [], es_beneficio: false };
  }
  // Solo con tarjetas PYME o corporativas: es para empresas, no está en el catálogo.
  if (leidos.every((t) => t.soloEmpresas)) {
    return { crudo, comercio: null, beneficios: [], productos_desconocidos: [], es_beneficio: false };
  }
  // Cada badge tiene que estar en el texto; si no, se leyó mal.
  const pcts = new Set(leidos.map((t) => t.c.porcentaje));
  const faltan = badges.filter((b) => !pcts.has(b));
  if (faltan.length > 0) throw new PaginaPendiente(`badges ${faltan.join(", ")}% que no aparecen en el texto`);
  // Un tramo sin tarjetas reconocibles y que tampoco dice "todas las tarjetas".
  const mudo = leidos.find((t) => t.ids.length === 0 && t.desconocidos.length === 0 && !tarjetasDe(t.linea).generica && !GENERICA.test(sinAcentos(`${d.resumen} ${d.descripcion.join(" ")}`)));
  if (mudo) throw new PaginaPendiente(`"${mudo.linea.slice(0, 80)}" no dice con qué tarjetas`);
  // Descuentos en los comercios adheridos de un rubro ("30% de descuento en
  // Supermercados, Almacenes y Carnicerías adheridas"): no son de un comercio.
  const deRubro = leidos.find((t) => /\b(?:supermercados|farmacias|comercios|almacenes|carnicerias)\b[^.]*\badherid/i.test(sinAcentos(t.linea)));
  if (deRubro) throw new PaginaPendiente(`"${deRubro.linea.slice(0, 80)}" es de los adheridos de un rubro`);
  // Porcentajes que dependen de algo que el esquema no tiene (ser socio, el mes).
  const condicionado = leidos.find((t) => /\bsocios?\b|durante (?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre|el resto)/i.test(t.linea));
  if (condicionado) throw new PaginaPendiente(`"${condicionado.linea.slice(0, 80)}" depende de ser socio o del mes`);

  const tramos = sinRepetidos(sinDominados(leidos));
  const nombre = comercioDe(d.nombre);
  const key = slugificar(nombre);
  const todo = [d.resumen, ...d.descripcion, ...d.condiciones].join("\n");
  const vigencia = vigenciaDe(d);
  const canal = canalDe(todo);
  const acumulable = acumulableDe(todo);
  const topes = topesDe(d.condiciones);
  const legales = d.condiciones.join("\n");

  const beneficios: BeneficioNormalizado[] = [];
  const desconocidos: string[] = [];
  for (const [i, t] of tramos.entries()) {
    desconocidos.push(...t.desconocidos);
    const r = topeDe(topes, t);
    if (r.ambiguo) throw new PaginaPendiente(`los legales publican varios topes y no se sabe cuál es el del ${t.c.porcentaje}%`);
    const candidato = {
      comercio_key: key,
      titulo: tituloDe(t.c, t.dias),
      descuento_raw: t.linea.replace(/^[•\-\s]+/, ""),
      porcentaje: t.c.porcentaje,
      cuotas: t.c.cuotas,
      tipo: t.c.tipo,
      dias_semana: t.dias,
      vigencia_desde: vigencia.desde,
      vigencia_hasta: sinFechaComodin(vigencia.hasta),
      departamentos: [],
      productos_elegibles: t.ids,
      ...topeDevolucion({
        tipo: t.c.tipo,
        porcentaje: t.c.porcentaje,
        tope_monto: r.tope?.monto ?? null,
        tope_moneda: r.tope?.moneda ?? null,
        tope_sobre: r.tope?.sobre ?? null,
        tope_periodo: r.tope?.periodo ?? null,
      }),
      canal,
      mecanica: [],
      acumulable,
      compra_minima: null,
      requiere_activacion: false,
      legales_raw: legales || null,
      como_usarlo: [],
      url_fuente: crudo.url_fuente,
    };
    const parsed = BeneficioNormalizadoSchema.safeParse(candidato);
    if (parsed.success) beneficios.push(parsed.data);
    else desconocidos.push(`tramo ${i}: ${parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}`);
  }
  return {
    crudo,
    comercio: beneficios.length > 0 ? { key, nombre, categoria: CATEGORIAS[sinAcentos(d.categoria ?? "").trim()] ?? "otros" } : null,
    beneficios,
    productos_desconocidos: [...new Set(desconocidos)],
  };
}
