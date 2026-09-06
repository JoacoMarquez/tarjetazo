import { bajarTexto } from "../http.js";
import { htmlATexto } from "../texto.js";
import type { Crudo } from "../tipos.js";

const BASE = "https://www.prexcard.com";
const LISTADO = `${BASE}/beneficios`;

/**
 * Prex lista sus promociones en /beneficios como tarjetas-imagen con un "Ver
 * más" a /beneficiosprex?beneficio=<id>, agrupadas en tres secciones. La
 * última es "Promociones finalizadas": no se normaliza. La ficha de cada
 * promoción sí viene en texto (título, resumen, validez, condiciones, legales).
 *
 * Ojo con el host: prexcard.com sin www redirige a la home y esconde la
 * sección; hay que pegarle a www.
 */
function idsVigentes(html: string): string[] {
  const secciones = [...html.matchAll(/beneficios-menu-title'>([^<]+)</g)].map((m) => ({
    pos: m.index,
    nombre: m[1]!.trim(),
  }));
  const ids: string[] = [];
  for (const m of html.matchAll(/beneficiosprex\?beneficio=(\d+)/g)) {
    const seccion = [...secciones].reverse().find((s) => s.pos < m.index);
    if (seccion && /finalizad/i.test(seccion.nombre)) continue;
    if (!ids.includes(m[1]!)) ids.push(m[1]!);
  }
  return ids;
}

/**
 * El menú se repite completo antes del contenido. El cuerpo va desde el
 * título de la promo (que es el <title> de la página) hasta el pie de
 * página institucional.
 */
function cuerpo(html: string): string {
  const titulo = htmlATexto(html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "").replace(/^Prex\s*[─-]\s*/, "").trim();
  const texto = htmlATexto(html);
  const lineas = texto.split("\n");
  // Arranca en la última aparición de "CARGAR SALDO" (fin del menú).
  let desde = lineas.lastIndexOf("CARGAR SALDO");
  if (desde < 0) desde = 0;
  let hasta = lineas.findIndex((l, i) => i > desde && /^Brindamos acceso/i.test(l));
  if (hasta < 0) hasta = lineas.length;
  const contenido = lineas
    .slice(desde + 1, hasta)
    .filter((l) => !/^(Cargar Prex|Ver más\.{0,3})$/i.test(l))
    .join("\n")
    .trim();
  return [titulo, contenido].filter(Boolean).join("\n\n");
}

export async function fetchPrex(): Promise<Crudo[]> {
  const ids = idsVigentes(await bajarTexto(LISTADO));
  const crudos: Crudo[] = [];
  for (const id of ids) {
    const url = `${BASE}/beneficiosprex?beneficio=${id}`;
    const html = await bajarTexto(url);
    crudos.push({
      fuente_id: "prex",
      external_id: id,
      url_fuente: url,
      contenido: cuerpo(html),
      fetched_at: new Date().toISOString(),
    });
  }
  return crudos;
}
