/** Texto fijo de la home. No sale de Supabase: es copy nuestro. */

export const PASOS = [
  {
    n: "1",
    titulo: "Elegís tus tarjetas",
    texto: "Marcás los bancos y billeteras que usás. Queda en tu navegador, sin cuenta.",
  },
  {
    n: "2",
    titulo: "Filtrás por lo tuyo",
    texto: "Por rubro, por día y por departamento. En el mapa ves qué locales tenés cerca.",
  },
  {
    n: "3",
    titulo: "Se actualiza solo",
    texto:
      "Todos los días leemos las páginas oficiales de cada fuente y guardamos el texto original.",
  },
] as const;

export const FAQ = [
  {
    q: "¿Necesito crear una cuenta?",
    a: "No. Elegís tus tarjetas y queda guardado en tu navegador. Podés compartir tu selección por link.",
  },
  {
    q: "¿Me piden el número de la tarjeta?",
    a: "Nunca. Solo qué banco o billetera usás. Tarjetazo no se conecta con tu banco.",
  },
  {
    q: "¿De dónde salen los beneficios?",
    a: "De las páginas oficiales de BROU, Santander, Scotiabank, Itaú, OCA, Prex y BBVA. Cada ficha enlaza a la publicación original.",
  },
  {
    q: "¿Cada cuánto se actualiza?",
    a: "Todos los días a las 6 de la mañana. Lo que la fuente deja de publicar se marca como vencido.",
  },
] as const;

/**
 * Canastas semanales supuestas para el "ahorro estimado por mes". No son datos
 * de nadie: son un consumo típico con el que multiplicamos los porcentajes
 * reales de hoy, y así la cifra sube o baja con las tarjetas que elegiste.
 */
export const CANASTA_SEMANAL: Record<string, number> = {
  supermercados: 2500,
  combustible: 1500,
  delivery: 700,
};
