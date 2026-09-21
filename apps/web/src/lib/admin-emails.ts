/**
 * Allowlist del backoffice. Vive aparte de `admin.ts` porque el middleware
 * corre en el edge y no puede importar `next/headers` ni la service role.
 */

type UsuarioMinimo = {
  email?: string | null;
  email_confirmed_at?: string | null;
} | null;

export function emailsAdmin(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * El email tiene que estar confirmado: si no, alcanzaría con registrarse con
 * el mail de otro para pasar la allowlist. Sin `ADMIN_EMAILS` no entra nadie.
 */
export function esAdmin(usuario: UsuarioMinimo): boolean {
  if (!usuario?.email || !usuario.email_confirmed_at) return false;
  return emailsAdmin().includes(usuario.email.toLowerCase());
}
