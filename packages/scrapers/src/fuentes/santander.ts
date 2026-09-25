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

  const crudos: Crudo[] = [];
  for (const t of tarjetas) {
    const url = `${BASE}${t.path}`;
    let detalle = "";
    let sucursales: SucursalDeFuente[] = [];
    try {
      const html = await bajarTexto(url);
      detalle = htmlATexto(contenidoPrincipal(html));
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
    });
  }
  return crudos;
}
