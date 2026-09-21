"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, HeartPulse, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = {
  label: string;
  icono: typeof Activity;
  /** Sin `href` la pantalla todavía no existe y el ítem queda deshabilitado. */
  href?: "/admin" | "/admin/salud" | "/admin/revision";
};

const ITEMS: Item[] = [
  { label: "Corridas", icono: Activity, href: "/admin" },
  { label: "Salud de datos", icono: HeartPulse, href: "/admin/salud" },
  { label: "Cola de revisión", icono: Inbox, href: "/admin/revision" },
];

export function NavAdmin() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Backoffice"
      className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible"
    >
      {ITEMS.map(({ label, icono: Icono, href }) => {
        const clase =
          "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap";
        if (!href) {
          return (
            <span
              key={label}
              aria-disabled="true"
              title="Próximamente"
              className={cn(clase, "text-humo cursor-not-allowed")}
            >
              <Icono className="size-4" aria-hidden />
              {label}
            </span>
          );
        }
        // El detalle de una corrida cuelga de esta misma sección.
        const activo =
          href === "/admin"
            ? pathname === href || pathname.startsWith("/admin/corridas")
            : pathname.startsWith(href);
        return (
          <Link
            key={label}
            href={href}
            aria-current={activo ? "page" : undefined}
            className={cn(
              clase,
              activo
                ? "bg-cielo-s text-cielo-ink"
                : "text-pizarra hover:bg-papel-1",
            )}
          >
            <Icono className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
