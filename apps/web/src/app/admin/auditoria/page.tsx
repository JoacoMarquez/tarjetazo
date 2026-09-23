import type { Metadata } from "next";
import Link from "next/link";
import { FUENTES } from "@tarjetazo/core";
import { LadoALado } from "@/components/admin/lado-a-lado";
import { createSupabaseAdmin, exigirAdmin } from "@/lib/admin";
import { numero } from "@/lib/admin/formato";
import { COLUMNAS_TRAMO, paginaDeBeneficio, urlInspector, type Tramo } from "@/lib/admin/paginas";
import { cn } from "@/lib/utils";
import { armarMuestra, responder } from "./actions";

export const metadata: Metadata = { title: "Auditoría" };

const NOMBRE_FUENTE = new Map(FUENTES.map((f) => [f.id as string, f.nombre]));

type Item = {
  id: string;
  beneficio_id: string;
  resultado: "bien" | "mal" | null;
  nota: string | null;
};
type Precision = { fuente_id: string; respondidas: number; bien: number; precision_pct: number };

export default async function Auditoria({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirAdmin();
  const sp = await searchParams;
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const db = createSupabaseAdmin();

  const semana = await db.rpc("semana_uy");
  const [items, precision] = await Promise.all([
    db
      .from("auditoria")
      .select("id, beneficio_id, resultado, nota")
      .eq("semana", semana.data as string)
      .order("creado_en"),
    db.rpc("auditoria_precision"),
  ]);
  const fallo = semana.error ?? items.error ?? precision.error;
  const lista = (items.data ?? []) as Item[];

  // Cada ítem necesita su tramo y el texto de su página.
  const tramos = lista.length
    ? await db.from("beneficio").select(COLUMNAS_TRAMO).in("id", lista.map((i) => i.beneficio_id))
    : { data: [], error: null };
  const porId = new Map(((tramos.data ?? []) as unknown as Tramo[]).map((t) => [t.id, t]));
  const paginas = await Promise.all(
    lista.map((i) => {
      const p = paginaDeBeneficio(i.beneficio_id);
      return p
        ? db
            .from("pagina_cruda")
            .select("contenido")
            .eq("fuente_id", p.fuenteId)
            .eq("external_id", p.externalId)
            .maybeSingle<{ contenido: string }>()
        : Promise.resolve({ data: null });
    }),
  );

  const pendientes = lista.filter((i) => !i.resultado).length;
  const prec = (precision.data ?? []) as Precision[];

  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-2xl">Auditoría</h1>
      <p className="text-pizarra mt-1 max-w-prose text-sm">
        Diez beneficios por semana, al azar pero con más peso en lo recién leído,
        los porcentajes altos y las fuentes nuevas. Compará con el texto del
        banco: ¿el beneficio dice lo que dice la página? Un ✗ no edita nada;
        queda anotado y se corrige desde el inspector o el scraper.
      </p>

      {uno(sp.ok) ? (
        <p role="status" className="border-menta-ln bg-menta-s text-menta-ink mt-4 rounded-lg border px-4 py-3 text-sm">
          {uno(sp.ok)}
        </p>
      ) : null}
      {uno(sp.error) || fallo ? (
        <p role="alert" className="border-coral-ln bg-coral-s text-coral-ink mt-4 rounded-lg border px-4 py-3 text-sm">
          {uno(sp.error) ?? `No se pudo leer la base: ${fallo!.message}`}
        </p>
      ) : null}

      <section className="mt-6">
        <h2 className="text-lg">Precisión estimada</h2>
        <p className="text-pizarra text-xs">Sobre lo respondido en los últimos 6 meses. Con pocas respuestas es orientativa.</p>
        {prec.length === 0 ? (
          <p className="text-humo-oscuro mt-2 text-sm">Todavía no hay respuestas.</p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {prec.map((p) => (
              <li
                key={p.fuente_id}
                className={cn(
                  "rounded-xl border px-4 py-3",
                  Number(p.precision_pct) < 90 ? "border-coral-ln bg-coral-s" : "border-linea bg-papel",
                )}
              >
                <span className="font-display block text-xl font-bold">{Number(p.precision_pct)} %</span>
                <span className="text-pizarra text-xs">
                  {NOMBRE_FUENTE.get(p.fuente_id) ?? p.fuente_id} · {numero(Number(p.bien))} de {numero(Number(p.respondidas))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg">
            Esta semana{" "}
            <span className="text-humo-oscuro text-sm font-normal">
              {lista.length === 0 ? "sin muestra" : `${numero(pendientes)} pendientes de ${numero(lista.length)}`}
            </span>
          </h2>
          {lista.length < 10 ? (
            <form action={armarMuestra}>
              <button type="submit" className="bg-tinta text-papel rounded-lg px-3 py-1.5 text-sm font-medium hover:opacity-90">
                {lista.length === 0 ? "Armar la muestra" : "Completar la muestra"}
              </button>
            </form>
          ) : null}
        </div>

        <ol className="mt-4 flex flex-col gap-8">
          {lista.map((item, k) => {
            const t = porId.get(item.beneficio_id);
            const pag = paginaDeBeneficio(item.beneficio_id);
            const contenido = paginas[k]?.data?.contenido ?? "(no se encontró la página)";
            return (
              <li key={item.id} id={item.id} className="scroll-mt-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-base">
                    {k + 1}. {t?.titulo ?? item.beneficio_id}{" "}
                    <span className="text-humo-oscuro text-xs font-normal">
                      {NOMBRE_FUENTE.get(pag?.fuenteId ?? "") ?? pag?.fuenteId}
                    </span>
                  </h3>
                  {item.resultado ? (
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-xs font-semibold",
                        item.resultado === "bien"
                          ? "bg-menta-s text-menta-ink border-menta-ln"
                          : "bg-coral-s text-coral-ink border-coral-ln",
                      )}
                    >
                      {item.resultado === "bien" ? "✓ Bien" : "✗ Mal"}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2">
                  {t ? (
                    <LadoALado
                      contenido={contenido}
                      tramos={[t]}
                      aparte={
                        <form action={responder} className="border-linea bg-papel mt-3 rounded-xl border px-4 py-3">
                          <input type="hidden" name="id" value={item.id} />
                          <label className="text-humo-oscuro text-xs font-medium" htmlFor={`nota-${item.id}`}>
                            Nota (opcional): qué está mal
                          </label>
                          <textarea
                            id={`nota-${item.id}`}
                            name="nota"
                            defaultValue={item.nota ?? ""}
                            rows={2}
                            className="border-linea bg-hueso mt-1 w-full rounded-lg border px-2 py-1 text-sm"
                          />
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button name="resultado" value="bien" className="border-menta-ln bg-menta-s text-menta-ink rounded-lg border px-3 py-1.5 text-sm font-medium">
                              ✓ Está bien
                            </button>
                            <button name="resultado" value="mal" className="border-coral-ln bg-coral-s text-coral-ink rounded-lg border px-3 py-1.5 text-sm font-medium">
                              ✗ Está mal
                            </button>
                            {pag ? (
                              <Link href={urlInspector(pag.fuenteId, pag.externalId)} className="text-cielo-ink ml-auto text-xs hover:underline">
                                Abrir en el inspector (re-normalizar)
                              </Link>
                            ) : null}
                          </div>
                        </form>
                      }
                    />
                  ) : (
                    <p className="text-humo-oscuro text-sm">El beneficio ya no existe.</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
