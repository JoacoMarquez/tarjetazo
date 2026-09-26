import type { BeneficioNormalizado } from "@tarjetazo/core";
import { bajarTexto } from "../http.js";
import { htmlATexto } from "../texto.js";
import { slugificar } from "../slug.js";
import type { Crudo, Extraido } from "../tipos.js";

/**
 * ANDA (#10). La página de descuentos enlaza una categoría por "día"
 * ("Jueves ANDA", "Todos los días", "Circuito de la diversión"). Las grandes
 * no traen la lista en el HTML: la pide el navegador al admin-ajax.php de
 * WordPress (`filtrar_diasDescuentos`), que devuelve JSON con título,
 * porcentaje, condiciones y localidad. Se pide una vez por departamento, y así
 * cada local sale con su departamento sin adivinarlo. Las campañas chicas
 * listan sus fichas en el HTML y se leen de ahí. Todo sin modelo.
 *
 * Las categorías se leen de la página cada vez: ANDA arma una nueva por mes
 * ("jueves-anda-octubre") y la categoría padre mezcla copias y campañas
 * vencidas. Una marca con locales en varias localidades es un solo beneficio.
 */

const BASE = "https://anda.com.uy";
const LANDING = `${BASE}/tarjeta-de-credito/dias-de-descuentos/`;
const AJAX = `${BASE}/wp-admin/admin-ajax.php`;

const CREDITO = ["anda-credito", "anda-visa"];
const PREPAGA = "anda-deanda";

export interface ItemAnda {
  titulo: string;
  /** "20", "" en las fichas de HTML (el número va en el título). */
  descuento: string;
  bases: string;
  localidad: string;
  link: string;
  /** El departamento del filtro con el que vino ("Paysandú"), o null. */
  departamento: string | null;
  categoria: { slug: string; nombre: string };
}

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const texto = (html: string) => htmlATexto(html).replace(/\s+/g, " ").trim();

/** Los días que dice la categoría: "jueves-anda-octubre" es jueves. */
function tipoDeDia(slug: string): string {
  return /jueves/.test(slug) ? "jueves" : slug;
}

export function categoriasDeLanding(html: string): { slug: string; url: string }[] {
  const out = new Map<string, string>();
  for (const m of html.matchAll(/href="((?:https:\/\/anda\.com\.uy)?\/categoria\/dias-de-descuentos\/([a-z0-9-]+)\/?)"/g)) {
    if (m[2] !== "feed") out.set(m[2]!, new URL(m[1]!, BASE).toString());
  }
  return [...out].map(([slug, url]) => ({ slug, url }));
}

function nombreDeCategoria(html: string, slug: string): string {
  const titulo = html.match(/<title>([^<]*?)(?: archivos)? - ANDA<\/title>/)?.[1];
  return titulo ? texto(titulo) : slug;
}

/** Una ficha de campaña: "Mc Donald’s: 30% de descuento" y el texto de las condiciones. */
export function itemDeFicha(url: string, html: string, categoria: ItemAnda["categoria"]): ItemAnda | null {
  const i = html.indexOf('id="main-content"');
  const f = html.indexOf('id="main-footer"');
  const lineas = htmlATexto(html.slice(i >= 0 ? i : 0, f > i ? f : undefined))
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^id="main-content">$/.test(l));
  const encabezado = lineas[0] ?? "";
  const [titulo, promo] = encabezado.split(/:\s*/, 2);
  if (!titulo) return null;
  return {
    titulo: titulo.trim(),
    descuento: promo?.match(/(\d{1,2})\s*%/)?.[1] ?? (/2\s*[x×]\s*1/i.test(promo ?? "") ? "2x1" : ""),
    bases: lineas.slice(1).join(" "),
    localidad: "",
    link: url,
    departamento: null,
    categoria,
  };
}

