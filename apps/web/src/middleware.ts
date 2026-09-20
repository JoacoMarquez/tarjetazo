import type { NextRequest } from "next/server";
import { refrescarSesion } from "@/lib/supabase-auth";

export async function middleware(request: NextRequest) {
  return refrescarSesion(request);
}

export const config = {
  matcher: [
    /*
     * Todo menos los estáticos de Next, los assets y las rutas de API (que
     * leen el catálogo público y no necesitan sesión).
     */
    "/((?!_next/static|_next/image|api/|favicon.ico|icon|opengraph-image|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
