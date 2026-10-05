const MENORES = new Set(["de", "del", "la", "las", "los", "el", "y"]);

/** "CIUDAD DE LA COSTA" → "Ciudad de la Costa". Lo que no está todo en mayúsculas queda igual. */
export function nombreDeLugar(texto: string): string {
  if (texto !== texto.toUpperCase()) return texto;
  return texto
    .toLowerCase()
    .split(" ")
    .map((p, i) => (i > 0 && MENORES.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

const plano = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** La dirección de un local con su localidad, sin repetirla si la dirección ya la dice. */
export function direccionConLocalidad(direccion: string, localidad: string | null): string {
  if (!localidad) return direccion;
  const lugar = nombreDeLugar(localidad);
  return plano(direccion).includes(plano(lugar)) ? direccion : `${direccion}, ${lugar}`;
}
