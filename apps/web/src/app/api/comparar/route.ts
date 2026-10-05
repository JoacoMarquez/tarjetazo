import { NextResponse } from "next/server";
import { errorInterno } from "@/lib/error-interno";
import { CATEGORIAS, DEPARTAMENTOS } from "@tarjetazo/core";
import { comparar } from "@/lib/comparar";

const CATS = new Set(CATEGORIAS.map((c) => c.slug));
const DEPTOS = new Set<string>(DEPARTAMENTOS);

function lista(v: string | null, valido: Set<string>) {
  return (v ?? "").split(",").map((x) => x.trim()).filter((x) => valido.has(x));
}

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  try {
    const ranking = await comparar(lista(p.get("cat"), CATS), lista(p.get("depto"), DEPTOS));
    return NextResponse.json(
      { ranking },
      { headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch (e) {
    return errorInterno("/api/comparar", e);
  }
}
