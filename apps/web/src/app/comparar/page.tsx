import type { Metadata } from "next";
import { matrizComparar } from "@/lib/comparar-tarjetas";
import { CompararCliente } from "./comparar-cliente";

// La matriz sale de los beneficios, que cambian con el cron diario: una hora
// de caché alcanza y evita recalcularla en cada visita.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Comparar tus tarjetas",
  description:
    "Cuánto te ahorra cada tarjeta por mes según dónde gastás, qué días conviene cada una y si vale la pena sumar una nueva.",
};

export default async function PaginaComparar() {
  // Si Supabase no responde, la página sale igual: sin datos que comparar.
  const matriz = await matrizComparar().catch(() => ({}));
  return <CompararCliente matriz={matriz} />;
}
