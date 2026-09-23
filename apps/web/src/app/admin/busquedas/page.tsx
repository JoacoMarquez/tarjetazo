import type { Metadata, Route } from "next";
import Link from "next/link";
import { createSupabaseAdmin, exigirAdmin } from "@/lib/admin";
import { agruparBusquedas, type BusquedaDia } from "@/lib/admin/busquedas";
import { numero } from "@/lib/admin/formato";

export const metadata: Metadata = { title: "Búsquedas sin resultado" };

const DIAS = 30;

export default async function Busquedas() {
  await exigirAdmin();
  const desde = new Date(Date.now() - 3 * 3600e3 - DIAS * 86400e3).toISOString().slice(0, 10);
  const { data, error } = await createSupabaseAdmin()
    .from("busqueda_sin_resultado")
    .select("q, dia, veces")
    .gte("dia", desde)
    .limit(5000);
  const terminos = agruparBusquedas((data ?? []) as BusquedaDia[]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl">Búsquedas sin resultado</h1>
      <p className="text-pizarra mt-1 max-w-prose text-sm">
        Lo que la gente buscó en los últimos {DIAS} días y no encontró, ni
        siquiera sin filtros: la mejor pista de un comercio que falta. Si una
        fuente lo publica, es un problema del scraper; si no, se puede cargar a
        mano. Los términos a medio escribir se juntan con el completo.
      </p>

      {error ? (
        <p role="alert" className="border-coral-ln bg-coral-s text-coral-ink mt-6 rounded-lg border px-4 py-3 text-sm">
          No se pudo leer la base: {error.message}. Si falta la tabla, hay que aplicar la migración.
        </p>
      ) : terminos.length === 0 ? (
        <p className="text-humo-oscuro mt-6 text-sm">Nada todavía.</p>
      ) : (
        <div className="border-linea bg-papel mt-6 overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-humo-oscuro text-left text-xs">
                <th className="px-4 py-2 font-medium">Buscaron</th>
                <th className="px-4 py-2 text-right font-medium">Veces</th>
                <th className="px-4 py-2 text-right font-medium">Días</th>
                <th className="px-4 py-2 font-medium">Última</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {terminos.slice(0, 300).map((t) => (
                <tr key={t.q} className="border-linea border-t">
                  <td className="px-4 py-2 font-medium">{t.q}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{numero(t.veces)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{numero(t.dias)}</td>
                  <td className="text-pizarra px-4 py-2 whitespace-nowrap">{t.ultima.split("-").reverse().join("/")}</td>
                  <td className="px-4 py-2 text-xs whitespace-nowrap">
                    <Link
                      href={`/admin/beneficios?q=${encodeURIComponent(t.q)}&estado=todos` as Route}
                      className="text-cielo-ink mr-3 hover:underline"
                    >
                      Buscar en el registro
                    </Link>
                    <Link
                      href={`/admin/beneficios/nuevo?comercio=${encodeURIComponent(t.q)}` as Route}
                      className="text-cielo-ink hover:underline"
                    >
                      Cargar a mano
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
