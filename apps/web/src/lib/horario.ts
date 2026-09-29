/**
 * Horarios de OpenStreetMap (`opening_hours`) en castellano (#118):
 * "Mo-Fr 09:00-20:00; Sa 09:00-13:00" → ["Lun a vie: 9 a 20", "Sáb: 9 a 13"].
 * Solo las formas simples, que son casi todas; con algo que no entiende
 * (meses, feriados con fecha, "sunrise") devuelve null y la página no lo
 * muestra: mejor nada que un horario mal leído.
 */

const DIAS: Record<string, string> = { Mo: "lun", Tu: "mar", We: "mié", Th: "jue", Fr: "vie", Sa: "sáb", Su: "dom", PH: "feriados" };

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** "09:00" → "9", "08:30" → "8:30". */
function hora(h: string): string | null {
  const m = h.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = m[2]!;
  if (hh > 24 || Number(mm) > 59) return null;
  return mm === "00" ? String(hh) : `${hh}:${mm}`;
}

/** "Mo-Fr,Su" → "lun a vie y dom". */
function dias(texto: string): string | null {
  const partes: string[] = [];
  for (const tramo of texto.split(",")) {
    const r = tramo.trim().match(/^(Mo|Tu|We|Th|Fr|Sa|Su|PH)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/);
    if (!r) return null;
    if (r[2]) {
      // "Fr-Mo" da la vuelta por el fin de semana: vale igual.
      if (r[1] === "PH") return null;
      partes.push(`${DIAS[r[1]!]} a ${DIAS[r[2]]}`);
    } else {
      partes.push(DIAS[r[1]!]!);
    }
  }
  return partes.length === 1 ? partes[0]! : `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
}

/** "08:30-12:30,14:00-18:30" → "8:30 a 12:30 y 14 a 18:30". */
function horas(texto: string): string | null {
  const t = texto.trim();
  if (/^(off|closed)$/i.test(t)) return "cerrado";
  const tramos: string[] = [];
  for (const r of t.split(",")) {
    const m = r.trim().match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
    if (!m) return null;
    const a = hora(m[1]!);
    const b = hora(m[2]!);
    if (!a || !b) return null;
    tramos.push(`${a} a ${b}`);
  }
  return tramos.length === 1 ? tramos[0]! : `${tramos.slice(0, -1).join(", ")} y ${tramos.at(-1)}`;
}

export function horarioLegible(osm: string | null | undefined): string[] | null {
  const t = osm?.trim();
  if (!t) return null;
  if (t === "24/7") return ["Abierto las 24 horas"];
  const lineas: string[] = [];
  for (const regla of t.split(";").map((r) => r.trim()).filter(Boolean)) {
    // "Mo-Fr 09:00-20:00", "Sa,Su off", o solo horas ("09:00-18:00": todos los días).
    const m = regla.match(/^([A-Za-z,\-\s]+?)\s+(\d.*|off|closed)$/i);
    const d = m ? dias(m[1]!.replace(/\s+/g, "")) : "todos los días";
    const h = horas(m ? m[2]! : regla);
    if (!d || !h) return null;
    lineas.push(`${mayuscula(d)}: ${h}`);
  }
  return lineas.length > 0 ? lineas : null;
}
