import { bajarTexto } from "../http.js";
import { contenidoPrincipal, htmlATexto } from "../texto.js";
import { slugificar } from "../slug.js";
import type { Crudo, SucursalDeFuente } from "../tipos.js";

const BASE = "https://www.santander.com.uy";
const LISTADO = `${BASE}/beneficios`;

/**
 * El listado de Santander trae todas las tarjetas renderizadas en el servidor,
 * con el comercio y el descuento. La ficha de cada beneficio agrega las
 * condiciones y la dirección del local, pero carga el descuento por AJAX: por
 * eso combinamos las dos y no alcanza con una sola.
 */
interface Tarjeta {
  path: string;
  comercio: string;
  resumen: string;
}

/**
 * Lo que lee el parser (`santander-parser.ts`), en `Crudo.datos`: los campos
 * de la tarjeta del listado y el cuerpo de la ficha, ya pasados a texto. El
 * `contenido` sigue armándose como antes (con el recorte de 2.500 caracteres
 * del listado) para que el hash de las páginas no cambie. No se guarda.
 */
export interface DatosSantander {
  titulo: string;
  /** Los párrafos del cuerpo de la tarjeta: "25% con Platinum…", "15% con crédito y débito.". */
  resumen: string[];
  /** Condiciones de la ficha; vacío si la ficha no respondió. */
  condiciones: string;
  /** Rubro del filtro del listado ("Ruta Gourmet", "Moda"), si salió en alguno. */
  categoria: string | null;
}

/** Los filtros de rubro del listado (`?categoria=N`), con su etiqueta. */
export function categoriasDelListado(html: string): { id: string; nombre: string }[] {
  const out = new Map<string, string>();
  for (const m of html.matchAll(/<a\b[^>]*name="categoria\[(\d+)\]"[^>]*>([\s\S]*?)<\/a>/g)) {
    const nombre = htmlATexto(m[2]!).replace(/\s+/g, " ").trim();
    if (nombre && !out.has(m[1]!)) out.set(m[1]!, nombre);
  }
  return [...out].map(([id, nombre]) => ({ id, nombre }));
}

