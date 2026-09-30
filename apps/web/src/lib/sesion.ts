/**
 * Si el refresh falló por límite de pedidos, Supabase no dijo que la sesión
 * sea inválida: solo que ahora no atiende. auth-js igual borra la sesión, y
 * escribir ese borrado desloguearía a un usuario real por tráfico ajeno.
 */
export function esLimiteDePedidos(error: { status?: number; code?: string } | null): boolean {
  return !!error && (error.status === 429 || error.code === "over_request_rate_limit");
}
