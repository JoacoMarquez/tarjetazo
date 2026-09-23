import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { PanelMarca } from "@/app/login/panel-marca";
import { createSupabaseServidor, destinoSeguro } from "@/lib/supabase-auth";
import { FormularioNuevaContrasena } from "./formulario";

export const metadata: Metadata = {
  title: "Contraseña nueva",
  robots: { index: false, follow: false },
};

// Depende de la sesión que abrió el link del mail: nunca se prerenderiza.
export const dynamic = "force-dynamic";

/**
 * Adonde lleva el link de "¿La olvidaste?" (#38). El link ya inició sesión
 * (`/auth/callback` cambió el código); acá se elige la contraseña nueva.
 */
export default async function NuevaContrasena({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = Array.isArray(params.next) ? params.next[0] : params.next;
  const { data } = await createSupabaseServidor(await cookies()).auth.getUser();

  return (
    <main className="bg-hueso grid min-h-screen grid-cols-1 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <PanelMarca />
      <div className="flex flex-col justify-center px-7 py-10 min-[900px]:px-[clamp(28px,6vw,88px)]">
        {data.user?.email ? (
          <FormularioNuevaContrasena email={data.user.email} destino={destinoSeguro(next)} />
        ) : (
          <div className="w-full max-w-[400px]">
            <h1 className="font-display mt-7 text-[30px] leading-[1.1] font-bold tracking-[-0.02em]">
              El link venció
            </h1>
            <p className="text-humo mt-3 text-sm leading-relaxed">
              Los links para cambiar la contraseña se usan una sola vez y duran
              poco. Pedí uno nuevo desde «¿La olvidaste?».
            </p>
            <Link href="/login" className="text-cielo mt-5 inline-block text-sm font-medium">
              Ir a ingresar
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
