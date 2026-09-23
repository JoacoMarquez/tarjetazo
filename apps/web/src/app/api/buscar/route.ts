import { NextResponse } from "next/server";
import { buscarComercios, registrarBusquedaVacia } from "@/lib/consultas";
import { FILTROS_VACIOS, leerFiltros } from "@/lib/filtros";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ resultados: [] });
  try {
    const filtros = leerFiltros(params);
    const resultados = await buscarComercios(q, filtros);
    if (resultados.length === 0) await anotarSiFalta(q, filtros);
    return NextResponse.json({ resultados });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * Si no apareció nada, se anota para el backoffice (#24). Antes se descarta
 * que sea por los filtros (bancos, "solo mis tarjetas"): solo cuenta si sin
 * filtros tampoco existe, que es lo que dice que el comercio falta. Nunca
 * rompe la búsqueda.
 */
async function anotarSiFalta(q: string, filtros: ReturnType<typeof leerFiltros>) {
  try {
    const conFiltros = filtros.bancos.length > 0 || filtros.soloMisTarjetas;
    if (conFiltros && (await buscarComercios(q, FILTROS_VACIOS)).length > 0) return;
    await registrarBusquedaVacia(q);
  } catch {
    // Anotar es secundario: la respuesta al usuario ya está.
  }
}
