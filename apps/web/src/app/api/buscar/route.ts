import { NextResponse } from "next/server";
import { leerFiltros } from "@/lib/filtros";
import { buscarComercios } from "@/lib/consultas";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ resultados: [] });
  try {
    return NextResponse.json({ resultados: await buscarComercios(q, leerFiltros(params)) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
