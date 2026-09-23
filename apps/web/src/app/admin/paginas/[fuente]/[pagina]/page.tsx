import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FUENTES } from "@tarjetazo/core";
import { LadoALado, ListaTramos } from "@/components/admin/lado-a-lado";
import { createSupabaseAdmin, exigirAdmin } from "@/lib/admin";
import { fechaHora } from "@/lib/admin/formato";
import {
  COLUMNAS_TRAMO,
  FUENTES_DETERMINISTAS,
  ordenarTramos,
  patronBeneficiosDe,
  type Tramo,
} from "@/lib/admin/paginas";
import { COLUMNAS_REVISION, problemasDe, type Revision } from "@/lib/admin/revision";
import { marcarNoBeneficio, reNormalizar } from "./actions";

export const metadata: Metadata = { title: "Inspector de página" };

const NOMBRE_FUENTE = new Map(FUENTES.map((f) => [f.id as string, f.nombre]));

type Pagina = {
  fuente_id: string;
  external_id: string;
  url_fuente: string;
  contenido: string;
  hash: string;
  fetched_at: string;
  normalizada_en: string | null;
  resultado: "beneficios" | "no_es_beneficio" | "sin_tramos" | null;
};

const MOTIVO = {
  beneficios: "Dejó beneficios",
  no_es_beneficio: "No es un beneficio",
  sin_tramos: "Sin tramos",
};

export default async function Inspector({
  params,
  searchParams,
}: {
  params: Promise<{ fuente: string; pagina: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirAdmin();
  const { fuente, pagina } = await params;
  const fuenteId = decodeURIComponent(fuente);
  const externalId = decodeURIComponent(pagina);
  const sp = await searchParams;
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const db = createSupabaseAdmin();

  const [p, tramos, cola] = await Promise.all([
    db
      .from("pagina_cruda")
      .select("fuente_id, external_id, url_fuente, contenido, hash, fetched_at, normalizada_en, resultado")
      .eq("fuente_id", fuenteId)
      .eq("external_id", externalId)
      .maybeSingle<Pagina>(),
    db
      .from("beneficio")
      .select(COLUMNAS_TRAMO)
      .eq("fuente_id", fuenteId)
      .like("id", patronBeneficiosDe(fuenteId, externalId)),
    db
      .from("beneficio_revision")
      .select(COLUMNAS_REVISION)
      .eq("fuente_id", fuenteId)
      .eq("external_id", externalId)
      .eq("resuelto", false),
  ]);
  const fallo = p.error ?? tramos.error ?? cola.error;
  if (fallo) throw new Error(`leyendo la página: ${fallo.message}`);
  if (!p.data) notFound();

  const pag = p.data;
  const lista = ordenarTramos((tramos.data ?? []) as unknown as Tramo[]);
  const publicados = lista.filter((t) => t.estado_revision !== "descartado");
  const descartados = lista.filter((t) => t.estado_revision === "descartado");
  const pendientes = (cola.data ?? []) as Revision[];
  const marcada = pag.hash === "" || pag.normalizada_en === null;
  const nombreFuente = NOMBRE_FUENTE.get(pag.fuente_id) ?? pag.fuente_id;
  const ok = uno(sp.ok);
  const error = uno(sp.error);

  const datos: [string, React.ReactNode][] = [
    ["Fuente", nombreFuente],
    ["Bajada", fechaHora(pag.fetched_at)],
    ["Normalizada", pag.normalizada_en ? fechaHora(pag.normalizada_en) : "—"],
    ["Resultado", pag.resultado ? MOTIVO[pag.resultado] : "Sin clasificar"],
    ["Hash", pag.hash ? <code className="text-xs">{pag.hash.slice(0, 12)}…</code> : "vacío"],
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/admin/beneficios" className="text-pizarra text-sm hover:underline">
        ← Beneficios
      </Link>
      <h1 className="mt-2 text-2xl break-all">{pag.external_id}</h1>
      <a
        href={pag.url_fuente}
        target="_blank"
        rel="noreferrer noopener"
        className="text-cielo-ink text-sm break-all hover:underline"
      >
        {pag.url_fuente} ↗
      </a>

      {ok ? (
        <p role="status" className="border-menta-ln bg-menta-s text-menta-ink mt-4 rounded-lg border px-4 py-3 text-sm">
          {ok}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="border-coral-ln bg-coral-s text-coral-ink mt-4 rounded-lg border px-4 py-3 text-sm">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {datos.map(([k, v]) => (
            <div key={k}>
              <dt className="text-humo-oscuro text-xs">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap items-start gap-4">
        {publicados.length === 0 && pag.resultado !== "no_es_beneficio" ? (
          <form action={marcarNoBeneficio} className="max-w-xs">
            <input type="hidden" name="fuente_id" value={pag.fuente_id} />
            <input type="hidden" name="external_id" value={pag.external_id} />
            <button
              type="submit"
              className="border-linea text-pizarra hover:bg-papel-1 rounded-lg border px-3 py-1.5 text-sm font-medium"
            >
              No es un beneficio
            </button>
            <p className="text-humo-oscuro mt-1 text-xs">
              La saca de «Páginas sin beneficios» hasta que el banco la cambie.
            </p>
          </form>
        ) : null}
        {marcada ? (
          <p className="border-sol-ln bg-sol-s text-sol-ink max-w-sm rounded-lg border px-3 py-2 text-xs">
            Marcada para re-normalizar: la próxima corrida de {nombreFuente} la
            procesa aunque el banco no la haya cambiado.
          </p>
        ) : (
          <form action={reNormalizar} className="max-w-sm">
            <input type="hidden" name="fuente_id" value={pag.fuente_id} />
            <input type="hidden" name="external_id" value={pag.external_id} />
            <button
              type="submit"
              className="border-linea text-pizarra hover:bg-papel-1 rounded-lg border px-3 py-1.5 text-sm font-medium"
            >
              Re-normalizar
            </button>
            <p className="text-humo-oscuro mt-1 text-xs">
              {FUENTES_DETERMINISTAS.has(pag.fuente_id)
                ? "Esta fuente se procesa sin modelo: no tiene costo."
                : "Cuesta una llamada al modelo (≈ USD 0,01) en la próxima corrida."}
            </p>
          </form>
        )}
        </div>
      </div>

      <div className="mt-6">
        <LadoALado
          contenido={pag.contenido}
          tramos={publicados}
          aparte={
            <>
              {pendientes.length > 0 ? (
                <section className="mt-4">
                  <h3 className="text-sm font-semibold">En la cola de revisión</h3>
                  <ul className="mt-1 flex flex-col gap-1 text-sm">
                    {pendientes.flatMap((r) =>
                      problemasDe(r).map((x) => (
                        <li key={`${r.id}:${x}`} className="border-sol-ln bg-sol-s text-sol-ink rounded-lg border px-3 py-1.5">
                          {x}
                        </li>
                      )),
                    )}
                  </ul>
                  <Link href="/admin/revision" className="text-cielo-ink mt-1 inline-block text-xs hover:underline">
                    Ir a la cola →
                  </Link>
                </section>
              ) : null}
              {descartados.length > 0 ? (
                <details className="mt-4">
                  <summary className="text-cielo-ink cursor-pointer text-sm select-none">
                    {descartados.length} {descartados.length === 1 ? "tramo descartado" : "tramos descartados"} (versiones anteriores de la página)
                  </summary>
                  <div className="mt-2">
                    <ListaTramos tramos={descartados} />
                  </div>
                </details>
              ) : null}
            </>
          }
        />
      </div>
    </div>
  );
}
