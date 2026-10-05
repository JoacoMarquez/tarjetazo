import { NextResponse } from "next/server";
import { ubicacionDeCabeceras } from "@/lib/ubicacion";

// Es de cada visita: nada de caché compartida.
export const dynamic = "force-dynamic";

/** País y ciudad aproximados de quien pregunta, para la analítica. */
export function GET(request: Request) {
  return NextResponse.json(ubicacionDeCabeceras(request.headers), {
    headers: { "cache-control": "private, no-store" },
  });
}
