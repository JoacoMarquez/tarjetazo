import { HomeCliente } from "@/components/home/home-cliente";
import { NOMBRES_DIA, diaEnUruguay } from "@/lib/filtros";
import { mejorPorRubro } from "@/lib/stats";

// Los beneficios cambian con el cron diario; una hora de caché alcanza y evita
// pegarle a Supabase en cada visita.
export const revalidate = 3600;

export default async function Home() {
  // Si Supabase no responde, la home sale igual: sin la grilla del día.
  const rubros = await mejorPorRubro().catch(() => []);
  return <HomeCliente rubros={rubros} dia={NOMBRES_DIA[diaEnUruguay()]!} />;
}
