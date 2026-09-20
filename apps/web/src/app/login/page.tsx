import type { Metadata } from "next";
import { destinoSeguro } from "@/lib/supabase-auth";
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
  const params = await searchParams;
  const uno = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;

  return (
    <main className="bg-hueso grid min-h-screen grid-cols-1 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <PanelMarca />
      <div className="flex flex-col justify-center px-7 py-10 min-[900px]:px-[clamp(28px,6vw,88px)]">
        <FormularioLogin
          modoInicial={uno(params.modo) === "registro" ? "registro" : "login"}
          destino={destinoSeguro(uno(params.next))}
          errorInicial={uno(params.error)}
        />
      </div>
    </main>
  );
}