/** Los paths de las fichas de un listado (entero o filtrado por rubro). */
function pathsDelListado(html: string): string[] {
  return [...new Set([...html.matchAll(/href="(\/beneficios\/[^"?#]+)"/g)].map((m) => m[1]!))];
}

/**
 * Título y párrafos de cada tarjeta del listado, leyendo el <article> entero
 * (la ventana de 2.500 caracteres de `tarjetasDelListado` a veces corta el
 * cuerpo por la mitad).
 */
export function camposDelListado(html: string): Map<string, { titulo: string; resumen: string[]; logo: string | null }> {
  const out = new Map<string, { titulo: string; resumen: string[]; logo: string | null }>();
  const partes = html.split(/<article\b(?=[^>]*list-map-item-benefits)/).slice(1);
  for (const parte of partes) {
    const bloque = parte.split(/<\/article>/)[0]!;
    const path = bloque.match(/href="(\/beneficios\/[^"?#]+)"/)?.[1];
    if (!path || out.has(path)) continue;
    const titulo = htmlATexto(bloque.match(/field--name-title[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? "").trim();
    const cuerpo = bloque.match(/field--name-body[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "";
    const resumen = htmlATexto(cuerpo)
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    // El logo del comercio va en la cabecera de la tarjeta (miniatura cuadrada).
    const src = bloque.match(/field--name-field-company-logo[\s\S]*?<img[^>]*\ssrc="([^"]+)"/)?.[1];
    out.set(path, { titulo, resumen, logo: src ? new URL(src.replace(/&amp;/g, "&"), BASE).toString() : null });
  }
  return out;
}

/** El cuerpo de la ficha (condiciones), sin los bloques del pie que usan la misma clase. */
export function condicionesDe(html: string): string {
  const m = html.match(/beneficios-modal-content[\s\S]*?field--name-body[^>]*>([\s\S]*?)<\/div>/);
  return m ? htmlATexto(m[1]!).trim() : "";
}

function tarjetasDelListado(html: string): Tarjeta[] {
  const tarjetas = new Map<string, Tarjeta>();
  // El marcador de cada tarjeta es esta clase. Tomamos una ventana fija a
  // partir de ahí en vez de buscar la etiqueta de cierre: el markup anida
  // varios <div> y el primer cierre llega antes que el enlace.
  const marcador = /list-map-item-benefits/g;
  for (const m of html.matchAll(marcador)) {
    const bloque = html.slice(m.index, m.index + 2500);
    const path = bloque.match(/href="(\/beneficios\/[^"?#]+)"/)?.[1];
    if (!path || tarjetas.has(path)) continue;
    const lineas = htmlATexto(bloque)
      .split("\n")
      .map((l) => l.trim())
      // La ventana arranca dentro de un atributo, así que la primera línea es
      // el resto de la clase; "Ver más detalles" es el enlace de la tarjeta.
      .filter((l) => l && !l.includes("list-map-item") && !/^(ver m[áa]s|ver detalle)/i.test(l));
    if (lineas.length === 0) continue;
    tarjetas.set(path, {
      path,
      comercio: lineas[0]!,
      resumen: lineas.slice(1).join(" · "),
    });
  }
  return [...tarjetas.values()];
}

/**
 * Los locales de la ficha: cada uno es un <article> "sitios-de-interes" con el
 * nombre, la dirección y un link "Ir a la dirección" a Google Maps que trae las
 * coordenadas (`/maps/dir//-34.8894,-56.059257`). Sin coordenadas válidas en
 * Uruguay, el local no entra: no inventamos un punto.
 */
export function localesDe(html: string): SucursalDeFuente[] {
  const out: SucursalDeFuente[] = [];
  const vistos = new Set<string>();
  const partes = html.split(/<article\b(?=[^>]*node--type-sitios-de-interes)/).slice(1);
  for (const parte of partes) {
    const bloque = parte.split(/<\/article>/)[0]!;
    const coords = bloque.match(/maps\/dir\/\/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (!coords) continue;
    const lat = Number(coords[1]);
    const lng = Number(coords[2]);
    if (!(lat < -30 && lat > -35.2 && lng < -53 && lng > -58.6)) continue;
    const campo = (nombre: string) => {
      const m = bloque.match(new RegExp(`field--name-${nombre}[^>]*>([\\s\\S]*?)</(?:div|span)>`));
      return m ? htmlATexto(m[1]!).trim() : "";
    };
    const direccion = campo("field-ubicacion");
    if (!direccion) continue;
    const clave = `${direccion}|${lat}|${lng}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    out.push({ nombre: campo("title") || null, direccion, lat, lng });
  }
  return out;
}

export async function fetchSantander(): Promise<Crudo[]> {
  const listado = await bajarTexto(LISTADO);
  const tarjetas = tarjetasDelListado(listado);
  const campos = camposDelListado(listado);

  // El rubro no está en la tarjeta: sale de filtrar el listado por cada uno.
  // Sirve para dar de alta comercios nuevos; si un filtro falla, sin rubro.
  const rubroDe = new Map<string, string>();
  for (const c of categoriasDelListado(listado)) {
    try {
      for (const path of pathsDelListado(await bajarTexto(`${LISTADO}?categoria=${c.id}`))) {
        if (!rubroDe.has(path)) rubroDe.set(path, c.nombre);
      }
    } catch {
      // Seguimos sin ese rubro.
    }
  }

  const crudos: Crudo[] = [];
  for (const t of tarjetas) {
    const url = `${BASE}${t.path}`;
    let detalle = "";
    let condiciones = "";
    let sucursales: SucursalDeFuente[] = [];
    try {
      const html = await bajarTexto(url);
      detalle = htmlATexto(contenidoPrincipal(html));
      condiciones = condicionesDe(html);
      sucursales = localesDe(html);
    } catch {
      // Si la ficha no responde nos quedamos con lo que dice el listado, que ya
      // trae el comercio y el descuento.
    }

    const contenido = [
      t.comercio,
      t.resumen,
      detalle && detalle !== t.comercio ? detalle : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    crudos.push({
      fuente_id: "santander",
      external_id: slugificar(t.path.replace("/beneficios/", "")),
      url_fuente: url,
      contenido,
      fetched_at: new Date().toISOString(),
      sucursales,
      ...(campos.get(t.path)?.logo ? { logo: campos.get(t.path)!.logo! } : {}),
      datos: {
        titulo: campos.get(t.path)?.titulo || t.comercio,
        resumen: campos.get(t.path)?.resumen ?? [],
        condiciones,
        categoria: rubroDe.get(t.path) ?? null,
      } satisfies DatosSantander,
    });
  }
  return crudos;
}
