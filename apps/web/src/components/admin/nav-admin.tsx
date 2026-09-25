"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ClipboardCheck, CreditCard, HeartPulse, Inbox, SearchX, Sparkles, Store, Tags } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = {
  label: string;
  icono: typeof Activity;
  /** Sin `href` la pantalla todavía no existe y el ítem queda deshabilitado. */
  href?: "/admin" | "/admin/salud" | "/admin/revision" | "/admin/beneficios" | "/admin/novedades" | "/admin/auditoria" | "/admin/busquedas" | "/admin/tarjetas" | "/admin/comercios";
};

const ITEMS: Item[] = [
  { label: "Corridas", icono: Activity, href: "/admin" },
  { label: "Novedades", icono: Sparkles, href: "/admin/novedades" },
  { label: "Salud de datos", icono: HeartPulse, href: "/admin/salud" },
  { label: "Cola de revisión", icono: Inbox, href: "/admin/revision" },
  { label: "Beneficios", icono: Tags, href: "/admin/beneficios" },
  { label: "Tarjetas", icono: CreditCard, href: "/admin/tarjetas" },
  { label: "Comercios", icono: Store, href: "/admin/comercios" },
  { label: "Auditoría", icono: ClipboardCheck, href: "/admin/auditoria" },
  { label: "Búsquedas sin resultado", icono: SearchX, href: "/admin/busquedas" },
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
