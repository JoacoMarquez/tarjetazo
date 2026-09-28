import { slugificar } from "./slug.js";
import type { Crudo, Extraido } from "./tipos.js";

/**
 * Si la fuente ya dijo de qué comercio es la página (`crudo.comercio`), ese
 * manda sobre el del normalizador. Con el modelo pasó que 18 landings de
 * restaurantes de Itaú ("Cauce (restaurantes)", "La huella (restaurantes)")
 * quedaron todas en un comercio "Restaurantes". Si el normalizador decidió que
 * no hay beneficio, no se inventa un comercio.
 */
export function conComercioDeFuente(extraido: Extraido, crudo: Crudo): Extraido {
  if (!crudo.comercio || !extraido.comercio) return extraido;
  const key = slugificar(crudo.comercio.nombre);
  return {
    ...extraido,
    comercio: { key, nombre: crudo.comercio.nombre, categoria: crudo.comercio.categoria },
    beneficios: extraido.beneficios.map((b) => ({ ...b, comercio_key: key })),
  };
}
