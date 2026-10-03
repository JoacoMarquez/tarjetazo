import { RUBROS_ENTEROS, keyDeRubro, type BeneficioNormalizado } from "@tarjetazo/core";
import { bajarTexto } from "../http.js";
import { contenidoPrincipal, htmlATexto } from "../texto.js";
import { slugificar } from "../slug.js";
import type { Crudo, Extraido } from "../tipos.js";

/**
 * Nativa (red Cabal, #10). El índice trae todas las promociones server-rendered
 * con su tipo en las clases ("cuotas-sin-recargo", "ultima-cuota-gratis",
 * "descuentos-y-promos", "productos-y-servicios") y el número grande de la
 * tarjeta ("12 CUOTAS", "20 % DESCUENTO"); la ficha suma las condiciones. Es
 * texto de plantilla: se lee sin modelo.
 *
 * "Última cuota gratis" se guarda como reintegro equivalente (decisión del
 * 2026-09-25): en un plan de N cuotas es 1/N de ahorro. Se toma el plan más
 * largo, que es el ahorro más bajo: no prometemos de más. El texto literal va
 * en `descuento_raw`.
 *
 * Varias tarjetas no son de un comercio sino de un rubro ("Farmacias y
 * perfumerías", "Transporte", "Cine"): van al comercio canónico del rubro
 * entero (`todo-farmacias`) o, si no hay rubro entero que les corresponda, no
 * se publican (ver PSEUDO_COMERCIOS).
 */

const BASE = "https://www.nativacabal.com.uy";
const INDICE = `${BASE}/beneficios/`;
const PRODUCTO = "nativa-cabal";

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const texto = (html: string) => htmlATexto(html).replace(/\s+/g, " ").trim();

interface Tarjeta {
  url: string;
  titulo: string;
  tipos: string[];
  promo: string;
  descripcion: string;
}

export function tarjetasDelIndice(html: string): Tarjeta[] {
  const out = new Map<string, Tarjeta>();
  for (const m of html.matchAll(/<article id="post-\d+" class="([^"]*)"[^>]*>([\s\S]*?)<\/article>/g)) {
    const [, clases, cuerpo] = m;
    const url = cuerpo!.match(/<h5 class="header">\s*<a href="([^"]+)"/)?.[1];
    if (!url || out.has(url)) continue;
    out.set(url, {
      url,
      titulo: texto(cuerpo!.match(/<h5 class="header">([\s\S]*?)<\/h5>/)?.[1] ?? ""),
      tipos: [...clases!.matchAll(/services-tipo-([a-z0-9-]+)/g)].map((t) => t[1]!),
      promo: texto(cuerpo!.match(/<div class="promo-beneficio [a-z]+">([\s\S]*?)<\/div>/)?.[1] ?? ""),
      descripcion: texto(cuerpo!.match(/promo-descripcion[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? ""),
    });
  }
  return [...out.values()];
}

/**
 * Algunas tarjetas enlazan a cabal.com.uy ("Combustible" → una página que ya
 * no existe): la ficha no es de Nativa y la fuente es la tarjeta del índice.
 */
const esDeNativa = (url: string) => new URL(url).hostname === new URL(BASE).hostname;

