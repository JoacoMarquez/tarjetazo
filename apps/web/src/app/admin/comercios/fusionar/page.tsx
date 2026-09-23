import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORIAS, FUENTES } from "@tarjetazo/core";
import { createSupabaseAdmin, exigirAdmin } from "@/lib/admin";
import { numero } from "@/lib/admin/formato";
import { fusionar } from "./actions";

export const metadata: Metadata = { title: "Fusionar comercios" };

const RUBRO = new Map(CATEGORIAS.map((c) => [c.slug as string, c.label]));
const FUENTE = new Map(FUENTES.map((f) => [f.id as string, f.nombre]));

type Datos = {
  key: string;
  nombre: string;
  categoria: string;
  beneficios: { titulo: string; fuente_id: string; estado_revision: string }[];
  sucursales: number;
};

async function datos(key: string): Promise<Datos | null> {
  const db = createSupabaseAdmin();
  const [c, b, s] = await Promise.all([
    db.from("comercio").select("key, nombre, categoria").eq("key", key).maybeSingle(),
    db.from("beneficio").select("titulo, fuente_id, estado_revision").eq("comercio_key", key).neq("estado_revision", "descartado").limit(30),
    db.from("sucursal").select("id", { count: "exact", head: true }).eq("comercio_key", key),
  ]);
  if (!c.data) return null;
  return { ...(c.data as { key: string; nombre: string; categoria: string }), beneficios: (b.data ?? []) as Datos["beneficios"], sucursales: s.count ?? 0 };
}

export default async function Fusionar({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirAdmin();
  const sp = await searchParams;
  const a = typeof sp.a === "string" ? sp.a : "";
  const b = typeof sp.b === "string" ? sp.b : "";
  const [da, db] = await Promise.all([datos(a), datos(b)]);
  if (!da || !db) notFound();
  // Por defecto queda el que tiene más beneficios.
  const sugerido = db.beneficios.length > da.beneficios.length ? db.key : da.key;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={"/admin/salud#nombres_parecidos" as Route} className="text-pizarra text-sm hover:underline">← Salud de datos</Link>
      <h1 className="mt-2 text-2xl">¿Son el mismo comercio?</h1>
      <p className="text-pizarra mt-1 max-w-prose text-sm">
        Si lo son, elegí cuál queda. Los beneficios y las sucursales del otro se
        mueven, el otro desaparece y su URL redirige. La corrida del scraper ya
        no lo vuelve a crear. Si son distintos (dos sucursales con nombre propio,
        «Nacional» e «Internacional»), no los fusiones.
      </p>
      {typeof sp.error === "string" ? (
        <p role="alert" className="border-coral-ln bg-coral-s text-coral-ink mt-4 rounded-lg border px-4 py-3 text-sm">
          No se pudo fusionar: {sp.error}
        </p>
      ) : null}

      <form action={fusionar} className="mt-6">
        <input type="hidden" name="a" value={a} />
        <input type="hidden" name="b" value={b} />
        <div className="grid gap-4 md:grid-cols-2">
          {[da, db].map((c) => (
            <label key={c.key} className="border-linea bg-papel has-[:checked]:border-tinta flex cursor-pointer flex-col gap-2 rounded-xl border-2 px-4 py-3">
              <span className="flex items-center gap-2">
                <input type="radio" name="destino" value={c.key} defaultChecked={c.key === sugerido} className="size-4" />
                <span className="font-semibold">{c.nombre}</span>
                <span className="text-humo-oscuro text-xs">queda este</span>
              </span>
              <span className="text-humo-oscuro font-mono text-xs">{c.key}</span>
              <span className="text-pizarra text-xs">
                {RUBRO.get(c.categoria) ?? c.categoria} · {numero(c.beneficios.length)} beneficios · {numero(c.sucursales)} sucursales
              </span>
              <ul className="text-pizarra mt-1 flex flex-col gap-0.5 text-xs">
                {c.beneficios.slice(0, 8).map((x, i) => (
                  <li key={i}>
                    {FUENTE.get(x.fuente_id) ?? x.fuente_id}: {x.titulo}
                    {x.estado_revision !== "ok" ? ` (${x.estado_revision})` : ""}
                  </li>
                ))}
              </ul>
              <Link href={`/comercio/${c.key}` as Route} className="text-cielo-ink text-xs hover:underline" target="_blank">
                Ver en la web ↗
              </Link>
            </label>
          ))}
        </div>
        <button type="submit" className="bg-tinta text-papel mt-6 rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90">
          Fusionar
        </button>
      </form>
    </div>
  );
}
