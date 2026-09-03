import { bajarTexto } from "../http.js";
import { contenidoPrincipal, htmlATexto } from "../texto.js";
import { slugificar } from "../slug.js";
import type { Crudo } from "../tipos.js";

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

export async function fetchSantander(): Promise<Crudo[]> {
  const listado = await bajarTexto(LISTADO);
  const tarjetas = tarjetasDelListado(listado);

  const crudos: Crudo[] = [];
  for (const t of tarjetas) {
    const url = `${BASE}${t.path}`;
    let detalle = "";
    try {
      detalle = htmlATexto(contenidoPrincipal(await bajarTexto(url)));
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
    });
  }
  return crudos;
}
