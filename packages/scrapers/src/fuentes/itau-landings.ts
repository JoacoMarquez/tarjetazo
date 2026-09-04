import { parse, type HTMLElement } from "node-html-parser";
import { bajarTexto } from "../http.js";
import { htmlATexto } from "../texto.js";
import { slugificar } from "../slug.js";
import type { Crudo } from "../tipos.js";

/**
 * Además del feed, Itaú publica landings donde sí enumera los comercios
 * adheridos: cada logo lleva el nombre en su `alt`. En el feed todo eso es un
 * único "15% menos en restaurantes", que en el buscador no le sirve a nadie.
 *
 * Cada landing es un segmento de tarjeta (base, Platinum, Personal Bank) y se
 * divide en tres pestañas por ubicación. El mismo restaurante aparece en varias
 * con distinto porcentaje, así que juntamos por comercio y emitimos una sola
 * página con todos sus tramos: es la forma que ya maneja el normalizador.
 */
const LANDINGS = [
  { pagina: "restaurantes", rubro: "restaurantes" },
  { pagina: "restaurantesplatinum", rubro: "restaurantes" },
  { pagina: "restaurantespersonalbank", rubro: "restaurantes" },
  { pagina: "moda", rubro: "indumentaria" },
];

const BASE = "https://www.itau.com.uy/inst";

/** Nombres de imágenes que son navegación o del propio banco. */
const NO_ES_COMERCIO = new Set([
  "itau", "logo", "banner", "icono", "icon", "imagen", "foto", "menu", "buscar",
  "cerrar", "flecha", "anterior", "siguiente", "app", "web", "instagram",
  "facebook", "linkedin", "twitter", "x", "volar", "beneficios",
  // Nombres de rubro que aparecen como alt de imágenes de encabezado: no son
  // comercios y, si entran, se llevan todos los beneficios de la landing.
  "restaurantes", "restaurante", "tiendas gourmet", "gourmet", "moda",
  "montevideo", "punta del este", "interior",
]);

function esDecoracion(nombre: string): boolean {
  const n = nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  return NO_ES_COMERCIO.has(n) || n.startsWith("itau ") || n.startsWith("logo ");
}

function comerciosDe(elemento: HTMLElement): string[] {
  const nombres = new Set<string>();
  for (const img of elemento.querySelectorAll("img[alt]")) {
    const n = (img.getAttribute("alt") ?? "").trim();
    // Los alt decorativos son frases; los comercios son nombres.
    if (!n || esDecoracion(n) || n.split(/\s+/).length > 6) continue;
    nombres.add(n);
  }
  return [...nombres];
}

/**
 * Las pestañas no referencian su panel por id: el contenedor tiene la barra de
 * pestañas y después una <section> por pestaña, en el mismo orden.
 */
function seccionesPorUbicacion(html: string): { ubicacion: string; seccion: HTMLElement }[] {
  const raiz = parse(html);
  const pestanas = raiz.querySelectorAll("[data-toggle=tab]");
  if (pestanas.length === 0) return [];

  let contenedor: HTMLElement | null = pestanas[0]!.parentNode;
  while (contenedor && contenedor.querySelectorAll("img[alt]").length < 20) {
    contenedor = contenedor.parentNode;
  }
  if (!contenedor) return [];

  const secciones = contenedor.childNodes.filter(
    (n) => (n as HTMLElement).tagName === "SECTION",
  ) as HTMLElement[];
  if (secciones.length !== pestanas.length) return [];

  return secciones.map((seccion, i) => ({
    ubicacion: pestanas[i]!.text.trim(),
    seccion,
  }));
}

/** El texto legal de la campaña, sin el pie de página que se repite en el sitio. */
function bases(html: string): string {
  const texto = htmlATexto(html);
  const i = texto.search(/bases y condiciones/i);
  if (i < 0) return "";
  const resto = texto.slice(i, i + 2000);
  const fin = resto.search(/\n(canales digitales|encontranos en|¿Conocés todos)/i);
  return (fin > 0 ? resto.slice(0, fin) : resto).trim();
}

export async function fetchItauLandings(): Promise<Crudo[]> {
  const fetched_at = new Date().toISOString();
  // Por comercio: cada encabezado de sección (porcentaje + tarjetas) con las
  // ubicaciones donde aplica.
  const porComercio = new Map<
    string,
    { nombre: string; rubro: string; tramos: Map<string, Set<string>>; legales: string[] }
  >();

  for (const { pagina, rubro } of LANDINGS) {
    const url = `${BASE}/${pagina}.html`;
    let html: string;
    try {
      html = await bajarTexto(url);
    } catch {
      continue;
    }
    const legales = bases(html);

    for (const { ubicacion, seccion } of seccionesPorUbicacion(html)) {
      // Cada sección abre con su porcentaje y con qué tarjetas se paga; las
      // bases de la página son de la campaña entera y a veces hablan de una
      // sola ubicación, así que no sirven para describir un tramo.
      const lineas = htmlATexto(seccion.innerHTML).split("\n").slice(0, 3);
      if (!lineas.some((l) => /\d{1,2}\s*%\s*menos/i.test(l))) continue;
      const encabezado = lineas.join(" ").trim();

      for (const nombre of comerciosDe(seccion)) {
        const clave = slugificar(nombre);
        const entrada =
          porComercio.get(clave) ??
          porComercio.set(clave, { nombre, rubro, tramos: new Map(), legales: [] }).get(clave)!;

        // Un mismo descuento en varias pestañas es un solo beneficio con varias
        // ubicaciones, no varios beneficios iguales.
        const ubicaciones = entrada.tramos.get(encabezado) ?? new Set<string>();
        ubicaciones.add(ubicacion);
        entrada.tramos.set(encabezado, ubicaciones);
        if (legales && !entrada.legales.includes(legales)) entrada.legales.push(legales);
      }
    }
  }

  return [...porComercio].map(([clave, { nombre, rubro, tramos, legales }]) => ({
    fuente_id: "itau",
    external_id: `landing-${clave}`,
    url_fuente: `${BASE}/restaurantes.html`,
    contenido: [
      `${nombre} (${rubro})`,
      ...[...tramos].map(
        ([encabezado, ubicaciones]) => `${encabezado} En: ${[...ubicaciones].join(", ")}.`,
      ),
      legales.length > 0 ? `Condiciones de las campañas:\n${legales.join("\n\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    fetched_at,
  }));
}
