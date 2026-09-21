/**
 * Reglas de la cola de revisión que comparten el pipeline y el backoffice. Las
 * dos puntas tienen que normalizar igual: un alias guardado desde /admin se
 * busca después, en el runner, por este mismo texto.
 */

/** Sin acentos, en minúsculas y con los espacios colapsados. */
export function normalizarNombreTarjeta(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * El `motivo` de una revisión junta con " | " todo lo que no se pudo resolver
 * en la página: nombres de tarjeta que no mapean y errores de validación de un
 * tramo (que empiezan con "tramo N:").
 */
export function problemasDeMotivo(motivo: string): string[] {
  return motivo
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Un error de validación no es un nombre de tarjeta: no admite alias ni regla. */
export function esErrorDeTramo(problema: string): boolean {
  return problema.startsWith("tramo ");
}
