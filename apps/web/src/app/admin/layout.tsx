import type { Metadata } from "next";
import Link from "next/link";
import { NavAdmin } from "@/components/admin/nav-admin";
import { Logo } from "@/components/nav";
import { exigirAdmin } from "@/lib/admin";

export const metadata: Metadata = {
  title: { default: "Backoffice", template: "%s · Backoffice" },
  robots: { index: false, follow: false },
};

// Nada de `/admin` se cachea ni se prerenderiza: siempre hay sesión de por medio.
export const dynamic = "force-dynamic";

export default async function LayoutAdmin({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await exigirAdmin();

  return (
    <div className="bg-hueso text-tinta min-h-screen md:grid md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="border-linea bg-papel sticky top-0 z-10 flex flex-col gap-3 border-b px-4 py-3 md:h-screen md:gap-6 md:border-r md:border-b-0 md:py-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <Logo className="text-lg" />
            <span className="text-humo-oscuro text-xs font-semibold tracking-wide uppercase">
              admin
            </span>
          </div>
          <Link href="/" className="text-pizarra text-xs hover:underline md:hidden">
            Ver sitio
          </Link>
        </div>
        <NavAdmin />
        <div className="text-humo-oscuro mt-auto hidden text-xs md:block">
          <p className="truncate" title={usuario.email}>
            {usuario.email}
          </p>
          <Link href="/" className="text-pizarra hover:underline">
            Ver sitio
          </Link>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
