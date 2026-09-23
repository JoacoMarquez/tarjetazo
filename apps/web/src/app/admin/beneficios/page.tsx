import type { Metadata, Route } from "next";
import Link from "next/link";
import { CATEGORIAS, FUENTES } from "@tarjetazo/core";
import { createSupabaseAdmin, exigirAdmin } from "@/lib/admin";
import {
  ESTADOS,
  POR_PAGINA,
  VIGENCIAS,
  descuentoCorto,
  leerFiltrosRegistro,
  slugBusqueda,
  textoSeguro,
  urlRegistro,
  type FilaRegistro,
} from "@/lib/admin/beneficios";
import { fechaCorta, hoyUy, numero } from "@/lib/admin/formato";
import { paginaDeBeneficio, urlInspector } from "@/lib/admin/paginas";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Beneficios" };

const NOMBRE_FUENTE = new Map(FUENTES.map((f) => [f.id as string, f.nombre]));
const NOMBRE_RUBRO = new Map(CATEGORIAS.map((c) => [c.slug as string, c.label]));

const ETIQUETA_ESTADO = { ok: "Publicados", oculto: "Ocultos a mano", revisar: "A revisar", descartado: "Descartados", todos: "Todos" };
const ETIQUETA_VIGENCIA = {
  todas: "Cualquier vigencia",
  vigentes: "Vigentes hoy",
  vencidos: "Vencidos",
  sin_fin: "Sin fecha de fin",
  sospechosos: "Sospechosos de viejos",
};

/** Días sin cambios en la página a partir de los cuales un beneficio sin fecha de fin es sospechoso. */
const DIAS_AMARILLO = 180;

