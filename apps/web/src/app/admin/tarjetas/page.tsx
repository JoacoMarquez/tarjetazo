import type { Metadata } from "next";
import Link from "next/link";
import { FAMILIAS, FAMILIA_POR_ID, FUENTES } from "@tarjetazo/core";
import { BotonEnviar } from "@/components/admin/boton-enviar";
import { Foto, Ids, SugerenciasFicha } from "@/components/admin/sugerencias-ficha";
import { createSupabaseAdmin, exigirAdmin } from "@/lib/admin";
import {
  COLUMNAS_FICHA,
  COLUMNAS_SUGERENCIA,
  completitud,
  lineaProducto,
  urlImagen,
  type Alta,
  type Ficha,
  type Sugerencia,
} from "@/lib/fichas";
import { fechaHora, numero } from "@/lib/admin/formato";
import { aceptarSugerencias, ignorarSugerencias, marcarAltaAgregada } from "./actions";

export const metadata: Metadata = { title: "Tarjetas" };

const NOMBRE_FUENTE = new Map(FUENTES.map((f) => [f.id as string, f.nombre]));
/** "Revisar ahora": sin token de GitHub en Vercel, es un link a Actions (grill de F4). */
const ACTIONS_CATALOGO = "https://github.com/JoacoMarquez/tarjetazo/actions/workflows/catalogo.yml";
const VOLVER = "/admin/tarjetas";

type Revision = {
  empezo_en: string;
  termino_en: string | null;
  paginas: number;
  tarjetas: number;
  sugerencias: number;
  error: string | null;
};

