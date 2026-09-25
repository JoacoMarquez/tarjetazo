import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORIAS, Departamento, FUENTES } from "@tarjetazo/core";
import { BotonEnviar } from "@/components/admin/boton-enviar";
import { MiniMapa } from "@/components/admin/mini-mapa";
import { createSupabaseAdmin, exigirAdmin } from "@/lib/admin";
import { FUENTES_EDITABLES, urlOsm, type SucursalAdmin, type SugerenciaUbicacion } from "@/lib/admin/comercios";
import { paginaDeBeneficio, urlInspector } from "@/lib/admin/paginas";
import { aceptarUbicacion, agregarSucursal, borrarSucursal, ignorarUbicacion } from "../actions";

type Props = {
  params: Promise<{ key: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const NOMBRE_FUENTE = new Map(FUENTES.map((f) => [f.id as string, f.nombre]));
const NOMBRE_RUBRO = new Map(CATEGORIAS.map((c) => [c.slug as string, c.label]));
const ORIGEN: Record<string, string> = {
  manual: "a mano",
  osm_sugerencia: "sugerencia OSM",
  osm: "OSM (cadena)",
  ide_uy: "IDE",
  nominatim: "Nominatim",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const key = decodeURIComponent((await params).key);
  const { data } = await createSupabaseAdmin().from("comercio").select("nombre").eq("key", key).maybeSingle<{ nombre: string }>();
  return { title: data?.nombre ?? key };
}

type Beneficio = {
  id: string;
  fuente_id: string;
  titulo: string;
  descuento_raw: string;
  estado_revision: string;
  vigencia_hasta: string | null;
  origen: string;
  departamentos: string[] | null;
};

export default async function FichaComercio({ params, searchParams }: Props) {
  await exigirAdmin();
  const key = decodeURIComponent((await params).key);
  const sp = await searchParams;
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const db = createSupabaseAdmin();

  const [comercio, beneficios, sucursales, sugerencias] = await Promise.all([
    db.from("comercio").select("key, nombre, categoria").eq("key", key).maybeSingle<{ key: string; nombre: string; categoria: string }>(),
    db
      .from("beneficio")
      .select("id, fuente_id, titulo, descuento_raw, estado_revision, vigencia_hasta, origen, departamentos")
      .eq("comercio_key", key)
      .order("fuente_id")
      .order("id"),
    db.rpc("admin_sucursales", { p_key: key }),
    db.from("sucursal_sugerencia").select("*").eq("comercio_key", key).eq("estado", "pendiente").order("creada_en"),
  ]);
  if (!comercio.data) notFound();
  const fallo = beneficios.error ?? sucursales.error ?? sugerencias.error;

  const bs = (beneficios.data ?? []) as Beneficio[];
  const ss = (sucursales.data ?? []) as SucursalAdmin[];
  const gs = (sugerencias.data ?? []) as SugerenciaUbicacion[];
  const publicados = bs.filter((b) => b.estado_revision === "ok");
  const deptos = [...new Set(publicados.flatMap((b) => b.departamentos ?? []))];
  const puntos = [
    ...ss.filter((s) => s.lat != null && s.lng != null).map((s) => ({ lat: s.lat!, lng: s.lng!, etiqueta: s.nombre ? `${s.nombre} · ${s.direccion}` : s.direccion })),
    ...gs.map((g) => ({ lat: g.lat, lng: g.lng, etiqueta: `Sugerencia: ${g.nombre ?? ""} · ${g.direccion}`, sugerencia: true })),
  ];
  const ok = uno(sp.ok);
  const error = uno(sp.error);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin/comercios" className="text-pizarra text-sm hover:underline">← Comercios</Link>
      <h1 className="mt-2 text-2xl">{comercio.data.nombre}</h1>
      <p className="text-pizarra mt-1 text-sm">
        {NOMBRE_RUBRO.get(comercio.data.categoria) ?? comercio.data.categoria} · <code className="text-xs">{key}</code> ·{" "}
        {publicados.length} {publicados.length === 1 ? "beneficio publicado" : "beneficios publicados"}
        {deptos.length > 0 ? ` · ${deptos.join(", ")}` : ""} ·{" "}
        <Link href={`/comercio/${encodeURIComponent(key)}` as Route} className="text-cielo-ink hover:underline">ver en el sitio</Link>
      </p>

      {ok ? <p role="status" className="border-menta-ln bg-menta-s text-menta-ink mt-4 rounded-lg border px-4 py-3 text-sm">{ok}</p> : null}
      {error ? <p role="alert" className="border-coral-ln bg-coral-s text-coral-ink mt-4 rounded-lg border px-4 py-3 text-sm">{error}</p> : null}
      {fallo ? <p role="alert" className="border-coral-ln bg-coral-s text-coral-ink mt-4 rounded-lg border px-4 py-3 text-sm">No se pudo leer la base: {fallo.message}</p> : null}

      <section className="mt-6">
        <MiniMapa puntos={puntos} />
        <p className="text-humo-oscuro mt-1 text-xs">Punto lleno: sucursal cargada. Punto hueco: sugerencia pendiente.</p>
      </section>

      {gs.length > 0 ? (
        <section className="mt-8" aria-labelledby="sugerencias">
          <h2 id="sugerencias" className="text-lg">Sugerencias de ubicación <span className="text-humo-oscuro text-sm font-normal">{gs.length}</span></h2>
          <p className="text-pizarra mt-1 max-w-prose text-sm">
            Locales de OpenStreetMap con el mismo nombre. Puede ser otro negocio que
            se llama igual: mirá el tipo y la dirección antes de aceptar.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {gs.map((g) => (
              <li key={g.id} className="border-linea bg-papel flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
                <div className="min-w-0 text-sm">
                  <p className="font-medium">
                    {g.nombre}{" "}
                    <span className="text-humo-oscuro text-xs font-normal">{g.tipo}</span>
                  </p>
                  <p className="text-pizarra">
                    {g.direccion}
                    {g.localidad ? `, ${g.localidad}` : ""}
                    {g.departamento ? ` (${g.departamento})` : " · sin departamento"}
                    {urlOsm(g.osm_id) ? (
                      <>
                        {" · "}
                        <a href={urlOsm(g.osm_id)!} target="_blank" rel="noreferrer noopener" className="text-cielo-ink hover:underline">ver en OSM ↗</a>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={aceptarUbicacion}>
                    <input type="hidden" name="id" value={g.id} />
                    <input type="hidden" name="comercio_key" value={key} />
                    <BotonEnviar primario>Aceptar</BotonEnviar>
                  </form>
                  <form action={ignorarUbicacion}>
                    <input type="hidden" name="id" value={g.id} />
                    <input type="hidden" name="comercio_key" value={key} />
                    <BotonEnviar>No es este</BotonEnviar>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8" aria-labelledby="sucursales">
        <h2 id="sucursales" className="text-lg">Sucursales <span className="text-humo-oscuro text-sm font-normal">{ss.length}</span></h2>
        {ss.length === 0 ? (
          <p className="text-humo-oscuro mt-2 text-sm">Ninguna: el comercio no aparece en el mapa.</p>
        ) : (
          <div className="border-linea bg-papel mt-3 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-humo-oscuro text-left text-xs">
                  <th scope="col" className="px-4 py-2 font-medium">Dirección</th>
                  <th scope="col" className="px-4 py-2 font-medium">Localidad</th>
                  <th scope="col" className="px-4 py-2 font-medium">Origen</th>
                  <th scope="col" className="px-4 py-2 font-medium">Precisión</th>
                  <th scope="col" className="px-4 py-2"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {ss.map((s) => (
                  <tr key={s.id} className="border-linea border-t">
                    <td className="px-4 py-2">
                      {s.direccion}
                      {s.nombre ? <span className="text-humo-oscuro block text-xs">{s.nombre}</span> : null}
                    </td>
                    <td className="text-pizarra px-4 py-2">{[s.localidad, s.departamento].filter(Boolean).join(", ")}</td>
                    <td className="text-pizarra px-4 py-2 text-xs">
                      {ORIGEN[s.fuente_direccion ?? ""] ?? NOMBRE_FUENTE.get(s.fuente_direccion ?? "") ?? s.fuente_direccion ?? "—"}
                    </td>
                    <td className="text-pizarra px-4 py-2 text-xs">{s.lat == null ? "sin punto" : (s.exactitud ?? "—")}</td>
                    <td className="px-4 py-2 text-right">
                      {FUENTES_EDITABLES.has(s.fuente_direccion ?? "") ? (
                        <form action={borrarSucursal}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="comercio_key" value={key} />
                          <BotonEnviar>Borrar</BotonEnviar>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <details className="border-linea bg-papel mt-4 rounded-xl border px-4 py-3" open={ss.length === 0 && gs.length === 0}>
          <summary className="cursor-pointer text-sm font-medium select-none">Agregar una sucursal a mano</summary>
          <form action={agregarSucursal} className="mt-3 grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
            <input type="hidden" name="comercio_key" value={key} />
            <label className="flex flex-col gap-1 text-sm">
              Dirección
              <input name="direccion" required placeholder="Av. Alfredo Arocena 1587" className="border-linea bg-papel h-9 rounded-lg border px-2" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Localidad
              <input name="localidad" placeholder="opcional" className="border-linea bg-papel h-9 rounded-lg border px-2" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Departamento
              <select name="departamento" required defaultValue={deptos.length === 1 ? deptos[0] : "montevideo"} className="border-linea bg-papel h-9 rounded-lg border px-2">
                {Departamento.options.map((d) => (
                  <option key={d} value={d}>{d.replace(/-/g, " ")}</option>
                ))}
              </select>
            </label>
            <BotonEnviar primario>Ubicar y guardar</BotonEnviar>
            <p className="text-humo-oscuro text-xs sm:col-span-4">
              Se ubica con el geocodificador oficial (IDE). Calle y número, o calle y esquina, da un pin exacto.
            </p>
          </form>
        </details>
      </section>

      <section className="mt-8" aria-labelledby="beneficios">
        <h2 id="beneficios" className="text-lg">Beneficios <span className="text-humo-oscuro text-sm font-normal">{bs.length}</span></h2>
        <ul className="border-linea bg-papel mt-3 divide-linea divide-y rounded-xl border">
          {bs.map((b) => {
            const pagina = paginaDeBeneficio(b.id);
            return (
              <li key={b.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2 text-sm">
                <span className="min-w-0">
                  <span className="text-humo-oscuro text-xs">{NOMBRE_FUENTE.get(b.fuente_id) ?? b.fuente_id}</span>{" "}
                  {b.descuento_raw || b.titulo}
                </span>
                <span className="text-humo-oscuro text-xs whitespace-nowrap">
                  {b.estado_revision !== "ok" ? `${b.estado_revision} · ` : ""}
                  {b.origen === "manual" ? "manual · " : ""}
                  {b.vigencia_hasta ? `hasta ${b.vigencia_hasta}` : "sin fecha de fin"}
                  {pagina && b.origen !== "manual" ? (
                    <>
                      {" · "}
                      <Link href={urlInspector(pagina.fuenteId, pagina.externalId)} className="text-cielo-ink hover:underline">página</Link>
                    </>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg">¿Está duplicado?</h2>
        <form action="/admin/comercios/fusionar" className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <input type="hidden" name="a" value={key} />
          <label className="text-pizarra">
            Comparar con{" "}
            <input name="b" required placeholder="key del otro comercio" className="border-linea bg-papel h-8 w-56 rounded-lg border px-2" />
          </label>
          <button type="submit" className="border-linea text-pizarra hover:bg-papel-1 h-8 rounded-lg border px-3 font-medium">Comparar</button>
        </form>
      </section>
    </div>
  );
}
