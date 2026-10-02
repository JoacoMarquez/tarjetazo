/** Tipos de link de mail que acepta /auth/confirm (un subconjunto de `EmailOtpType`). */
const TIPOS = ["recovery", "email", "signup", "email_change"] as const;
export type TipoLink = (typeof TIPOS)[number];

export function tipoValido(tipo: string | null | undefined): tipo is TipoLink {
  return !!tipo && (TIPOS as readonly string[]).includes(tipo);
}
