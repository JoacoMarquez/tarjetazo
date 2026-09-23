const ZONA = "America/Montevideo";

const fechaHoraFmt = new Intl.DateTimeFormat("es-UY", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: ZONA,
});

/** "20 set, 06:03", siempre en hora de Uruguay (el server de Vercel corre en UTC). */
export function fechaHora(iso: string): string {
  return fechaHoraFmt.format(new Date(iso));
}

export function numero(n: number): string {
  return n.toLocaleString("es-UY");
}

/** "2026-09-23" en Uruguay. Sin horario de verano: siempre UTC-3. */
export function hoyUy(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** "2026-10-31" → "31/10/26". */
export function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a?.slice(2)}`;
}