export default async function Beneficios({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirAdmin();
  const f = leerFiltrosRegistro(await searchParams);
  const hoy = hoyUy();

  // `!inner` para poder filtrar por el rubro del comercio.
  let consulta = createSupabaseAdmin()
    .from("beneficio")
    .select(
      "id, fuente_id, comercio_key, titulo, descuento_raw, tipo, porcentaje, cuotas, vigencia_desde, vigencia_hasta, productos_elegibles, estado_revision, verificado_hasta, url_fuente, updated_at, comercio!inner(nombre, categoria)",
      { count: "exact" },
    );
  if (f.fuente) consulta = consulta.eq("fuente_id", f.fuente);
  if (f.rubro) consulta = consulta.eq("comercio.categoria", f.rubro);
  if (f.estado !== "todos") consulta = consulta.eq("estado_revision", f.estado);
  if (f.vigencia === "vigentes") {
    consulta = consulta
      .or(`vigencia_desde.is.null,vigencia_desde.lte.${hoy}`)
      .or(`vigencia_hasta.is.null,vigencia_hasta.gte.${hoy}`);
  } else if (f.vigencia === "vencidos") {
    consulta = consulta.lt("vigencia_hasta", hoy);
  } else if (f.vigencia === "sin_fin") {
    consulta = consulta.is("vigencia_hasta", null);
  } else if (f.vigencia === "sospechosos") {
    // La lista sale de la misma función que usa Salud de datos (tope 500).
    const { data: sosp } = await createSupabaseAdmin().rpc("salud_frescura", { p_dias: DIAS_AMARILLO, p_limite: 500 });
    const ids = ((sosp ?? []) as { beneficio_id: string }[]).map((x) => x.beneficio_id);
    consulta = consulta.in("id", ids.length ? ids : ["-"]);
  }
  const texto = textoSeguro(f.q);
  if (texto) {
    const slug = slugBusqueda(texto);
    consulta = consulta.or(
      [
        `titulo.ilike.*${texto}*`,
        `descuento_raw.ilike.*${texto}*`,
        slug ? `comercio_key.ilike.*${slug}*` : null,
      ]
        .filter(Boolean)
        .join(","),
    );
  }

  const desde = (f.pagina - 1) * POR_PAGINA;
  const { data, count, error } = await consulta
    .order("comercio_key")
    .order("id")
    .range(desde, desde + POR_PAGINA - 1);

  const filas = (data ?? []) as unknown as FilaRegistro[];

  // Semáforo: hace cuánto no cambia la página de cada beneficio mostrado.
  const paginasMostradas = filas.map((b) => paginaDeBeneficio(b.id)).filter((x) => x !== null);
  const { data: hashes } = paginasMostradas.length
    ? await createSupabaseAdmin()
        .from("pagina_cruda")
        .select("fuente_id, external_id, hash_desde")
        .in("external_id", [...new Set(paginasMostradas.map((p) => p.externalId))])
    : { data: [] };
  const hashDesde = new Map(
    ((hashes ?? []) as { fuente_id: string; external_id: string; hash_desde: string | null }[]).map((h) => [
      `${h.fuente_id}:${h.external_id}`,
      h.hash_desde,
    ]),
  );
  const limiteAmarillo = Date.now() - DIAS_AMARILLO * 86400e3;
  const amarillo = (b: FilaRegistro) => {
    if (b.estado_revision !== "ok" || b.vigencia_hasta || (b.verificado_hasta && b.verificado_hasta >= hoy)) return false;
    const pag = paginaDeBeneficio(b.id);
    const desde = pag ? hashDesde.get(`${pag.fuenteId}:${pag.externalId}`) : null;
    return desde ? Date.parse(desde) < limiteAmarillo : false;
  };
  const total = count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl">Beneficios</h1>
      <p className="text-pizarra mt-1 text-sm">
        Estado actual de cada beneficio, tal como quedó después de la última
        corrida. Solo lectura: lo scrapeado se corrige con reglas, no editando.
      </p>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <Campo etiqueta="Buscar">
          <input
            type="search"
            name="q"
            defaultValue={f.q}
            placeholder="Comercio o descuento"
            className="border-linea bg-papel h-9 w-56 rounded-lg border px-3 text-sm"
          />
        </Campo>
        <Selector etiqueta="Fuente" nombre="fuente" valor={f.fuente ?? ""}>
          <option value="">Todas</option>
          {FUENTES.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nombre}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Rubro" nombre="rubro" valor={f.rubro ?? ""}>
          <option value="">Todos</option>
          {CATEGORIAS.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Estado" nombre="estado" valor={f.estado}>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {ETIQUETA_ESTADO[e]}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Vigencia" nombre="vigencia" valor={f.vigencia}>
          {VIGENCIAS.map((v) => (
            <option key={v} value={v}>
              {ETIQUETA_VIGENCIA[v]}
            </option>
          ))}
        </Selector>
        <button
          type="submit"
          className="bg-tinta text-papel h-9 rounded-lg px-4 text-sm font-medium hover:opacity-90"
        >
          Filtrar
        </button>
        <Link href="/admin/beneficios" className="text-pizarra h-9 text-sm leading-9 hover:underline">
          Limpiar
        </Link>
      </form>

      {error ? (
        <p
          role="alert"
          className="border-coral-ln bg-coral-s text-coral-ink mt-6 rounded-lg border px-4 py-3 text-sm"
        >
          No se pudo leer la base: {error.message}
        </p>
      ) : (
        <>
          <p className="text-humo-oscuro mt-6 text-sm">
            {numero(total)} {total === 1 ? "beneficio" : "beneficios"}
            {total > POR_PAGINA ? ` · página ${f.pagina} de ${paginas}` : ""}
          </p>

          {filas.length === 0 ? (
            <p className="text-pizarra mt-4 text-sm">Nada con esos filtros.</p>
          ) : (
            <div className="border-linea bg-papel mt-3 overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="text-humo-oscuro text-left text-xs">
                    <Th>Comercio</Th>
                    <Th>Fuente</Th>
                    <Th>Descuento</Th>
                    <Th>Tarjetas</Th>
                    <Th>Vigencia</Th>
                    <Th>Estado</Th>
                    <Th>Página</Th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((b) => {
                    const vencido = b.vigencia_hasta !== null && b.vigencia_hasta < hoy;
                    return (
                      <tr key={b.id} className="border-linea border-t align-top">
                        <td className="px-4 py-2">
                          <Link
                            href={`/comercio/${b.comercio_key}` as Route}
                            className="text-cielo-ink font-medium hover:underline"
                          >
                            {b.comercio?.nombre ?? b.comercio_key}
                          </Link>
                          <span className="text-humo-oscuro block text-xs">
                            {NOMBRE_RUBRO.get(b.comercio?.categoria ?? "") ?? b.comercio?.categoria}
                          </span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {NOMBRE_FUENTE.get(b.fuente_id) ?? b.fuente_id}
                        </td>
                        <td className="max-w-[18rem] px-4 py-2">
                          <span className="font-semibold">{descuentoCorto(b)}</span>
                          <span className="text-pizarra block text-xs" title={b.descuento_raw}>
                            {b.titulo}
                          </span>
                        </td>
                        <td className="text-pizarra px-4 py-2 text-xs whitespace-nowrap">
                          {b.productos_elegibles.length === 0
                            ? "Todas"
                            : `${b.productos_elegibles.length} ${b.productos_elegibles.length === 1 ? "tarjeta" : "tarjetas"}`}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-2 text-xs whitespace-nowrap",
                            vencido ? "text-coral-ink font-medium" : "text-pizarra",
                          )}
                        >
                          {b.vigencia_desde || b.vigencia_hasta
                            ? `${b.vigencia_desde ? fechaCorta(b.vigencia_desde) : "…"} – ${
                                b.vigencia_hasta ? fechaCorta(b.vigencia_hasta) : "…"
                              }`
                            : "Sin fechas"}
                        </td>
                        <td className="px-4 py-2">
                          <Estado estado={b.estado_revision} />
                          {amarillo(b) ? (
                            <span
                              title={`Sin fecha de fin y la página no cambia hace más de ${DIAS_AMARILLO} días`}
                              className="bg-sol-s text-sol-ink border-sol-ln mt-1 block w-fit rounded-full border px-2 py-0.5 text-xs font-semibold"
                            >
                              ¿Vigente?
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2 text-xs whitespace-nowrap">
                          {(() => {
                            const pag = paginaDeBeneficio(b.id);
                            return pag ? (
                              <Link
                                href={urlInspector(pag.fuenteId, pag.externalId)}
                                className="text-cielo-ink mr-3 hover:underline"
                              >
                                Inspector
                              </Link>
                            ) : null;
                          })()}
                          <a
                            href={b.url_fuente}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-cielo-ink hover:underline"
                          >
                            {NOMBRE_FUENTE.get(b.fuente_id) ?? "Fuente"} ↗
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {paginas > 1 ? (
            <nav aria-label="Páginas" className="mt-4 flex items-center justify-between text-sm">
              {f.pagina > 1 ? (
                <Link href={urlRegistro(f, { pagina: f.pagina - 1 }) as Route} className="text-cielo-ink hover:underline">
                  ← Anterior
                </Link>
              ) : (
                <span />
              )}
              {f.pagina < paginas ? (
                <Link href={urlRegistro(f, { pagina: f.pagina + 1 }) as Route} className="text-cielo-ink hover:underline">
                  Siguiente →
                </Link>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-humo-oscuro text-xs font-medium">{etiqueta}</span>
      {children}
    </label>
  );
}

function Selector({
  etiqueta,
  nombre,
  valor,
  children,
}: {
  etiqueta: string;
  nombre: string;
  valor: string;
  children: React.ReactNode;
}) {
  return (
    <Campo etiqueta={etiqueta}>
      <select
        name={nombre}
        defaultValue={valor}
        className="border-linea bg-papel h-9 rounded-lg border px-2 text-sm"
      >
        {children}
      </select>
    </Campo>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="px-4 py-2 font-medium whitespace-nowrap">
      {children}
    </th>
  );
}

const CLASE_ESTADO = {
  ok: "bg-menta-s text-menta-ink border-menta-ln",
  oculto: "bg-papel-1 text-pizarra border-linea",
  revisar: "bg-sol-s text-sol-ink border-sol-ln",
  descartado: "bg-papel-1 text-humo-oscuro border-linea",
};
const TEXTO_ESTADO = { ok: "Publicado", oculto: "Oculto", revisar: "A revisar", descartado: "Descartado" };

function Estado({ estado }: { estado: FilaRegistro["estado_revision"] }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        CLASE_ESTADO[estado],
      )}
    >
      {TEXTO_ESTADO[estado]}
    </span>
  );
}