export function crudoDeTarjeta(t: Tarjeta, htmlFicha: string | null): Crudo {
  const detalle = htmlFicha
    ? htmlATexto(contenidoPrincipal(htmlFicha))
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
    : [];
  const contenido = [
    t.titulo,
    `Promoción: ${t.promo || "sin número"}`,
    `Tipo según Nativa: ${t.tipos.join(", ") || "sin tipo"}.`,
    t.descripcion,
    "Detalles:",
    // La ficha repite el título y el subtítulo al principio.
    ...detalle.filter((l) => l !== t.titulo),
  ].join("\n");
  return {
    fuente_id: "nativa",
    external_id: slugificar(new URL(t.url).pathname.replace(/^\/services\//, "").replace(/\/$/, "")),
    url_fuente: esDeNativa(t.url) ? t.url : INDICE,
    contenido,
    fetched_at: new Date().toISOString(),
  };
}

export async function fetchNativa(): Promise<Crudo[]> {
  const tarjetas = tarjetasDelIndice(await bajarTexto(INDICE));
  const limite = Number(process.env.SCRAPER_LIMITE) || Infinity;
  const crudos: Crudo[] = [];
  for (const t of tarjetas.slice(0, limite)) {
    let ficha: string | null = null;
    // Sin ficha queda lo del índice: el tipo y el número de la tarjeta.
    if (esDeNativa(t.url)) ficha = await bajarTexto(t.url).catch(() => null);
    crudos.push(crudoDeTarjeta(t, ficha));
  }
  return crudos;
}

/** Rubro por palabras del nombre y la descripción: el índice no lo trae. */
const RUBRO: [RegExp, string][] = [
  // CauteAntel es un servicio social y de salud: su ficha nombra la "farmacia asistencial".
  [/\bcaute/, "salud-belleza"],
  [/pedidos ?ya|delivery/, "delivery"],
  [/farmac|farmashop/, "farmacias"],
  [/supermercad|almacen|tienda inglesa|ta-ta|el dorado|devoto|disco|geant|macro ?mercado/, "supermercados"],
  [/\bstm\b|boleto|omnibus|transporte/, "transporte"],
  [/restaurant|parrilla|pizz|cafe\b|cafeter|bar\b/, "restaurantes"],
  [/optica|dental|implante|clinica|dermo|spa\b|estetica|salud|belleza|perfum/, "salud-belleza"],
  [/teatro|cine|espectacul|ticket|recital|entradas/, "entretenimiento"],
  [/bici|bike|deport|fitness|gimnas|futbol|nacional|penarol|decathlon|la cancha/, "deportes"],
  [/moto|auto|neumatic|taller|automovil|combustible/, "servicios"],
  [/viaje|turismo|hotel|pasaje|vuelo|bs\.? ?as|buenos aires/, "viajes"],
  [/ropa|moda|calzado|zapat|crocs|h&m|indumentaria|lookeate|vestimenta/, "indumentaria"],
  [/juguet|librer/, "libreria-juguetes"],
  [/mascota|veterinar/, "mascotas"],
  [/electro|celular|tecnolog|tecno\b|zonatecno|universo binario|computad|digital|aire acondicionado|irobot|audio|video/, "electro-tecnologia"],
  [/mueble|hogar|confort|colchon|descans|bazar|deco|equipamiento|construye|ferreter|pinturer|alarma|sodimac|herramient|repuesto|limpieza|ultrawash|kroser|miniso|magic center|divino/, "hogar-deco"],
  [/curso|oficio|capacitac|factura|contribucion|alquiler|seguro/, "servicios"],
];

const DEPARTAMENTOS: [RegExp, string][] = [
  [/\bmontevideo\b/, "montevideo"], [/\bcanelones\b|las piedras|\bpando\b|ciudad de la costa|atlantida/, "canelones"],
  [/maldonado|punta del este|piriapolis|san carlos/, "maldonado"], [/\bcolonia\b|carmelo|nueva helvecia/, "colonia"],
  [/paysandu/, "paysandu"], [/\bsalto\b/, "salto"], [/rivera/, "rivera"], [/rocha/, "rocha"],
  [/tacuarembo/, "tacuarembo"], [/artigas/, "artigas"], [/durazno/, "durazno"], [/\bflores\b|trinidad/, "flores"],
  [/\bflorida\b/, "florida"], [/lavalleja|\bminas\b/, "lavalleja"], [/soriano|mercedes|dolores/, "soriano"],
  [/rio negro|fray bentos|young/, "rio-negro"], [/cerro largo|\bmelo\b/, "cerro-largo"],
  [/treinta y tres/, "treinta-y-tres"], [/san jose/, "san-jose"],
];

/**
 * Tarjetas cuyo título es un rubro o un listado, no un comercio. Las que
 * corresponden a un rubro entero van a su comercio canónico; las que nombran
 * un solo comercio real, a ese; el resto (rubros sin comercio canónico,
 * listados de marcas, pagos de facturas o tributos, el combustible de
 * frontera) no se publican: un comercio "Zapaterías" o "12 cuotas" sale en los
 * listados y el mapa como si fuera un local.
 */
type Destino = { rubro: string } | { nombre: string; categoria: string } | null;
const PSEUDO_COMERCIOS: [RegExp, Destino][] = [
  [/^farmacias\b/, { rubro: "farmacias" }],
  [/^opticas$/, { rubro: "opticas" }],
  // "Podés concurrir a cualquier cine adherido a Cabal."
  [/^cines?$/, { rubro: "cines-teatros" }],
  // Cuponeras y pasajes en las empresas de ómnibus del listado.
  [/^transporte$/, { rubro: "pasajes" }],
  // El listado es de "jugueterías y librerías": las librerías son el rubro entero.
  [/^jugueterias y librerias$/, { rubro: "librerias" }],
  // Tienda Inglesa, Ta-Ta, El Dorado, Macro Mercado, Frigo y Kinko.
  [/^tus supermercados$/, { rubro: "supermercados" }],
  // La ficha dice "Buquebus y Colonia Express": una página es un comercio, y
  // el rubro entero (todas las empresas de transporte) prometería las 12
  // cuotas también en los ómnibus, que tienen 6.
  [/^buenos aires$/, { nombre: "Buquebus", categoria: "viajes" }],
  // "Hasta 6 cuotas en todo el país" con un listado de adheridos: rubros enteros.
  [/^zapaterias$/, { rubro: "zapaterias" }],
  [/^veterinarias$/, { rubro: "veterinarias" }],
  [/^talleres mecanicos$/, { rubro: "talleres" }],
  [/^mutualistas\b/, { rubro: "mutualistas" }],
  // "Barracas, Ferreterías y Pinturerías".
  [/^pinta, repara y renova tu casa$/, { rubro: "ferreterias" }],
  // Listados de marcas: "12 cuotas" (Zara, GAP, Farmashop…), "Aire
  // Acondicionado" (cinco comercios), "Promo 12-1" (el índice filtrado por
  // "última cuota gratis": cada comercio tiene su tarjeta).
  [/^(\d+ cuotas|aire acondicionado|promo 12[-+ ]1)$/, null],
  // Facturas y tributos pagados en Abitab o Redpagos: un servicio de la
  // tarjeta, como los débitos automáticos.
  [/^(pago de facturas\b.*|contribucion inmobiliaria)$/, null],
  // "Combustible de Frontera. Combustible con devolución de IMESI": es la
  // devolución del IMESI en estaciones de las zonas de frontera, no un
  // descuento en todas las estaciones del país. La tarjeta no dice en qué
  // departamentos ni tiene ficha (enlaza a cabal.com.uy, que no existe más).
  [/^combustible\b/, null],
];

function destinoDe(titulo: string): Destino | undefined {
  return PSEUDO_COMERCIOS.find(([re]) => re.test(sinAcentos(titulo).trim()))?.[1];
}

/** "$2,000", "$ 1.200": el sitio usa coma o punto para los miles. */
function tope(detalle: string): { monto: number; periodo: BeneficioNormalizado["tope_periodo"] } | null {
  const t = sinAcentos(detalle);
  const m = t.match(/tope[^$]{0,80}\$\s*(\d{1,3}(?:[.,]\d{3})+|\d+)/);
  if (!m) return null;
  const monto = Number(m[1]!.replace(/[.,]/g, ""));
  if (!(monto >= 50)) return null;
  const periodo = /diario|por dia/.test(t) ? "dia" : /mensual|por mes/.test(t) ? "mes" : /cuenta|periodo de la promocion/.test(t) ? "beneficio" : "compra";
  return { monto, periodo };
}

export function normalizarNativa(crudo: Crudo): Extraido {
  const lineas = crudo.contenido.split("\n");
  const titulo = lineas[0]?.trim() ?? "";
  const promo = crudo.contenido.match(/^Promoción: (.*)$/m)?.[1] ?? "";
  const tipos = crudo.contenido.match(/^Tipo según Nativa: (.*)\.$/m)?.[1]?.split(", ") ?? [];
  const iDetalles = lineas.indexOf("Detalles:");
  const descripcion = lineas.slice(3, iDetalles).join(" ");
  const detalle = lineas.slice(iDetalles + 1).join("\n");
  const todo = sinAcentos(`${titulo} ${descripcion} ${detalle}`);

  // Primero el nombre y la descripción; si no dicen nada, la ficha entera,
  // pero sin "servicios": los legales hablan de facturas y seguros siempre.
  const categoria = RUBRO.find(([re]) => re.test(sinAcentos(`${titulo} ${descripcion}`)))?.[1] ??
    RUBRO.find(([re, c]) => c !== "servicios" && re.test(todo))?.[1] ?? "otros";
  const destino = destinoDe(titulo);
  const rubro = destino && "rubro" in destino ? RUBROS_ENTEROS.find((r) => r.id === destino.rubro)! : null;
  const real = destino && "nombre" in destino ? destino : null;
  const comercio =
    destino === null || !titulo ? null
    : rubro ? { key: keyDeRubro(rubro), nombre: rubro.nombre, categoria: rubro.categoria }
    : real ? { key: slugificar(real.nombre), nombre: real.nombre, categoria: real.categoria }
    : { key: slugificar(titulo), nombre: titulo, categoria };
  // El índice mismo (la tarjeta "Promo 12-1" enlaza a /beneficios/): un listado.
  const esIndice = new URL(crudo.url_fuente).pathname.replace(/\/$/, "") === new URL(INDICE).pathname.replace(/\/$/, "");

  // Préstamos, retiros, asistencia al viajero: servicios de la tarjeta, no
  // beneficios en un comercio.
  const soloServicios = tipos.length > 0 && tipos.every((t) => t === "productos-y-servicios");
  if (!comercio || soloServicios || esIndice) {
    return { crudo, comercio, beneficios: [], productos_desconocidos: [], es_beneficio: false };
  }

  const zona = sinAcentos(descripcion);
  const departamentos = [...new Set(DEPARTAMENTOS.filter(([re]) => re.test(zona)).map(([, d]) => d))];
  const p = sinAcentos(promo);
  const porcentaje = p.match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*%/);
  const ultimaCuota = tipos.includes("ultima-cuota-gratis") ||
    /ultima cuota (es |de tu plan es )?gratis|bonificada la ultima|ultima cuota no la pagas|ultima cuota la regala|promo 12[-+ ]1/.test(todo);
  // Un descuento y una "promo 12+1" en la misma ficha (CAUTE): el tope de
  // cada uno es el de su párrafo, no el primero que aparece.
  const iUltima = porcentaje && ultimaCuota ? sinAcentos(detalle).search(/ultima cuota|promo 12[-+ ]1/) : -1;
  const tDescuento = tope(iUltima > 0 ? detalle.slice(0, iUltima) : detalle);
  const tUltima = tope(iUltima > 0 ? detalle.slice(iUltima) : detalle);
  const canal: BeneficioNormalizado["canal"] = /tienda cabal|online|web/.test(sinAcentos(titulo)) ? "online" : "presencial";
  const base = {
    comercio_key: comercio.key,
    dias_semana: [] as number[],
    vigencia_desde: null,
    vigencia_hasta: null,
    departamentos: departamentos as BeneficioNormalizado["departamentos"],
    productos_elegibles: [PRODUCTO],
    canal,
    mecanica: [] as BeneficioNormalizado["mecanica"],
    acumulable: null,
    compra_minima: null,
    requiere_activacion: false,
    legales_raw: detalle || null,
    como_usarlo: [] as string[],
    url_fuente: crudo.url_fuente,
  };

  const tramos: BeneficioNormalizado[] = [];
  // El número de la tarjeta del índice manda sobre la ficha: las fichas
  // repiten "hasta en 12 cuotas sin recargo" de plantilla aunque la promo sea
  // de 6 ("Jugueterías y librerías en 6 cuotas", listado "HASTA 6 CUOTAS").
  const cuotasFicha = sinAcentos(detalle).match(/hasta (?:en )?(\d{1,2}) cuotas/);
  // "50% + 6 CUOTAS": el porcentaje no es un número de cuotas.
  const cuotasPromo = [...p.replace(/\d+(?:[.,]\d+)?\s*%/g, "").matchAll(/\d{1,2}/g)].map((m) => Number(m[0]));

  if (porcentaje && tipos.some((x) => x === "descuentos-y-promos" || x === "acuerdos-nativa")) {
    const pct = porcentaje[1]!.replace(",", ".");
    // "Sé socio de Caute / 3 meses al 50%", "6 meses 50% off": la cuota de socio.
    const meses = sinAcentos(descripcion).match(/(\d{1,2}) meses (?:al )?\d{1,2}\s*%/)?.[1];
    tramos.push({
      ...base,
      titulo: meses ? `${pct.replace(".", ",")}% en la cuota de los primeros ${meses} meses` : `${pct.replace(".", ",")}% de descuento`,
      descuento_raw: promo,
      porcentaje: Number(pct),
      cuotas: null,
      tipo: "porcentaje",
      tope_monto: tDescuento?.monto ?? null,
      tope_periodo: tDescuento?.periodo ?? null,
      tope_moneda: "UYU",
    } as BeneficioNormalizado);
  }

  if (ultimaCuota) {
    // Los planes que dice la ficha ("PESOS 12, 15, 18 y 24 cuotas", "planes
    // 12, 15, 18 o 24 cuotas PESOS y … 12,15,18 cuotas DÓLARES", "plan 12
    // cuotas"); si no dice ninguno, los del índice. Los "con recargo" no son
    // de la promo.
    const desde = iUltima > 0 ? sinAcentos(detalle).slice(iUltima) : sinAcentos(detalle);
    const listas = [...desde.matchAll(/(\d{1,2}(?:\s*(?:,|y|o|a)\s*\d{1,2})*)\s*cuotas(?!\s*con recargo)/g)].map((m) => m[1]!);
    const planes = listas.flatMap((l) => [...l.matchAll(/\d{1,2}/g)].map((m) => Number(m[0])));
    const ns = (planes.length > 0 ? planes : cuotasPromo).filter((n) => n >= 2);
    const n = ns.length > 0 ? Math.max(...ns) : null;
    if (n) {
      const pct = Math.round((1000 / n)) / 10;
      const rango = ns.length > 1 ? `planes de ${Math.min(...ns)} a ${n} cuotas` : `${n} cuotas`;
      tramos.push({
        ...base,
        titulo: "Última cuota gratis",
        descuento_raw: `Última cuota gratis en ${rango} (equivale a ${pct.toLocaleString("es-UY")}% de ahorro en ${n} cuotas)`,
        porcentaje: pct,
        cuotas: null,
        tipo: "reintegro",
        tope_monto: tUltima?.monto ?? null,
        // "Tope bonificación por cuenta" (CAUTE) es por todo el beneficio; si
        // no, es "para cada última cuota de los planes": por compra.
        tope_periodo: tUltima?.monto ? (/\bpor cuenta\b/.test(sinAcentos(detalle.slice(Math.max(iUltima, 0)))) ? "beneficio" : "compra") : null,
        tope_moneda: "UYU",
      } as BeneficioNormalizado);
    }
  } else if (tipos.includes("cuotas-sin-recargo") || /cuotas/.test(p)) {
    const n = cuotasPromo.length > 0 ? Math.max(...cuotasPromo) : cuotasFicha ? Number(cuotasFicha[1]) : null;
    if (n && n >= 2 && n <= 36) {
      tramos.push({
        ...base,
        titulo: `${n} cuotas sin recargo`,
        descuento_raw: promo ? `${promo} sin recargo` : `Hasta ${n} cuotas sin recargo`,
        porcentaje: null,
        cuotas: n,
        tipo: "cuotas",
        tope_monto: null,
        tope_periodo: null,
        tope_moneda: "UYU",
      } as BeneficioNormalizado);
    }
  }

  return { crudo, comercio, beneficios: tramos, productos_desconocidos: [], es_beneficio: true };
}
