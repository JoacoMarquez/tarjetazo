import { NextResponse, type NextRequest } from "next/server";
import { esAdmin } from "@/lib/admin-emails";
import { refrescarSesion } from "@/lib/supabase-auth";

export async function middleware(request: NextRequest) {
  const { respuesta, usuario } = await refrescarSesion(request);

  // El backoffice no existe para quien no está en la allowlist: 404, no 403 ni
  // redirect al login. Las páginas y actions vuelven a chequear (`exigirAdmin`).
  const { pathname } = request.nextUrl;
  if ((pathname === "/admin" || pathname.startsWith("/admin/")) && !esAdmin(usuario)) {
    return NextResponse.rewrite(new URL("/404", request.url), { status: 404 });
  }

  return respuesta;
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
