"use client";

import type { User as Usuario } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { KeyRound, LogOut, User } from "lucide-react";
import { GRADIENTE } from "@/lib/marca";
import { createSupabaseBrowser, credencialesAuth } from "@/lib/supabase-auth";

const PIZARRA = "#2b3a4a";

/** El nombre que dejó al crear la cuenta, o el mail si no hay. */
function nombreDe(usuario: Usuario): string {
  const nombre = usuario.user_metadata?.nombre;
  return typeof nombre === "string" && nombre.trim() ? nombre.trim() : (usuario.email ?? "Tu cuenta");
}

/**
 * El botón de cuenta del header. Sin sesión lleva a /login; con sesión muestra
 * la inicial y abre un menú con la cuenta, cambiar la contraseña y salir.
 *
 * La sesión se lee en el browser y no en el server: las páginas públicas tienen
 * ISR y un header renderizado con la sesión de alguien quedaría en el cache.
 * Lo que se lee acá solo decide qué se muestra; no autoriza nada.
 */
export function BotonCuenta() {
  const ruta = usePathname();
  const router = useRouter();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!credencialesAuth()) return;
    const supabase = createSupabaseBrowser();
    // Avisa la sesión guardada al arrancar (INITIAL_SESSION) y cada cambio.
    const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      setUsuario(sesion?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  if (!usuario) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(ruta)}`}
        aria-label="Ingresar o crear cuenta"
        className="hidden size-10 items-center justify-center rounded-full text-white sm:inline-flex"
        style={{ background: PIZARRA }}
      >
        <User className="size-[18px]" strokeWidth={2} />
      </Link>
    );
  }

  const nombre = nombreDe(usuario);

  async function salir() {
    setSaliendo(true);
    try {
      // Revoca la sesión en Supabase y borra las cookies; el evento SIGNED_OUT
      // vuelve el botón a "Ingresar".
      await createSupabaseBrowser().auth.signOut({ scope: "local" });
    } finally {
      setSaliendo(false);
      setAbierto(false);
      router.refresh();
    }
  }

  return (
    <div ref={caja} className="relative hidden sm:block">
      <button
        type="button"
        aria-label={`Tu cuenta: ${nombre}`}
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
        className="font-display inline-flex size-10 cursor-pointer items-center justify-center rounded-full text-base font-bold"
        style={{ backgroundImage: GRADIENTE, color: "#14202c" }}
      >
        {nombre.charAt(0).toUpperCase()}
      </button>
      {abierto && (
        <div
          role="menu"
          className="bg-hueso border-linea absolute right-0 top-12 z-40 w-64 overflow-hidden rounded-[14px] border shadow-lg"
        >
          <div className="border-linea border-b px-4 py-3">
            <p className="text-tinta truncate text-sm font-semibold">{nombre}</p>
            {usuario.email && usuario.email !== nombre ? (
              <p className="text-humo truncate text-xs">{usuario.email}</p>
            ) : null}
          </div>
          <Link
            role="menuitem"
            href={`/auth/nueva-contrasena?next=${encodeURIComponent(ruta)}`}
            onClick={() => setAbierto(false)}
            className="text-tinta hover:bg-papel flex items-center gap-2.5 px-4 py-2.5 text-sm"
          >
            <KeyRound className="text-humo size-4" strokeWidth={2} />
            Cambiar contraseña
          </Link>
          <button
            role="menuitem"
            type="button"
            disabled={saliendo}
            onClick={salir}
            className="text-tinta hover:bg-papel flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left text-sm disabled:opacity-60"
          >
            <LogOut className="text-humo size-4" strokeWidth={2} />
            {saliendo ? "Saliendo…" : "Cerrar sesión"}
          </button>
        </div>
      )}
    </div>
  );
}
