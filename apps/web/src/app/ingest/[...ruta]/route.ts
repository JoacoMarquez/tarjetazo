import { NextResponse, type NextRequest } from "next/server";
import { MAX_CUERPO_INGEST, cabecerasDeVuelta, cabecerasHaciaPostHog, destinoIngest } from "@/lib/ingest";

export const dynamic = "force-dynamic";

async function proxy(request: NextRequest, { params }: { params: Promise<{ ruta: string[] }> }) {
  const destino = destinoIngest(
    (await params).ruta,
    request.nextUrl.search,
    process.env.NEXT_PUBLIC_POSTHOG_KEY,
    request.nextUrl.pathname.endsWith("/"),
  );
  if (!destino) return new NextResponse(null, { status: 404 });
  const conCuerpo = request.method !== "GET" && request.method !== "HEAD";
  if (Number(request.headers.get("content-length") ?? 0) > MAX_CUERPO_INGEST) return new NextResponse(null, { status: 413 });
  const cuerpo = conCuerpo ? await request.arrayBuffer() : undefined;
  if (cuerpo && cuerpo.byteLength > MAX_CUERPO_INGEST) return new NextResponse(null, { status: 413 });
  const r = await fetch(destino, {
    method: request.method,
    headers: cabecerasHaciaPostHog(request.headers),
    body: cuerpo,
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  return new NextResponse(r.body, { status: r.status, headers: cabecerasDeVuelta(r.headers) });
}

export { proxy as GET, proxy as POST, proxy as HEAD };
