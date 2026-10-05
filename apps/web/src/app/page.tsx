import type { Metadata } from "next";
import { HomeCliente } from "@/components/home/home-cliente";
import { NOMBRES_DIA, diaEnUruguay } from "@/lib/filtros";
import { mejorPorRubro } from "@/lib/stats";
import { JsonLd } from "@/components/json-ld";

// Los beneficios cambian con el cron diario; una hora de caché alcanza y evita
// pegarle a Supabase en cada visita.
export const revalidate = 3600;

export const metadata: Metadata = { alternates: { canonical: "/" } };

const SITIO = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Tarjetazo",
  url: "https://tarjetazo.uy",
  inLanguage: "es-UY",
};

export default async function Home() {
  // Si Supabase no responde, la home sale igual: sin la grilla del día.
  const rubros = await mejorPorRubro().catch(() => []);
  return (
    <>
      <JsonLd datos={SITIO} />
      <HomeCliente rubros={rubros} dia={NOMBRES_DIA[diaEnUruguay()]!} />
    </>
  );
}
