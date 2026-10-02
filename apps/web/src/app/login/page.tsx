import type { Metadata, Route } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServidor, destinoSeguro, loginConGoogleHabilitado } from "@/lib/supabase-auth";
import { FormularioLogin } from "./formulario-login";
import { PanelMarca } from "./panel-marca";

export const metadata: Metadata = {
  title: "Ingresar",
  description: "Entrá a tu cuenta de Tarjetazo o creá una nueva.",
  robots: { index: false, follow: true },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, conGoogle] = await Promise.all([searchParams, loginConGoogleHabilitado()]);
  const uno = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const destino = destinoSeguro(uno(params.next));

  // Con la sesión ya abierta no tiene sentido el formulario: de vuelta adonde iba.
  const { data } = await createSupabaseServidor(await cookies()).auth.getUser();
  if (data.user) redirect(destino as Route);

  return (
    <main className="bg-hueso grid min-h-screen grid-cols-1 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <PanelMarca />
      <div className="flex flex-col justify-center px-7 py-10 min-[900px]:px-[clamp(28px,6vw,88px)]">
        <FormularioLogin
          modoInicial={uno(params.modo) === "registro" ? "registro" : "login"}
          destino={destino}
          errorInicial={uno(params.error)}
          conGoogle={conGoogle}
        />
      </div>
    </main>
  );
}
