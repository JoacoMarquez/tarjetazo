"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, CreditCard, Home, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("font-display font-extrabold tracking-tight", className)}
    >
      Tarjeta<span className="bg-marca bg-clip-text text-transparent">zo</span>
    </Link>
  );
}

type Item = {
  label: string;
  icono: typeof Home;
  ruta: string;
  href?: {
    pathname: "/" | "/app" | "/comparar";
    query?: Record<string, string>;
  };
};

const ITEMS: Item[] = [
  { label: "Inicio", icono: Home, ruta: "/", href: { pathname: "/" } },
  {
    label: "Explorar",
    icono: Compass,
    ruta: "/app",
    href: { pathname: "/app" },
  },
  {
    label: "Comparar",
    icono: Scale,
    ruta: "/comparar",
    href: { pathname: "/comparar" },
  },
  {
    label: "Mis tarjetas",
    icono: CreditCard,
    ruta: "/app",
    href: { pathname: "/app", query: { perfil: "1" } },
  },
];

/** Barra inferior de mobile. En escritorio no se muestra. */
export function NavInferior() {
  const ruta = usePathname();
  return (
    <nav
      aria-label="Navegación principal"
      className="border-linea bg-hueso/95 fixed inset-x-0 bottom-0 z-1000 border-t backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-lg">
        {ITEMS.map((item) => {
          const activo = ruta === item.ruta;
          const Icono = item.icono;
          return (
            <li key={item.label} className="flex-1">
              {!item.href ? (
                <span
                  aria-disabled
                  className="text-humo/50 flex flex-col items-center gap-0.5 py-2 text-[11px]"
                  title="Próximamente"
                >
                  <Icono className="size-5" />
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2 text-[11px]",
                    activo ? "text-cielo font-semibold" : "text-humo",
                  )}
                >
                  <Icono className="size-5" />
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function PieSitio() {
  return (
    <footer className="border-linea text-humo mt-16 border-t px-5 py-8 text-xs">
      <div className="mx-auto flex max-w-5xl flex-col gap-3">
        <p>
          Los beneficios pertenecen a sus fuentes. Cada ficha enlaza a la
          publicación oficial del banco o emisor, que es la que vale. Corregimos
          o damos de baja contenido a pedido.
        </p>
        <nav className="flex flex-wrap gap-4">
          <Link
            href="/ayuda"
            className="hover:text-cielo underline-offset-4 hover:underline"
          >
            Ayuda
          </Link>
          <Link
            href="/terminos"
            className="hover:text-cielo underline-offset-4 hover:underline"
          >
            Términos
          </Link>
          <Link
            href="/privacidad"
            className="hover:text-cielo underline-offset-4 hover:underline"
          >
            Privacidad
          </Link>
        </nav>
        <p>Hecho en Uruguay.</p>
      </div>
    </footer>
  );
}
