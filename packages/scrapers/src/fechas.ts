/**
 * Fecha de fin escrita en las condiciones de un beneficio, para cuando el
 * parser (o el modelo) no trae una. Solo frases de fin ("al …", "hasta el …"),
 * nunca de inicio ("desde el 15 de junio de 2020", "a partir del …"): una
 * promo "vigente desde 2020" no está vencida.
 *
 * Casos reales que se mostraban vigentes estando vencidos:
 * - "del 21 al 25 de setiembre de 2026" (Club El País)
 * - "Vigencia 01/12/2022 al 30/11/2023" (Nativa)
 * - "Vigencia todos los días hasta el 1 de agosto de 2026" (Pronto)
 */

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  setiembre: 9, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function iso(anio: number, mes: number, dia: number): string | null {
  if (anio < 100) anio += 2000;
  if (anio < 2015 || anio > 2100 || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const f = new Date(Date.UTC(anio, mes - 1, dia));
  if (f.getUTCMonth() !== mes - 1) return null; // 31 de junio
  return f.toISOString().slice(0, 10);
}

// "al 25 de setiembre de 2026", "hasta el 1 de agosto de 2026", "al 30/11/2023", "hasta el 31/12/26".
const CON_MES = /\b(?:al|hasta(?: el)?)\s+(\d{1,2})\s*(?:°|º)?\s+de\s+([a-z]+)\s+(?:de\s+|del\s+)?(\d{4})\b/g;
const NUMERICA = /\b(?:al|hasta(?: el)?)\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?!\/)\b/g;

/** La última fecha de fin que aparece en el texto (AAAA-MM-DD), o null. */
export function fechaFinDeTexto(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const t = sinAcentos(texto).replace(/\s+/g, " ");
  const fechas: string[] = [];
  for (const m of t.matchAll(CON_MES)) {
    const mes = MESES[m[2]!];
    const f = mes ? iso(Number(m[3]), mes, Number(m[1])) : null;
    if (f) fechas.push(f);
  }
  for (const m of t.matchAll(NUMERICA)) {
    const f = iso(Number(m[3]), Number(m[2]), Number(m[1]));
    if (f) fechas.push(f);
  }
  return fechas.length > 0 ? fechas.sort().at(-1)! : null;
}
