import type { BeneficioNormalizado } from "@tarjetazo/core";
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

/** "Tarjetas de Crédito Internacional, Oro, Pymes y Corporativas" → ids. */
function productos(frase: string): { ids: string[]; desconocidos: string[] } {
  const f = sinAcentos(frase);
  const ids = new Set<string>();
  const desconocidos: string[] = [];
  if (/debito/.test(f)) ids.add("bbva-debito");
  if (/internacional/.test(f)) ids.add("bbva-credito");
  if (/\boro\b/.test(f)) ids.add("bbva-oro");
  if (/platinum/.test(f)) ids.add("bbva-platinum");
  if (/black/.test(f)) ids.add("bbva-black");
  if (/infinite/.test(f)) ids.add("bbva-infinite");
  // "Tarjetas de Crédito BBVA" a secas: todas las de crédito.
  if (/credito/.test(f) && ids.size === 0) {
    for (const id of ["bbva-credito", "bbva-oro", "bbva-platinum", "bbva-black", "bbva-infinite"]) ids.add(id);
  }
  // Pymes y corporativas van siempre junto a Internacional/Oro; no son
  // tarjetas de consumo y no se listan aparte.
  if (/comunidad plus/.test(f)) ids.add("bbva-comunidad-plus");
  if (/sodimac/.test(f)) ids.add("bbva-sodimac");
  if (/consolid/.test(f)) ids.add("bbva-consolid-travel");
  return { ids: [...ids], desconocidos };
}

/** "Descuentos todos los días de la semana" | "Descuentos de Lunes a Viernes" | "Descuentos los Sábados". */
function dias(encabezado: string): number[] {
  const e = sinAcentos(encabezado);
  if (/todos los dias/.test(e)) return [];
  const rango = e.match(/de (lunes|martes|miercoles|jueves|viernes|sabado|domingo) a (lunes|martes|miercoles|jueves|viernes|sabado|domingo)/);
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

function fecha(texto: string): string | null {
  const m = texto.match(/(\d{1,2}) de (\w+) (?:de )?(\d{4})/i);
  if (!m) return null;
  const mes = MESES[sinAcentos(m[2]!)];
  if (!mes) return null;
  return `${m[3]}-${String(mes).padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
}

/**
 * Tope por grupo de tarjetas, leyendo los legales en orden: cada encabezado de
 * grupo ("TARJETAS DE DÉBITO", "Tarjetas de crédito Infinite, Platinum y
 * Black") abre un bloque y el primer "tope de devolución será de N pesos" que
 * sigue es el de ese grupo. BBVA suele partir el descuento en dos mitades: una
 * en el local sin tope y otra en el estado de cuenta con tope mensual; el tope
 * que guardamos es ese.
 */
function topes(legales: string): Map<string, number | null> {
  const out = new Map<string, number | null>();
  let grupo = "";
  for (const linea of legales.split("\n")) {
    const l = sinAcentos(linea);
    if (/^tarjetas? de/.test(l) || /^tarjetas de cr/.test(l)) {
      grupo = /platinum|black|infinite/.test(l) ? "alto" : /debito/.test(l) ? "debito" : /internacional|oro|credito/.test(l) ? "credito" : grupo;
      continue;
    }
    const m = l.match(/tope de devolucion sera de ([\d.]+)\s*pesos/);
    if (m && grupo && !out.has(grupo)) out.set(grupo, Number(m[1]!.replace(/\./g, "")));
    else if (/sin tope de devolucion\.?$/.test(l) && grupo && !out.has(grupo)) out.set(grupo, null);
  }
  return out;
}

export function normalizarBbva(crudo: Crudo): Extraido {
  const lineas = crudo.contenido.split("\n").map((l) => l.trim()).filter(Boolean);
  const nombre = lineas[0] ?? "";
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
  let calificador = "";
  for (const l of lineas) {
    if (/^Descuentos?\b/i.test(l) && /:$/.test(l)) { diasActuales = dias(l); continue; }
    if (/^(Productos|Solo|Sólo|Únicamente|Excepto)\b/i.test(l) && !/% ?Off/i.test(l)) { calificador = l.replace(/:$/, ""); continue; }
    const cuotas = l.match(/^Hasta (\d{1,2}) cuotas sin inter[eé]s.*con (.+?)\.?$/i);
    if (cuotas) {
      const { ids } = productos(cuotas[2]!);
      tramos.push({
        comercio_key: slugificar(nombre), titulo: `${cuotas[1]} cuotas sin interés`, descuento_raw: l,
        porcentaje: null, cuotas: Number(cuotas[1]), tipo: "cuotas", dias_semana: diasActuales,
        vigencia_desde: null, vigencia_hasta, departamentos: departamentos.length === 1 ? (departamentos as BeneficioNormalizado["departamentos"]) : [],
        productos_elegibles: ids, tope_monto: null, tope_periodo: null, canal: "presencial", mecanica: [],
        acumulable: null, compra_minima: null, requiere_activacion: false, legales_raw, como_usarlo: [], url_fuente: crudo.url_fuente,
      });
      continue;
    }
    // "15% Off en Alquiler de autos en Uruguay" (sin tarjeta): todas las de crédito.
    // Lo que aplica en otro país no es un beneficio de acá.
    const m = l.match(/^(?:(.*?)\s)?(\d{1,2})\s*%\s*Off (?:con|en|sobre) (.+)$/i);
    if (!m) continue;
    // A veces los días van adelante del tramo: "Martes y Jueves 10% Off con…".
    const diasDelTramo = m[1] ? dias(m[1]) : [];
    if (m[1] && diasDelTramo.length === 0) continue;
    if (/estados unidos|argentina|brasil|chile|exterior/i.test(m[2]!)) continue;
    const porcentaje = Number(m[2]);
    const { ids, desconocidos: d } = /tarjeta/i.test(m[3]!)
      ? productos(m[3]!)
      : { ids: ["bbva-credito", "bbva-oro", "bbva-platinum", "bbva-black", "bbva-infinite"], desconocidos: [] };
    desconocidos.push(...d);
    const f = sinAcentos(m[3]!);
    const clave = /platinum|black|infinite/.test(f) ? "alto" : /debito/.test(f) ? "debito" : "credito";
    const tope_monto = tope.get(clave) ?? null;
    tramos.push({
      comercio_key: slugificar(nombre),
      titulo: `${porcentaje}% de descuento${calificador ? ` (${calificador.toLowerCase()})` : ""}`,
      descuento_raw: calificador ? `${calificador}: ${l}` : l,
      porcentaje,
      cuotas: null,
      tipo: "porcentaje",
      dias_semana: diasDelTramo.length ? diasDelTramo : diasActuales,
      vigencia_desde: null,
      vigencia_hasta,
      departamentos: departamentos.length === 1 ? (departamentos as BeneficioNormalizado["departamentos"]) : [],
      productos_elegibles: ids,
      tope_monto,
      tope_periodo: tope_monto != null ? "mes" : null,
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
    comercio: tramos.length > 0 ? { key: slugificar(nombre), nombre, categoria } : null,
    beneficios: tramos,
    productos_desconocidos: [...new Set(desconocidos)],
  };
}
