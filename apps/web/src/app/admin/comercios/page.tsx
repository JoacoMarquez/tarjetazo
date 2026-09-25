import type { Metadata, Route } from "next";
import Link from "next/link";
import { CATEGORIAS, FUENTES } from "@tarjetazo/core";
import { createSupabaseAdmin, exigirAdmin } from "@/lib/admin";
import { FILTROS, filtrar, type FilaComercio, type Filtro } from "@/lib/admin/comercios";
import { fechaHora, numero } from "@/lib/admin/formato";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Comercios" };

const NOMBRE_FUENTE = new Map(FUENTES.map((f) => [f.id as string, f.nombre]));
const NOMBRE_RUBRO = new Map(CATEGORIAS.map((c) => [c.slug as string, c.label]));
const ACTIONS_UBICACIONES = "https://github.com/JoacoMarquez/tarjetazo/actions/workflows/ubicaciones.yml";
const POR_PAGINA = 100;

export default async function Comercios({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirAdmin();
  const sp = await searchParams;
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const filtro = (FILTROS.some((f) => f.id === uno(sp.filtro)) ? uno(sp.filtro) : "sin-ubicacion") as Filtro;
  const fuente = uno(sp.fuente);
  const rubro = uno(sp.rubro);
  const q = uno(sp.q);
  const pagina = Math.max(0, Number(uno(sp.p)) || 0);

  const { data, error } = await createSupabaseAdmin().rpc("admin_comercios");
  if (error) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl">Comercios</h1>
        <p role="alert" className="border-coral-ln bg-coral-s text-coral-ink mt-6 rounded-lg border px-4 py-3 text-sm">
          No se pudo leer la base: {error.message}. Si falta `admin_comercios`, hay que aplicar la migración.
        </p>
      </div>
    );
  }

  const todas = (data ?? []) as FilaComercio[];
  const filas = filtrar(todas, { filtro, fuente, rubro, q });
  const visibles = filas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);
  const sinPin = todas.filter((f) => f.con_pin === 0).length;
  const conSugerencias = todas.filter((f) => f.sugerencias > 0).length;
  const sugerenciasTotal = todas.reduce((a, f) => a + f.sugerencias, 0);

  const url = (cambios: Record<string, string>) => {
    const p = new URLSearchParams();
    const actual = { filtro, fuente, rubro, q, ...cambios };
    for (const [k, v] of Object.entries(actual)) if (v) p.set(k, v);
    return `/admin/comercios?${p}` as Route;
  };

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl">Comercios</h1>
      <p className="text-pizarra mt-1 max-w-prose text-sm">
        Qué tiene cada comercio: beneficios vigentes, sucursales y si aparece en
        el mapa. Lo que viene del scraper no se edita; acá se agregan sucursales
        (a mano o aceptando una sugerencia de OpenStreetMap) y se fusionan duplicados.
      </p>

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dato titulo="Con beneficios vigentes" valor={numero(todas.length)} />
        <Dato titulo="Sin ubicación" valor={numero(sinPin)} detalle={`${Math.round((100 * sinPin) / Math.max(1, todas.length))} % no aparece en el mapa`} alerta={sinPin > 0} />
        <Dato titulo="Con sugerencias" valor={numero(conSugerencias)} detalle={`${numero(sugerenciasTotal)} ubicaciones para revisar`} />
        <div className="border-linea bg-papel flex flex-col justify-between rounded-xl border px-4 py-3">
          <dt className="text-humo-oscuro text-xs font-medium">Buscar en OpenStreetMap</dt>
          <dd className="mt-1 text-sm">
            <a href={ACTIONS_UBICACIONES} target="_blank" rel="noreferrer noopener" className="text-cielo-ink hover:underline">
              Correr ahora ↗
            </a>
            <span className="text-humo-oscuro block text-xs">Corre solo los martes.</span>
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {FILTROS.map((f) => (
          <Link
            key={f.id}
            href={url({ filtro: f.id, p: "" })}
            aria-current={f.id === filtro ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              f.id === filtro ? "border-cielo-ln bg-cielo-s text-cielo-ink" : "border-linea text-pizarra hover:bg-papel-1",
            )}
          >
            {f.etiqueta}
          </Link>
        ))}
        <form action="/admin/comercios" className="ml-auto flex flex-wrap gap-2">
          <input type="hidden" name="filtro" value={filtro} />
          <select name="fuente" defaultValue={fuente} className="border-linea bg-papel h-8 rounded-lg border px-2 text-sm">
            <option value="">Todos los bancos</option>
            {FUENTES.map((f) => (
              <option key={f.id} value={f.id}>{f.nombre}</option>
            ))}
          </select>
          <select name="rubro" defaultValue={rubro} className="border-linea bg-papel h-8 rounded-lg border px-2 text-sm">
            <option value="">Todos los rubros</option>
            {CATEGORIAS.map((c) => (
              <option key={c.slug} value={c.slug}>{c.label}</option>
            ))}
          </select>
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar comercio"
            className="border-linea bg-papel h-8 w-44 rounded-lg border px-2 text-sm"
          />
          <button type="submit" className="border-linea text-pizarra hover:bg-papel-1 h-8 rounded-lg border px-3 text-sm font-medium">
            Filtrar
          </button>
        </form>
      </div>

      <p className="text-humo-oscuro mt-3 text-xs">
        {numero(filas.length)} {filas.length === 1 ? "comercio" : "comercios"}, ordenados por beneficios vigentes.
      </p>

      <div className="border-linea bg-papel mt-2 overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="text-humo-oscuro text-left text-xs">
              <th scope="col" className="px-4 py-2 font-medium">Comercio</th>
              <th scope="col" className="px-4 py-2 font-medium">Rubro</th>
              <th scope="col" className="px-4 py-2 font-medium">Bancos</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Beneficios</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">En el mapa</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Sugerencias</th>
              <th scope="col" className="px-4 py-2 font-medium">Buscado en OSM</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((f) => (
              <tr key={f.key} className="border-linea border-t">
                <td className="px-4 py-2">
                  <Link href={`/admin/comercios/${encodeURIComponent(f.key)}` as Route} className="text-cielo-ink font-medium hover:underline">
                    {f.nombre}
                  </Link>
                </td>
                <td className="text-pizarra px-4 py-2">{NOMBRE_RUBRO.get(f.categoria) ?? f.categoria}</td>
                <td className="text-pizarra px-4 py-2 text-xs">{f.fuentes.map((x) => NOMBRE_FUENTE.get(x) ?? x).join(", ")}</td>
                <td className="px-4 py-2 text-right tabular-nums">{numero(f.beneficios)}</td>
                <td className={cn("px-4 py-2 text-right tabular-nums", f.con_pin === 0 && "text-coral-ink")}>
                  {f.con_pin === 0 ? "no" : `${numero(f.con_pin)} ${f.con_pin === 1 ? "local" : "locales"}`}
                </td>
                <td className="px-4 py-2 text-right">
                  {f.sugerencias > 0 ? (
                    <span className="bg-sol-s text-sol-ink rounded-full px-2 py-0.5 text-xs font-medium">{f.sugerencias}</span>
                  ) : (
                    <span className="text-humo">—</span>
                  )}
                </td>
                <td className="text-humo-oscuro px-4 py-2 text-xs whitespace-nowrap">
                  {f.buscado_en ? fechaHora(f.buscado_en) : "nunca"}
                </td>
              </tr>
            ))}
            {visibles.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-humo-oscuro px-4 py-6 text-center text-sm">Nada con estos filtros.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {filas.length > POR_PAGINA ? (
        <nav aria-label="Páginas" className="mt-4 flex items-center justify-between text-sm">
          {pagina > 0 ? (
            <Link href={url({ p: String(pagina - 1) })} className="text-cielo-ink hover:underline">← Anteriores</Link>
          ) : <span />}
          <span className="text-humo-oscuro text-xs">
            {pagina * POR_PAGINA + 1}–{Math.min(filas.length, (pagina + 1) * POR_PAGINA)} de {numero(filas.length)}
          </span>
          {(pagina + 1) * POR_PAGINA < filas.length ? (
            <Link href={url({ p: String(pagina + 1) })} className="text-cielo-ink hover:underline">Siguientes →</Link>
          ) : <span />}
        </nav>
      ) : null}
    </div>
  );
}

function Dato({ titulo, valor, detalle, alerta }: { titulo: string; valor: string; detalle?: string; alerta?: boolean }) {
  return (
    <div className={alerta ? "border-coral-ln bg-coral-s rounded-xl border px-4 py-3" : "border-linea bg-papel rounded-xl border px-4 py-3"}>
      <dt className="text-humo-oscuro text-xs font-medium">{titulo}</dt>
      <dd className="font-display mt-1 text-xl font-bold">{valor}</dd>
      {detalle ? <p className="text-pizarra mt-0.5 text-xs">{detalle}</p> : null}
    </div>
  );
}
