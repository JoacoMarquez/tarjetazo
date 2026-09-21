import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FUENTES } from "@tarjetazo/core";
import { EstadoCorridaBadge } from "@/components/admin/estado-corrida";
import { createSupabaseAdmin, exigirAdmin } from "@/lib/admin";
import { duracion, estadoCorrida, type Corrida } from "@/lib/admin/corridas";
import { fechaHora, numero } from "@/lib/admin/formato";

export const metadata: Metadata = { title: "Corrida" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DetalleCorrida({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirAdmin();
  const { id } = await params;
  // Postgres rechaza un uuid mal formado con un error, no con cero filas.
  if (!UUID.test(id)) notFound();

  const { data: c, error } = await createSupabaseAdmin()
    .from("corrida")
    .select("*")
    .eq("id", id)
    .maybeSingle<Corrida>();
  if (error) throw new Error(`leyendo corrida: ${error.message}`);
  if (!c) notFound();

  const fuente = FUENTES.find((f) => f.id === c.fuente_id)?.nombre ?? c.fuente_id;
  const filas: [string, string][] = [
    ["Empezó", fechaHora(c.empezo_en)],
    ["Terminó", c.termino_en ? fechaHora(c.termino_en) : "—"],
    ["Duración", duracion(c) ?? "—"],
    ["Páginas", numero(c.paginas)],
    ["Sin cambios", numero(c.sin_cambios)],
    ["Nuevos", numero(c.nuevos)],
    ["Actualizados", numero(c.actualizados)],
    ["Vencidos", numero(c.vencidos)],
    ["A revisar", numero(c.a_revisar)],
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin" className="text-pizarra text-sm hover:underline">
        ← Corridas
      </Link>
      <div className="mt-2 flex items-center gap-3">
        <h1 className="text-2xl">{fuente}</h1>
        <EstadoCorridaBadge estado={estadoCorrida(c, Date.now())} />
      </div>
      <p className="text-humo-oscuro mt-1 font-mono text-xs">{c.id}</p>

      <dl className="border-linea bg-papel mt-6 grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border px-4 py-4 sm:grid-cols-3">
        {filas.map(([k, v]) => (
          <div key={k}>
            <dt className="text-humo-oscuro text-xs font-medium">{k}</dt>
            <dd className="mt-0.5 text-sm tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      {c.error ? (
        <section className="mt-6">
          <h2 className="text-base">Error</h2>
          <pre className="border-coral-ln bg-coral-s text-coral-ink mt-2 overflow-x-auto rounded-xl border px-4 py-3 text-xs whitespace-pre-wrap">
            {c.error}
          </pre>
        </section>
      ) : !c.termino_en ? (
        <p className="text-pizarra mt-6 text-sm">
          La corrida no cerró. Si quedó trabada,{" "}
          <code className="bg-papel-1 rounded px-1">scrape destrabar</code> la
          cierra para que el runner vuelva a arrancar.
        </p>
      ) : null}
    </div>
  );
}
