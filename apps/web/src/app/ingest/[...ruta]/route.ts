import { NextResponse, type NextRequest } from "next/server";
import { cabecerasDeVuelta, cabecerasHaciaPostHog, destinoIngest } from "@/lib/ingest";

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
  const r = await fetch(destino, {
    method: request.method,
    headers: cabecerasHaciaPostHog(request.headers),
    body: conCuerpo ? await request.arrayBuffer() : undefined,
    redirect: "manual",
    cache: "no-store",
  });
  return new NextResponse(r.body, { status: r.status, headers: cabecerasDeVuelta(r.headers) });
}

export { proxy as GET, proxy as POST, proxy as HEAD };
