/**
 * Allowlist del backoffice. Vive aparte de `admin.ts` porque el middleware
 * corre en el edge y no puede importar `next/headers` ni la service role.
 */

type UsuarioMinimo = {
  id?: string | null;
  email?: string | null;
  email_confirmed_at?: string | null;
} | null;

function lista(valor: string | undefined): string[] {
  return (valor ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const idsAdmin = () => lista(process.env.ADMIN_USER_IDS);
export const emailsAdmin = () => lista(process.env.ADMIN_EMAILS);

/**
 * Con `ADMIN_USER_IDS` manda el id del usuario de Supabase, que no cambia ni
 * depende de cómo el proyecto confirma emails (un proveedor OAuth, o "Confirm
 * email" apagado, podrían dar por confirmado el mail de otro). En ese caso
 * `ADMIN_EMAILS` no se usa.
 *
 * Sin ids, queda la allowlist por email, que tiene que estar confirmado: si no,
 * alcanzaría con registrarse con el mail de otro. Sin ninguna de las dos, no
 * entra nadie.
 */
export function esAdmin(usuario: UsuarioMinimo): boolean {
  const ids = idsAdmin();
  if (ids.length > 0) return !!usuario?.id && ids.includes(usuario.id.toLowerCase());
  if (!usuario?.email || !usuario.email_confirmed_at) return false;
  return emailsAdmin().includes(usuario.email.toLowerCase());
}
