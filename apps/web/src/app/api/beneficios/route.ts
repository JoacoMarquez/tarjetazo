import { NextResponse } from "next/server";
import { leerFiltros } from "@/lib/filtros";
import { listarBeneficios } from "@/lib/consultas";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const pagina = Math.max(0, Number(params.get("pagina") ?? 0) || 0);
  try {
    const r = await listarBeneficios(leerFiltros(params), pagina);
    return NextResponse.json(r, {
      headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=3600" },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