export async function fetchAnda(): Promise<Crudo[]> {
  const landing = await bajarTexto(LANDING);
  const items: ItemAnda[] = [];
  for (const cat of categoriasDeLanding(landing)) {
    const html = await bajarTexto(cat.url);
    const categoria = { slug: cat.slug, nombre: nombreDeCategoria(html, cat.slug) };
    const id = html.match(/id="idcategoria"[^>]*>(\d+)</)?.[1];
    if (id) {
      const deptos = [...(html.match(/<select id="dias-descuentos-departamentos">([\s\S]*?)<\/select>/)?.[1] ?? "")
        .matchAll(/<option value="([^"]+)">/g)].map((m) => m[1]!);
      for (const departamento of deptos) {
        const json = await bajarTexto(AJAX, 3, {
          formulario: { action: "filtrar_diasDescuentos", departamento, dia: id, localidad: "" },
        });
        for (const v of Object.values(JSON.parse(json) as Record<string, unknown>)) {
          const o = v as Partial<ItemAnda> | null;
          if (!o || typeof o !== "object" || !o.link || !o.titulo) continue;
          items.push({
            titulo: texto(o.titulo),
            descuento: String(o.descuento ?? ""),
            bases: texto(o.bases ?? ""),
            localidad: texto(o.localidad ?? ""),
            link: o.link,
            departamento,
            categoria,
          });
        }
      }
    } else {
      const fichas = [...new Set([...html.matchAll(/href="([^"]+\/dias-de-descuentos\/[^"]+)"[^>]*class="more-link"/g)].map((m) => m[1]!))];
      for (const url of fichas) {
        try {
          const item = itemDeFicha(url, await bajarTexto(url), categoria);
          if (item) items.push(item);
        } catch (e) {
          console.error(`  anda ${url}: ${String(e).slice(0, 120)}`);
        }
      }
    }
  }
  const crudos = crudosDeItems(items);
  const limite = Number(process.env.SCRAPER_LIMITE) || Infinity;
  return crudos.slice(0, limite);
}

/**
 * Una página por marca y tipo de día: los 5 locales de una óptica con el mismo
 * 20 % los jueves son un beneficio con 5 localidades. Si una marca tiene dos
 * porcentajes distintos, son dos páginas. Las copias que ANDA sube dos veces
 * ("…-rio-branco-3") se juntan solas.
 */
