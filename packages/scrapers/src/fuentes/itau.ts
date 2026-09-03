import { bajarTexto } from "../http.js";
import { htmlATexto } from "../texto.js";
import { slugificar } from "../slug.js";
import type { Crudo, SucursalDeFuente } from "../tipos.js";

/**
 * Itaú publica todas sus campañas en un XML que consume su propia página, con
 * las bases completas y, en muchos casos, los locales con coordenadas. Es mejor
 * fuente que el HTML: nada de esto hay que adivinarlo.
 */
const FEED = "https://www.itau.com.uy/inst/aci/inst_camp.xml";

/** Cada lista del feed corresponde a un producto o paquete de Itaú. */
const LISTAS: Record<string, string> = {
  list_debito: "tarjeta de débito",
  list_credito: "tarjeta de crédito",
  list_alimentacion: "tarjeta de alimentación",
  list_paquete_full: "paquete Full",
  list_paquete_light: "paquete Light",
  list_general: "general",
};

function texto(xml: string, etiqueta: string): string {
  const m = xml.match(new RegExp(`<${etiqueta}>([\\s\\S]*?)</${etiqueta}>`, "i"));
  if (!m?.[1]) return "";
  return htmlATexto(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")).trim();
}

function sucursalesDe(bloque: string): SucursalDeFuente[] {
  const out: SucursalDeFuente[] = [];
  for (const m of bloque.matchAll(/<mapa_comercio>([\s\S]*?)<\/mapa_comercio>/gi)) {
    const c = m[1]!;
    const lat = Number(texto(c, "latitud"));
    const lng = Number(texto(c, "longitud"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const direccion = texto(c, "texto_normal") || texto(c, "nombre");
    if (!direccion) continue;
    out.push({ nombre: texto(c, "nombre") || null, direccion, lat, lng });
  }
  return out;
}

export async function fetchItau(): Promise<Crudo[]> {
  const xml = await bajarTexto(FEED);
  const fetched_at = new Date().toISOString();

  // El mismo beneficio aparece en varias listas (una por producto): juntamos
  // las listas en las que sale para que el normalizador sepa a qué tarjetas
  // aplica, y guardamos una sola página por beneficio.
  const porId = new Map<string, { bloque: string; listas: string[] }>();

  for (const [lista, etiqueta] of Object.entries(LISTAS)) {
    const bloqueLista = xml.match(
      new RegExp(`<${lista}\\b[^>]*>([\\s\\S]*?)</${lista}>`, "i"),
    )?.[1];
    if (!bloqueLista) continue;
    for (const m of bloqueLista.matchAll(/<item\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/item>/gi)) {
      const id = m[1]!;
      const previo = porId.get(id);
      if (previo) previo.listas.push(etiqueta);
      else porId.set(id, { bloque: m[2]!, listas: [etiqueta] });
    }
  }

  const crudos: Crudo[] = [];
  for (const [id, { bloque, listas }] of porId) {
    const titulo = texto(bloque, "titulo");
    const descripcion = texto(bloque, "descripcion");
    const bases = texto(bloque, "bases");
    if (!titulo && !descripcion) continue;

    const sucursales = sucursalesDe(bloque);
    const contenido = [
      titulo,
      descripcion,
      listas.length > 0 ? `Aplica a: ${listas.join(", ")}.` : "",
      bases ? `Condiciones:\n${bases}` : "",
      sucursales.length > 0
        ? `Locales:\n${sucursales.map((s) => `- ${s.nombre ?? ""} ${s.direccion}`.trim()).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    crudos.push({
      fuente_id: "itau",
      external_id: slugificar(id),
      // El feed no tiene una URL por beneficio: enlazamos la página que lo lista.
      url_fuente: "https://www.itau.com.uy/inst/beneficios.html",
      contenido,
      fetched_at,
      sucursales,
    });
  }
  return crudos;
}
