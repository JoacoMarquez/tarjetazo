import { bajarTexto } from "../http.js";
import { htmlATexto } from "../texto.js";
import { slugificar } from "../slug.js";
import type { Crudo } from "../tipos.js";

/**
 * Además del feed, Itaú publica landings por rubro donde sí enumera los
 * comercios adheridos: los logos llevan el nombre en el `alt`. En el feed todo
 * eso es un único "15% menos en restaurantes", que en el buscador no le sirve a
 * nadie; acá lo abrimos en un beneficio por comercio.
 */
const LANDINGS = [
  { pagina: "restaurantes", rubro: "restaurantes" },
  { pagina: "moda", rubro: "indumentaria" },
];

const BASE = "https://www.itau.com.uy/inst";

/** Nombres que son de la navegación o del banco, no comercios adheridos. */
const NO_ES_COMERCIO = new Set([
  "itau", "logo", "banner", "icono", "icon", "imagen", "foto", "menu", "buscar",
  "cerrar", "flecha", "anterior", "siguiente", "app", "web", "instagram",
  "facebook", "linkedin", "twitter", "x", "volar", "beneficios",
]);

function esDecoracion(nombre: string): boolean {
  const n = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  return NO_ES_COMERCIO.has(n) || n.startsWith("itau ") || n.startsWith("logo ");
}

function nombresDeComercios(html: string): string[] {
  const nombres = new Set<string>();
  for (const m of html.matchAll(/alt="([^"]{2,60})"/g)) {
    const n = m[1]!.trim();
    if (!n || esDecoracion(n)) continue;
    // Los alt de decoración suelen ser frases; los comercios son nombres.
    if (n.split(/\s+/).length > 6) continue;
    nombres.add(n);
  }
  return [...nombres];
}

/** El texto de la campaña, que es igual para todos los comercios de la landing. */
function condiciones(html: string): string {
  const texto = htmlATexto(html);
  const i = texto.search(/bases y condiciones/i);
  if (i < 0) return "";
  return texto.slice(i, i + 900).trim();
}

function descuento(html: string): string {
  const m = htmlATexto(html).match(/\d{1,2}\s*%\s*menos[^\n]{0,80}/i);
  return m?.[0]?.trim() ?? "";
}

export async function fetchItauLandings(): Promise<Crudo[]> {
  const fetched_at = new Date().toISOString();
  const crudos: Crudo[] = [];

  for (const { pagina, rubro } of LANDINGS) {
    const url = `${BASE}/${pagina}.html`;
    const html = await bajarTexto(url);
    const bases = condiciones(html);
    const cifra = descuento(html);
    if (!cifra) continue;

    for (const nombre of nombresDeComercios(html)) {
      crudos.push({
        fuente_id: "itau",
        // Prefijo por landing: el mismo comercio puede estar en dos rubros.
        external_id: slugificar(`${pagina}-${nombre}`),
        url_fuente: url,
        contenido: [
          nombre,
          `${cifra} en ${nombre}, del rubro ${rubro}.`,
          bases,
        ]
          .filter(Boolean)
          .join("\n\n"),
        fetched_at,
      });
    }
  }
  return crudos;
}
