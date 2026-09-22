import type { Metadata } from "next";
import { FUENTES, PRODUCTOS } from "@tarjetazo/core";
import { createSupabaseAdmin, exigirAdmin } from "@/lib/admin";
import { numero } from "@/lib/admin/formato";
import { pieDeTarjeta } from "@/lib/marca";
import {
  COLUMNAS_REVISION,
  agrupar,
  armarCubiertos,
  type Grupo,
  type Revision,
} from "@/lib/admin/revision";
import { asignarTarjeta, descartar, ignorarSiempre } from "./actions";

export const metadata: Metadata = { title: "Cola de revisión" };

const NOMBRE_FUENTE = new Map(FUENTES.map((f) => [f.id as string, f.nombre]));
/** Links de ejemplo que se muestran por grupo. */
const URLS_VISIBLES = 5;

export default async function ColaDeRevision({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirAdmin();
  const params = await searchParams;
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const db = createSupabaseAdmin();

  const [cola, alias, ignorar] = await Promise.all([
    db
      .from("beneficio_revision")
      .select(COLUMNAS_REVISION)
      .eq("resuelto", false)
      .order("created_at", { ascending: false })
      .limit(5000),
    db.from("producto_alias").select("fuente_id, texto"),
    db.from("regla_ignorar").select("fuente_id, texto"),
  ]);

  const fallo = cola.error ?? alias.error ?? ignorar.error;
  if (fallo) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl">Cola de revisión</h1>
        <p
          role="alert"
          className="border-coral-ln bg-coral-s text-coral-ink mt-6 rounded-lg border px-4 py-3 text-sm"
        >
          No se pudo leer la cola: {fallo.message}. Si falta una tabla o la
          columna <code>descartados</code>, hay que aplicar la migración (
          <code>supabase db push</code>).
        </p>
      </div>
    );
  }

  const filas = (cola.data ?? []) as Revision[];
  const grupos = agrupar(
    filas,
    armarCubiertos([...(alias.data ?? []), ...(ignorar.data ?? [])]),
  );
  const tarjetas = grupos.filter((g) => !g.esTramo);
  const tramos = grupos.filter((g) => g.esTramo);
  const ok = uno(params.ok);
  const error = uno(params.error);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl">Cola de revisión</h1>
      <p className="text-pizarra mt-1 max-w-prose text-sm">
        {numero(filas.length)} entradas con algo sin resolver, agrupadas por
        problema. Los beneficios de estas páginas{" "}
        <strong>ya están publicados</strong>, pero sin las tarjetas que no se
        pudieron mapear.
      </p>

      {ok ? (
        <p
          role="status"
          className="border-menta-ln bg-menta-s text-menta-ink mt-4 rounded-lg border px-4 py-3 text-sm"
        >
          {ok}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="border-coral-ln bg-coral-s text-coral-ink mt-4 rounded-lg border px-4 py-3 text-sm"
        >
          {error}
        </p>
      ) : null}

      <section className="mt-8">
        <h2 className="text-lg">
          Tarjetas que no se reconocen{" "}
          <span className="text-humo-oscuro text-sm font-normal">
            {numero(tarjetas.length)}
          </span>
        </h2>
        {tarjetas.length === 0 ? (
          <p className="text-humo-oscuro mt-2 text-sm">Nada pendiente.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {tarjetas.map((g) => (
              <GrupoTarjeta key={`${g.fuenteId}:${g.clave}`} g={g} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg">
          Tramos que no validaron{" "}
          <span className="text-humo-oscuro text-sm font-normal">
            {numero(tramos.length)}
          </span>
        </h2>
        <p className="text-pizarra mt-1 max-w-prose text-sm">
          El normalizador devolvió un dato imposible y ese tramo no se publicó.
          No se arreglan con una regla: si se repite es un bug del scraper; si
          es un caso suelto, descartalo.
        </p>
        {tramos.length === 0 ? (
          <p className="text-humo-oscuro mt-2 text-sm">Nada pendiente.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {tramos.map((g) => (
              <li
                key={`${g.fuenteId}:${g.clave}`}
                className="border-linea bg-papel rounded-xl border px-4 py-3"
              >
                <Cabecera g={g} />
                <Paginas g={g} />
                <form action={descartar} className="mt-3">
                  <Ocultos g={g} />
                  <Boton>Descartar</Boton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function GrupoTarjeta({ g }: { g: Grupo }) {
  const productos = PRODUCTOS.filter((p) => p.fuente_id === g.fuenteId);
  return (
    <li className="border-linea bg-papel rounded-xl border px-4 py-3">
      <Cabecera g={g} />
      <Paginas g={g} />

      <details className="mt-3">
        <summary className="text-cielo-ink cursor-pointer text-sm font-medium select-none">
          Asignar tarjeta
        </summary>
        <form action={asignarTarjeta} className="mt-3">
          <Ocultos g={g} />
          {productos.length === 0 ? (
            <p className="text-humo-oscuro text-sm">
              Esta fuente no tiene tarjetas en el catálogo.
            </p>
          ) : (
            <>
              <fieldset>
                <legend className="text-pizarra text-xs">
                  «{g.etiqueta}» es… (puede ser más de una)
                </legend>
                <div className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                  {productos.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="producto_ids"
                        value={p.id}
                        className="size-4"
                      />
                      {p.nombre}
                      <span className="text-humo-oscuro text-xs">{pieDeTarjeta(p)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <p className="text-humo-oscuro mt-3 text-xs">
                Guarda la regla y marca {numero(g.paginas.length)}{" "}
                {g.paginas.length === 1 ? "página" : "páginas"} para re-normalizar
                en la próxima corrida (una llamada al modelo por página).
              </p>
              <div className="mt-2">
                <Boton primario>Guardar alias</Boton>
              </div>
            </>
          )}
        </form>
      </details>

      <div className="mt-3 flex flex-wrap gap-2">
        <form action={ignorarSiempre}>
          <Ocultos g={g} />
          <Boton title="No es una tarjeta: que este nombre no vuelva a la cola">
            Ignorar siempre
          </Boton>
        </form>
        <form action={descartar}>
          <Ocultos g={g} />
          <Boton title="Sacarlo de la cola solo esta vez, sin crear una regla">
            Descartar
          </Boton>
        </form>
      </div>
    </li>
  );
}

function Cabecera({ g }: { g: Grupo }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <p className="min-w-0 text-sm font-semibold break-words">{g.etiqueta}</p>
      <p className="text-humo-oscuro text-xs whitespace-nowrap">
        {NOMBRE_FUENTE.get(g.fuenteId) ?? g.fuenteId} · {numero(g.paginas.length)}{" "}
        {g.paginas.length === 1 ? "página" : "páginas"}
      </p>
    </div>
  );
}

/** Hasta que exista el inspector (F2), el link va a la página de la fuente. */
function Paginas({ g }: { g: Grupo }) {
  if (g.urls.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-col gap-0.5 text-xs">
      {g.urls.slice(0, URLS_VISIBLES).map((u) => (
        <li key={u}>
          <a
            href={u}
            target="_blank"
            rel="noreferrer noopener"
            className="text-cielo-ink break-all hover:underline"
          >
            {u} ↗
          </a>
        </li>
      ))}
      {g.urls.length > URLS_VISIBLES ? (
        <li className="text-humo-oscuro">
          y {numero(g.urls.length - URLS_VISIBLES)} más
        </li>
      ) : null}
    </ul>
  );
}

function Ocultos({ g }: { g: Grupo }) {
  return (
    <>
      <input type="hidden" name="fuente_id" value={g.fuenteId} />
      <input type="hidden" name="texto" value={g.clave} />
      <input type="hidden" name="clave" value={g.clave} />
      <input type="hidden" name="es_tramo" value={g.esTramo ? "1" : "0"} />
    </>
  );
}

function Boton({
  children,
  primario,
  title,
}: {
  children: React.ReactNode;
  primario?: boolean;
  title?: string;
}) {
  return (
    <button
      type="submit"
      title={title}
      className={
        primario
          ? "bg-tinta text-papel rounded-lg px-3 py-1.5 text-sm font-medium hover:opacity-90"
          : "border-linea text-pizarra hover:bg-papel-1 rounded-lg border px-3 py-1.5 text-sm font-medium"
      }
    >
      {children}
    </button>
  );
}