export default async function Tarjetas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirAdmin();
  const params = await searchParams;
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const db = createSupabaseAdmin();

  const [sugs, fichas, revision] = await Promise.all([
    db
      .from("producto_ficha_sugerencia")
      .select(COLUMNAS_SUGERENCIA)
      .eq("estado", "pendiente")
      .order("creada_en")
      .limit(2000),
    db.from("producto_ficha").select(COLUMNAS_FICHA),
    db
      .from("catalogo_revision")
      .select("empezo_en, termino_en, paginas, tarjetas, sugerencias, error")
      .order("empezo_en", { ascending: false })
      .limit(1)
      .maybeSingle<Revision>(),
  ]);

  const fallo = sugs.error ?? fichas.error ?? revision.error;
  if (fallo) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl">Tarjetas</h1>
        <p
          role="alert"
          className="border-coral-ln bg-coral-s text-coral-ink mt-6 rounded-lg border px-4 py-3 text-sm"
        >
          No se pudo leer la base: {fallo.message}
        </p>
      </div>
    );
  }

  const pendientes = (sugs.data ?? []) as Sugerencia[];
  const campos = pendientes.filter((s) => s.tipo === "campo" && s.familia_id);
  const altas = pendientes.filter((s) => s.tipo === "alta");
  const fichaDe = new Map(((fichas.data ?? []) as Ficha[]).map((f) => [f.familia_id, f]));

  // En el orden del catálogo; las de familias que ya no están, al final.
  const orden = new Map(FAMILIAS.map((f, i) => [f.id, i]));
  const porFamilia = new Map<string, Sugerencia[]>();
  for (const s of campos) porFamilia.set(s.familia_id!, [...(porFamilia.get(s.familia_id!) ?? []), s]);
  const grupos = [...porFamilia.entries()].sort(
    ([a], [b]) => (orden.get(a) ?? 1e6) - (orden.get(b) ?? 1e6),
  );

  const ok = uno(params.ok);
  const error = uno(params.error);
  const rev = revision.data;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl">Tarjetas</h1>
      <p className="text-pizarra mt-1 max-w-prose text-sm">
        Fichas de cada tarjeta (costo, requisitos, seguros, foto). El scraper de
        catálogo solo <strong>sugiere</strong>: nada llega a la ficha hasta que
        se acepta acá.
      </p>

      <div className="border-linea bg-papel mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm">
        <p className="text-pizarra">
          {rev ? (
            <>
              Última revisión del catálogo:{" "}
              <span className="text-tinta font-medium">{fechaHora(rev.empezo_en)}</span>
              {" · "}
              {numero(rev.paginas)} páginas, {numero(rev.tarjetas)} tarjetas,{" "}
              {numero(rev.sugerencias)} sugerencias nuevas
              {rev.error ? (
                <span className="text-coral-ink"> · falló: {rev.error}</span>
              ) : !rev.termino_en ? (
                " · sin terminar"
              ) : null}
            </>
          ) : (
            "El catálogo todavía no se revisó nunca."
          )}
          <span className="text-humo-oscuro"> Corre solo los lunes.</span>
        </p>
        <a
          href={ACTIONS_CATALOGO}
          target="_blank"
          rel="noreferrer noopener"
          className="border-linea text-pizarra hover:bg-papel-1 rounded-lg border px-3 py-1.5 text-sm font-medium"
        >
          Revisar ahora ↗
        </a>
      </div>

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

      <section className="mt-8" aria-labelledby="sugerencias">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="sugerencias" className="text-lg">
            Sugerencias{" "}
            <span className="text-humo-oscuro text-sm font-normal">{numero(campos.length)}</span>
          </h2>
          {grupos.length > 1 ? (
            <form action={aceptarSugerencias}>
              <Ids ids={campos.map((s) => s.id)} volverA={VOLVER} />
              <BotonEnviar primario title="Carga inicial: acepta todo lo que el banco publica. Las fotos se bajan a Storage.">
                Aceptar todas ({numero(campos.length)})
              </BotonEnviar>
            </form>
          ) : null}
        </div>
        {grupos.length === 0 ? (
          <p className="text-humo-oscuro mt-2 text-sm">Nada pendiente.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            {grupos.map(([familiaId, suyas]) => (
              <SugerenciasFicha
                key={familiaId}
                familiaId={familiaId}
                nombre={FAMILIA_POR_ID[familiaId]?.nombre ?? familiaId}
                fuente={NOMBRE_FUENTE.get(suyas[0]!.fuente_id) ?? suyas[0]!.fuente_id}
                sugerencias={suyas}
                ficha={fichaDe.get(familiaId) ?? null}
                volverA={VOLVER}
                conLinkAFicha={Boolean(FAMILIA_POR_ID[familiaId])}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10" aria-labelledby="altas">
        <h2 id="altas" className="text-lg">
          Tarjetas nuevas{" "}
          <span className="text-humo-oscuro text-sm font-normal">{numero(altas.length)}</span>
        </h2>
        <p className="text-pizarra mt-1 max-w-prose text-sm">
          El banco publica una tarjeta que no está en el catálogo. El catálogo
          vive en código: pegá la línea en <code>PRODUCTOS</code>{" "}
          (<code>packages/core/src/fuentes.ts</code>), revisá id, red y nivel, y
          mandá un PR. Después marcala como agregada.
        </p>
        {altas.length === 0 ? (
          <p className="text-humo-oscuro mt-2 text-sm">Nada pendiente.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {altas.map((s) => {
              const a = (s.valor ?? {}) as Alta;
              const fuente = NOMBRE_FUENTE.get(s.fuente_id) ?? s.fuente_id;
              return (
                <li key={s.id} className="border-linea bg-papel rounded-xl border px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{s.nombre_visto}</p>
                      <p className="text-humo-oscuro text-xs">
                        {fuente} · {[a.instrumento, a.red, a.tier].filter(Boolean).join(" · ")} ·{" "}
                        <a href={s.url} target="_blank" rel="noreferrer noopener" className="text-cielo-ink hover:underline">
                          página del banco ↗
                        </a>
                      </p>
                    </div>
                    {a.imagen ? <Foto src={a.imagen} alt={`Foto de ${s.nombre_visto}`} /> : null}
                  </div>
                  <pre className="bg-papel-1 text-pizarra mt-3 overflow-x-auto rounded-lg px-3 py-2 text-xs select-all">
                    {lineaProducto(s.fuente_id, fuente, a, s.url)}
                  </pre>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={marcarAltaAgregada}>
                      <Ids ids={[s.id]} volverA={VOLVER} />
                      <BotonEnviar primario>Ya la agregué</BotonEnviar>
                    </form>
                    <form action={ignorarSugerencias}>
                      <Ids ids={[s.id]} volverA={VOLVER} />
                      <BotonEnviar title="No es una tarjeta para personas, o no interesa">Ignorar</BotonEnviar>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-10" aria-labelledby="fichas">
        <h2 id="fichas" className="text-lg">Fichas</h2>
        <p className="text-pizarra mt-1 max-w-prose text-sm">
          Una por tarjeta (un pack es una sola). Lo que el banco no publica se
          completa a mano; OCA, Itaú, Scotiabank y Prex no tienen scraper de
          catálogo y se cargan enteras así.
        </p>
        <div className="mt-3 flex flex-col gap-6">
          {FUENTES.map((f) => {
            const suyas = FAMILIAS.filter((x) => x.fuente_id === f.id);
            if (suyas.length === 0) return null;
            const completas = suyas.filter((x) => {
              const c = completitud(fichaDe.get(x.id));
              return c.llenos === c.total;
            }).length;
            return (
              <div key={f.id} className="border-linea bg-papel overflow-hidden rounded-xl border">
                <header className="border-linea flex items-baseline justify-between gap-3 border-b px-4 py-3">
                  <h3 className="text-base">{f.nombre}</h3>
                  <p className="text-humo-oscuro text-xs">
                    {completas} de {suyas.length} completas
                  </p>
                </header>
                <ul>
                  {suyas.map((x) => {
                    const ficha = fichaDe.get(x.id);
                    const c = completitud(ficha);
                    const pend = porFamilia.get(x.id)?.length ?? 0;
                    const foto = urlImagen(ficha?.imagen_frente);
                    return (
                      <li key={x.id} className="border-linea border-t first:border-t-0">
                        <Link
                          href={`/admin/tarjetas/${x.id}`}
                          className="hover:bg-papel-1 flex items-center gap-3 px-4 py-2"
                        >
                          <span className="bg-papel-2 grid h-9 w-14 shrink-0 place-items-center overflow-hidden rounded-md">
                            {foto ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={foto} alt="" className="size-full object-cover" loading="lazy" />
                            ) : null}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{x.nombre}</span>
                          {pend > 0 ? (
                            <span className="bg-sol-s text-sol-ink rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap">
                              {pend} {pend === 1 ? "sugerencia" : "sugerencias"}
                            </span>
                          ) : null}
                          <Completitud llenos={c.llenos} total={c.total} />
                          <span className="text-humo-oscuro hidden w-28 text-right text-xs sm:block">
                            {ficha ? fechaHora(ficha.actualizado_en) : "sin ficha"}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Completitud({ llenos, total }: { llenos: number; total: number }) {
  const pct = Math.round((100 * llenos) / total);
  return (
    <span className="flex w-24 shrink-0 items-center gap-2" title={`${llenos} de ${total} datos`}>
      <span className="bg-papel-2 h-1.5 flex-1 overflow-hidden rounded-full">
        <span
          className={llenos === total ? "bg-menta block h-full" : "bg-cielo block h-full"}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="text-pizarra w-9 text-right text-xs tabular-nums">
        {llenos}/{total}
      </span>
    </span>
  );
}
