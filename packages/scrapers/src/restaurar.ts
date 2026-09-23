/**
 * Beneficios de una página "sin cambios" que hay que volver a publicar (#48).
 *
 * Si una página falta un día en el fetch, sus beneficios se dan de baja. Si
 * vuelve igual, el runner no la normaliza (el hash coincide) y los beneficios
 * quedaban descartados para siempre. Se restauran los de índice menor a la
 * cantidad de tramos de la última normalización: esos son la versión actual
 * de la página. Los de índice mayor son tramos de una versión anterior que la
 * normalización siguiente ya no produjo, y tienen que seguir descartados.
 */
export function aRestaurar(
  fuenteId: string,
  externalId: string,
  tramos: number | undefined,
  descartados: ReadonlySet<string>,
): string[] {
  if (!tramos) return [];
  const out: string[] = [];
  for (let n = 0; n < tramos; n++) {
    const id = `${fuenteId}:${externalId}:${n}`;
    if (descartados.has(id)) out.push(id);
  }
  return out;
}
