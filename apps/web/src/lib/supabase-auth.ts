import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { origenSupabase } from "@tarjetazo/core";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Cliente de sesión, aparte del de `supabase.ts`. Aquel lee el catálogo público
 * con `persistSession: false` y no debe tocar cookies; este guarda la sesión del
 * usuario (cookies en el browser, cookies de request/response en el server).
 */

type Credenciales = { url: string; anonKey: string };

/** Devuelve las claves, o `null` si el entorno no las tiene configuradas. */
export function credencialesAuth(): Credenciales | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url: origenSupabase(url), anonKey };
}

/** Cliente de browser con sesión persistida en cookies. */
export function createSupabaseBrowser() {
  const cred = credencialesAuth();
  if (!cred) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (ver .env.example)",
    );
  }
  return createBrowserClient(cred.url, cred.anonKey);
}

/**
 * Cliente para route handlers / server components que escriben cookies.
 * `cookieStore` es el resultado de `await cookies()` de `next/headers`.
 */
type AlmacenCookies = {
  getAll: () => { name: string; value: string }[];
  set: (name: string, value: string, options?: Record<string, unknown>) => void;
};

export function createSupabaseServidor(cookieStore: AlmacenCookies) {
  const cred = credencialesAuth();
  if (!cred) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (ver .env.example)",
    );
  }
  return createServerClient(cred.url, cred.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookies) => {
        try {
          for (const { name, value, options } of cookies) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Un Server Component no puede escribir cookies: el middleware ya
          // refrescó la sesión, así que se puede ignorar.
        }
      },
    },
  });
}

/**
 * Refresca la sesión en cada request y reenvía las cookies actualizadas.
 * Importante: hay que devolver *esta* respuesta para no perder las cookies.
 */
export async function refrescarSesion(request: NextRequest) {
  const cred = credencialesAuth();
  if (!cred) return NextResponse.next({ request });

  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(cred.url, cred.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        for (const { name, value } of cookies) {
          request.cookies.set(name, value);
        }
        respuesta = NextResponse.next({ request });
        for (const { name, value, options } of cookies) {
          respuesta.cookies.set(name, value, options);
        }
      },
    },
  });

  // No sacar: esta llamada es la que dispara el refresh del token.
  await supabase.auth.getUser();

  return respuesta;
}

/**
 * Solo se acepta un `next` relativo al sitio: cualquier cosa que apunte afuera
 * (incluido `//host`) se descarta para no habilitar un redirect abierto.
 */
export function destinoSeguro(
  next: string | null | undefined,
  porDefecto = "/app",
) {
  if (!next || !next.startsWith("/") || next.startsWith("//"))
    return porDefecto;
  return next;
}
