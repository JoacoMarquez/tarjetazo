/**
 * Dónde publica cada banco su catálogo de tarjetas (#27). Una página puede
 * traer varias tarjetas (BROU: "Productos y Requisitos"). Se combinan páginas
 * fijas con las que se descubren en el índice por patrón, así una tarjeta nueva
 * con página propia entra sola.
 */
export interface FuenteCatalogo {
  fuente_id: string;
  base: string;
  indice: string;
  /** Páginas que siempre se leen (listados con varias tarjetas). */
  fijas: string[];
  /** Links del índice que son fichas de tarjetas. */
  patron: RegExp;
  /** Links que matchean el patrón pero no son tarjetas (contratos, seguridad…). */
  excluir: RegExp;
  comoNavegador?: boolean;
}

export const FUENTES_CATALOGO: FuenteCatalogo[] = [
  {
    fuente_id: "santander",
    base: "https://www.santander.com.uy",
    indice: "/todas-las-tarjetas",
    fijas: [],
    patron: /^\/(todas-las-tarjetas\/[^/]+|select\/pack-trilogy[^/]*|tarjetas\/pack-trilogy[^/]*)$/i,
    excluir: /empresa|pyme|agro|corporativ/i,
  },
  {
    fuente_id: "brou",
    base: "https://www.brou.com.uy",
    indice: "/personas/tarjetas",
    fijas: [
      "/web/guest/personas/tarjetas/visa/productos",
      "/web/guest/personas/tarjetas/master/productos",
    ],
    patron: /^\/web\/guest\/personas\/tarjetas\/(visa-platinum|mastercard-black|mastercard\/[^/]+|debito-mastercard\/[^/]+|redbrou-visa\/mi-brou|prepaga-alfabrou)\/?$/i,
    excluir: /contratos|ventajas|convenios|seguridad|alertas|viaj|pin|notificacion|institucional/i,
  },
  {
    fuente_id: "bbva",
    base: "https://www.bbva.com.uy",
    indice: "/personas/productos/tarjetas.html",
    fijas: ["/personas/productos/tarjetas/tarjeta-de-debito.html"],
    patron: /^\/personas\/productos\/tarjetas\/tarjeta-de-credito\/[^?#]+\.html$/i,
    excluir: /empresa|pyme|agro|corporativ/i,
    comoNavegador: true,
  },
];

/** Tarjetas que no son de consumo: no llegan a la bandeja (decisión del grill). */
export const NO_CONSUMO = /corporativ|empresa|pyme|agro|business|comercial/i;
