import { NextResponse } from "next/server";
import { leerFiltros } from "@/lib/filtros";
import { puntosDelMapa } from "@/lib/consultas";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const nums = ["sur", "oeste", "norte", "este"].map((k) => Number(params.get(k)));
  if (nums.some((n) => !Number.isFinite(n))) {
    return NextResponse.json({ error: "faltan sur/oeste/norte/este" }, { status: 400 });
  }
  const [sur, oeste, norte, este] = nums as [number, number, number, number];
  try {
    const r = await puntosDelMapa(leerFiltros(params), { sur, oeste, norte, este });
    return NextResponse.json(r, {
      headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=3600" },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
