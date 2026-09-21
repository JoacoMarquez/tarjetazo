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
