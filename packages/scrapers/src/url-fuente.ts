import { FUENTES } from "@tarjetazo/core";

/**
 * Dominios donde cada fuente publica sus beneficios. `url_fuente` es el botón
 * "Ver en el sitio de <banco>": si el listado de una fuente trae un link a
 * otro lado, el botón no puede llevar ahí. OCA queda afuera a propósito:
 * algunas promos suyas apuntan al sitio del comercio (movie.com.uy,
 * iplace.com.uy).
 */
const DOMINIOS: Record<string, readonly string[] | "cualquiera"> = {
  brou: ["brou.com.uy"],
  santander: ["santander.com.uy"],
  scotiabank: ["scotiabank.com.uy", "scotiabank.com"],
  itau: ["itau.com.uy"],
  oca: "cualquiera",
  prex: ["prexcard.com.uy", "prex.com.uy"],
  bbva: ["bbva.com.uy"],
  midinero: ["midinero.com.uy"],
  nativa: ["nativacabal.com.uy"],
  "club-el-pais": ["clubelpais.com.uy"],
  anda: ["anda.com.uy"],
  asi: ["asi-clubdescuentos.com.uy"],
  pronto: ["pronto.com.uy"],
  creditel: ["creditel.com.uy"],
  passcard: ["passcard.com.uy"],
};

/**
 * La `url_fuente` que se guarda: la de la página si es http(s) y está en un
 * dominio de la fuente; si no, la portada de la fuente.
 */
export function urlFuenteConfiable(fuenteId: string, url: string): string {
  const portada = FUENTES.find((f) => f.id === fuenteId)?.url;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return portada ?? url;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return portada ?? url;
  const dominios = DOMINIOS[fuenteId];
  if (dominios === "cualquiera") return url;
  // Una fuente nueva sin dominios cargados: su propia portada.
  const permitidos = dominios ?? (portada ? [new URL(portada).hostname.replace(/^www\./, "")] : []);
  const host = u.hostname.toLowerCase();
  return permitidos.some((d) => host === d || host.endsWith(`.${d}`)) ? url : (portada ?? url);
}