export function crudosDeItems(items: ItemAnda[]): Crudo[] {
  const grupos = new Map<string, ItemAnda[]>();
  for (const it of items) {
    const clave = `${tipoDeDia(it.categoria.slug)}|${slugificar(it.titulo)}|${it.descuento}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), it]);
  }
  const porMarca = new Map<string, number>();
  for (const clave of grupos.keys()) {
    const marca = clave.split("|").slice(0, 2).join("|");
    porMarca.set(marca, (porMarca.get(marca) ?? 0) + 1);
  }

  const crudos: Crudo[] = [];
  for (const [clave, grupo] of grupos) {
    const [dia, marca, descuento] = clave.split("|") as [string, string, string];
    const primero = grupo[0]!;
    const locales = [...new Set(grupo.map((g) => [g.localidad, g.departamento].filter(Boolean).join(" · ")).filter(Boolean))].sort();
    const deptos = [...new Set(grupo.map((g) => g.departamento).filter((d): d is string => Boolean(d)))].sort();
    const bases = [...new Set(grupo.map((g) => g.bases).filter(Boolean))].sort();
    const contenido = [
      primero.titulo,
      `Categoría según ANDA: ${primero.categoria.nombre} (${primero.categoria.slug}).`,
      `Descuento: ${descuento === "2x1" ? "2x1" : descuento ? `${descuento}%` : "sin dato"}`,
      `Departamentos según ANDA: ${deptos.map(slugificar).join(", ") || "sin dato"}.`,
      ...(locales.length > 0 ? ["Locales:", ...locales.map((l) => `- ${l}`)] : []),
      "Condiciones:",
      ...bases,
    ].join("\n");
    // Con un solo porcentaje por marca el id no lo lleva: si ANDA cambia el
    // 20 por un 25, es el mismo beneficio actualizado.
    const conPct = (porMarca.get(`${dia}|${marca}`) ?? 0) > 1;
    crudos.push({
      fuente_id: "anda",
      external_id: slugificar([dia, marca, conPct ? descuento : ""].filter(Boolean).join("-")),
      url_fuente: primero.link,
      contenido,
      fetched_at: new Date().toISOString(),
    });
  }
  return crudos.sort((a, b) => a.external_id.localeCompare(b.external_id));
}

/** Rubro por palabras del nombre: ANDA no publica el rubro. */
const RUBRO: [RegExp, string][] = [
  [/farmac|drogueria/, "farmacias"],
  [/optic|optil|optis|optiv|vision|pupila|visual ?shop|lentes/, "salud-belleza"],
  [/ortopedia|clinica|consultorio|audifono|\bsam\b|prontopedia|nails|perfum|fragancia|cosme|salon|belleza|estetica/, "salud-belleza"],
  [/veterinari|animal|mascota|agro/, "mascotas"],
  [/super ?mercado|supermax|minimarket|mercadito|al costo|almacen|economia|autoservice|g market|el dorado|el colmenar/, "supermercados"],
  [/combustible|estacion parada/, "combustible"],
  [/resto|cafe|postre|heladeria|grido|mc ?donald/, "restaurantes"],
  [/cine|teatro|gravity|mundo cartoon|bus turistico|entretenimiento/, "entretenimiento"],
  [/moto|repuesto|neumatic|alineaci|lubricentro|mecanica|bike|bici|credibike/, "servicios"],
  [/deport|sport|athletic|fitness/, "deportes"],
  [/libreria|libros|papeleria|juguete|pequenos genios|mundo magico|copy|impresos|foto|kodak/, "libreria-juguetes"],
  [/pañal|panal|bebe|baby|kids|ninos|bambini|chiquitos|ciguena/, "indumentaria"],
  [/celu|telefonia|tecno|informatica|digital|electro|electronica|audio|laser tv|amplificador|\bpc\b|macrotech|redtec|oxtore|unlock|movil|rodwil|digitech|info shop/, "electro-tecnologia"],
  [/muebl|colchon|confort|hogar|home|deco|casa |barraca|ferret|ferre|pintur|sanitaria|tornill|herramient|luz|electricidad|vidri|polyfom|inhaus|bazar|regalo|variedades|baratillo|ofertas|don de todo|todo aca|\bideas\b|florer/, "hogar-deco"],
  [/calzad|zapat|foot|dapie|moda|boutique|tienda|fashion|style|denim|talabarter|joya|joyeria|bijou|accesorios|reloj|uniforme|outlet|store\b|cuatroases|polanco|paprika|guapa|lemon|urban haus|pappolino|zenit|enigma|asterisco|garabatos/, "indumentaria"],
];

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, setiembre: 9, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const DIAS: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };

/** "31/12/26", "31/12/2026", "8/8/26". */
function fecha(d: string, m: string, a: string): string {
  return `${a.length === 2 ? `20${a}` : a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function vigencia(t: string): { desde: string | null; hasta: string | null } {
  const F = String.raw`(\d{1,2})\/(\d{1,2})\/(\d{2,4})`;
  const rango = t.match(new RegExp(`(?:del|entre el) ${F} (?:al|y el) ${F}`));
  if (rango) return { desde: fecha(rango[1]!, rango[2]!, rango[3]!), hasta: fecha(rango[4]!, rango[5]!, rango[6]!) };
  // "del 1.º de octubre al 31 de diciembre de 2026": el año del final vale
  // para los dos.
  const L = String.raw`(\d{1,2})(?:\.?\s*[º°o])?\s+de\s+([a-z]+)`;
  const letras = t.match(new RegExp(`del ${L}(?: de (\\d{4}))? al ${L} de (\\d{4})`));
  if (letras && MESES[letras[2]!] && MESES[letras[5]!]) {
    const anio = letras[3] ?? letras[6]!;
    return {
      desde: fecha(letras[1]!, String(MESES[letras[2]!]), anio),
      hasta: fecha(letras[4]!, String(MESES[letras[5]!]), letras[6]!),
    };
  }
  const hasta = t.match(new RegExp(`hasta el ${F}`));
  return { desde: null, hasta: hasta ? fecha(hasta[1]!, hasta[2]!, hasta[3]!) : null };
}

/** "El tope de descuento es de $2.000 por compra", "tope … $800 por cuenta". */
function tope(t: string): { monto: number; periodo: BeneficioNormalizado["tope_periodo"] } | null {
  const m = t.match(/tope[^$]{0,40}\$\s*(\d{1,3}(?:[.,]\d{3})+|\d+)(?:[^.\n]{0,20}?por (compra|cuenta|mes|dia))?/);
  if (!m) return null;
  const periodo = ({ compra: "compra", cuenta: "beneficio", mes: "mes", dia: "dia" } as const)[m[2] as "compra"] ?? "compra";
  return { monto: Number(m[1]!.replace(/[.,]/g, "")), periodo };
}

export function normalizarAnda(crudo: Crudo): Extraido {
  const lineas = crudo.contenido.split("\n");
  const titulo = lineas[0]?.trim() ?? "";
  const categoriaSlug = crudo.contenido.match(/^Categoría según ANDA: .*\(([a-z0-9-]+)\)\.$/m)?.[1] ?? "";
  const descuento = crudo.contenido.match(/^Descuento: (.*)$/m)?.[1] ?? "";
  const deptos = crudo.contenido.match(/^Departamentos según ANDA: ([^.]*)\.$/m)?.[1];
  const iCond = lineas.indexOf("Condiciones:");
  const condiciones = lineas.slice(iCond + 1).join("\n").trim();
  const t = sinAcentos(condiciones);

  const categoria = RUBRO.find(([re]) => re.test(sinAcentos(titulo)))?.[1] ?? "otros";
  const comercio = titulo ? { key: slugificar(titulo), nombre: titulo, categoria } : null;

  const pct = descuento.match(/(\d{1,2})%/);
  const dosPorUno = descuento === "2x1";
  if (!comercio || (!pct && !dosPorUno)) {
    return { crudo, comercio, beneficios: [], productos_desconocidos: [], es_beneficio: true };
  }

  // Los jueves los dice la categoría; en el resto, las condiciones.
  let dias: number[] = [];
  if (/jueves/.test(categoriaSlug)) dias = [4];
  else if (!/todos los dias/.test(t)) {
    const sueltos = [...t.matchAll(/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)s?\b/g)].map((m) => DIAS[m[1]!]!);
    dias = [...new Set(sueltos)].sort();
  }

  const web = /\bweb\b|online/.test(t) && !/no aplica (para|en|a) (la )?venta web/.test(t);
  const presencial = /presencial|punto de venta|en el bus|salas/.test(t) && !/unicamente[^.]{0,60}web/.test(t);
  const canal: BeneficioNormalizado["canal"] = web && presencial ? "ambos" : web ? "online" : "presencial";

  // Sin mención de tarjeta vale con cualquiera de ANDA (lista vacía = todas).
  const productos: string[] = [];
  if (/tarjeta (de credito )?anda|anda visa/.test(t)) productos.push(...CREDITO);
  if (/deanda|prepaga/.test(t)) productos.push(PREPAGA);

  const v = vigencia(t);
  const tp = tope(t);
  const enEstadoDeCuenta = /estado de cuenta/.test(t) && !/punto de venta/.test(t);
  const beneficio = {
    comercio_key: comercio.key,
    titulo: dosPorUno ? "2x1 con tarjeta ANDA" : `${pct![1]}% de descuento`,
    descuento_raw: dias.length === 1 && dias[0] === 4 ? `${descuento} los jueves` : descuento,
    porcentaje: pct ? Number(pct[1]) : null,
    cuotas: null,
    tipo: dosPorUno ? "2x1" : enEstadoDeCuenta ? "reintegro" : "porcentaje",
    dias_semana: dias,
    vigencia_desde: v.desde,
    vigencia_hasta: v.hasta,
    departamentos: deptos && deptos !== "sin dato" && deptos.split(", ").length < 19 ? deptos.split(", ") : [],
    productos_elegibles: productos,
    tope_monto: tp?.monto ?? null,
    tope_periodo: tp?.periodo ?? null,
    canal,
    mecanica: [],
    acumulable: /no (es )?acumulable/.test(t) ? false : null,
    compra_minima: null,
    requiere_activacion: false,
    legales_raw: condiciones || null,
    como_usarlo: [],
    url_fuente: crudo.url_fuente,
  } as BeneficioNormalizado;

  return { crudo, comercio, beneficios: [beneficio], productos_desconocidos: [], es_beneficio: true };
}
