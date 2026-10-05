import { NextResponse } from "next/server";
import { errorInterno } from "@/lib/error-interno";
import { listarBeneficios, type BeneficioListado } from "@/lib/consultas";
import { FILTROS_VACIOS } from "@/lib/filtros";
import { createSupabaseClient } from "@/lib/supabase";

/** Un comercio guardado, con sus beneficios vigentes (#115). */
export interface ComercioFavorito {
  /** La key guardada en el navegador. */
  guardada: string;
  /** La key actual: distinta si el comercio se fusionó en otro desde que se guardó. */
  key: string;
  nombre: string;
  categoria: string;
  logo_url: string | null;
  beneficios: BeneficioListado[];
  /** Cuántos tiene vigentes; `beneficios` trae solo los primeros. */
  total: number;
}

const MAXIMO = 60;
const EN_PARALELO = 6;
const KEY = /^[a-z0-9-]{1,120}$/;

/**
 * Los favoritos viven en el navegador: esto recibe sus keys y devuelve cada
 * comercio con sus beneficios vigentes. Una key fusionada desde el backoffice
 * (`comercio_alias`) se resuelve al comercio que quedó; una que ya no existe
 * no vuelve (la página la ofrece para sacar).
 */
export async function GET(request: Request) {
  const guardadas = (new URL(request.url).searchParams.get("keys") ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter((k) => KEY.test(k))
    .slice(0, MAXIMO);
  if (guardadas.length === 0) return NextResponse.json({ comercios: [] });

  try {
    const db = createSupabaseClient();
    const { data: alias, error: e1 } = await db.from("comercio_alias").select("alias_key, comercio_key").in("alias_key", guardadas);
    if (e1) throw new Error(e1.message);
    const destino = new Map((alias ?? []).map((a) => [a.alias_key as string, a.comercio_key as string]));
    const actuales = [...new Set(guardadas.map((k) => destino.get(k) ?? k))];

    const { data: filas, error: e2 } = await db.from("comercio").select("key, nombre, categoria, logo_url").in("key", actuales);
    if (e2) throw new Error(e2.message);
    const porKey = new Map(
      (filas ?? []).map((c) => [c.key as string, c as { key: string; nombre: string; categoria: string; logo_url: string | null }]),
    );

    // Una consulta por comercio, pero de a `EN_PARALELO`: con 60 favoritos no
    // salen 60 juntas.
    const keys = [...porKey.keys()];
    const beneficios = new Map<string, { beneficios: BeneficioListado[]; total: number }>();
    for (let i = 0; i < keys.length; i += EN_PARALELO) {
      await Promise.all(
        keys.slice(i, i + EN_PARALELO).map(async (key) => {
          const r = await listarBeneficios({ ...FILTROS_VACIOS, comercio: key }, 0, 20);
          beneficios.set(key, { beneficios: r.beneficios, total: Number(r.total) });
        }),
      );
    }

    const comercios: ComercioFavorito[] = [];
    for (const guardada of guardadas) {
      const c = porKey.get(destino.get(guardada) ?? guardada);
      if (!c || comercios.some((x) => x.key === c.key)) continue;
      comercios.push({
        guardada,
        key: c.key,
        nombre: c.nombre,
        categoria: c.categoria,
        logo_url: c.logo_url,
        beneficios: beneficios.get(c.key)?.beneficios ?? [],
        total: beneficios.get(c.key)?.total ?? 0,
      });
    }
    return NextResponse.json(
      { comercios },
      { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=3600" } },
    );
  } catch (e) {
    return errorInterno("/api/favoritos", e);
  }
}
