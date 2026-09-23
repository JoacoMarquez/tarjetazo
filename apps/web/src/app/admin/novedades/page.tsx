import type { Metadata, Route } from "next";
import Link from "next/link";
import { FUENTES } from "@tarjetazo/core";
import { createSupabaseAdmin, exigirAdmin } from "@/lib/admin";
import { fechaHora, numero } from "@/lib/admin/formato";
import { paginaDeBeneficio, urlInspector } from "@/lib/admin/paginas";

export const metadata: Metadata = { title: "Novedades" };

type Cambio = "nuevo" | "actualizado" | "restaurado" | "baja";

type Fila = {
  id: string;
  fuente_id: string;
  comercio_key: string;
  titulo: string;
  descuento_raw: string;
  cambio: Cambio;
  corrida_id: string;
  comercio: { nombre: string } | null;
};

const SECCIONES: { cambio: Cambio; titulo: string; ayuda: string }[] = [
  { cambio: "nuevo", titulo: "Nuevos", ayuda: "Beneficios que no existían." },
  { cambio: "actualizado", titulo: "Cambiaron", ayuda: "El banco modificó el descuento, las tarjetas, los días o la vigencia." },
  { cambio: "restaurado", titulo: "Volvieron", ayuda: "Se habían dado de baja y la página reapareció." },
  { cambio: "baja", titulo: "Bajas", ayuda: "El banco dejó de publicarlos. No se borran: quedan descartados." },
];

const NOMBRE_FUENTE = new Map(FUENTES.map((f) => [f.id as string, f.nombre]));

/**
 * Qué cambió en la última corrida de cada fuente. Cada beneficio guarda qué
 * corrida lo tocó por última vez y qué le hizo (`corrida_id`, `cambio`).
 */
export default async function Novedades() {
  await exigirAdmin();
  const db = createSupabaseAdmin();

  const ultimas = await Promise.all(
    FUENTES.map((f) =>
      db
        .from("corrida")
        .select("id, fuente_id, empezo_en")
        .eq("fuente_id", f.id)
        .not("termino_en", "is", null)
        .is("error", null)
        .order("empezo_en", { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string; fuente_id: string; empezo_en: string }>(),
    ),
  );
  const corridas = ultimas.flatMap((r) => (r.data ? [r.data] : []));
  const fallo = ultimas.find((r) => r.error)?.error;

  const { data, error } = corridas.length
    ? await db
        .from("beneficio")
        .select("id, fuente_id, comercio_key, titulo, descuento_raw, cambio, corrida_id, comercio(nombre)")
        .in("corrida_id", corridas.map((c) => c.id))
        .order("comercio_key")
        .limit(2000)
    : { data: [], error: null };
  const filas = (data ?? []) as unknown as Fila[];
  const cuando = new Map(corridas.map((c) => [c.fuente_id, c.empezo_en]));

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl">Novedades</h1>
      <p className="text-pizarra mt-1 text-sm">
        Lo que cambió en la última corrida de cada fuente. Una página que el
        banco retocó sin cambiar sus beneficios no aparece.
      </p>

      {fallo || error ? (
        <p role="alert" className="border-coral-ln bg-coral-s text-coral-ink mt-6 rounded-lg border px-4 py-3 text-sm">
          No se pudo leer la base: {(fallo ?? error)!.message}. Si falta la columna{" "}
          <code>corrida_id</code>, hay que aplicar la migración.
        </p>
      ) : null}

      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SECCIONES.map((s) => (
          <li key={s.cambio}>
            <a href={`#${s.cambio}`} className="border-linea bg-papel hover:bg-papel-1 block rounded-xl border px-4 py-3">
              <span className="font-display block text-xl font-bold tabular-nums">
                {numero(filas.filter((f) => f.cambio === s.cambio).length)}
              </span>
              <span className="text-pizarra text-xs">{s.titulo}</span>
            </a>
          </li>
        ))}
      </ul>

      {SECCIONES.map((s) => {
        const deEsta = filas.filter((f) => f.cambio === s.cambio);
        return (
          <section key={s.cambio} id={s.cambio} className="mt-10 scroll-mt-6">
            <h2 className="text-lg">
              {s.titulo} <span className="text-humo-oscuro text-sm font-normal">{numero(deEsta.length)}</span>
            </h2>
            <p className="text-pizarra mt-1 text-sm">{s.ayuda}</p>
            {deEsta.length === 0 ? (
              <p className="text-humo-oscuro mt-2 text-sm">Nada.</p>
            ) : (
              <div className="border-linea bg-papel mt-3 overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="text-humo-oscuro text-left text-xs">
                      <th className="px-4 py-2 font-medium">Comercio</th>
                      <th className="px-4 py-2 font-medium">Fuente</th>
                      <th className="px-4 py-2 font-medium">Beneficio</th>
                      <th className="px-4 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {deEsta.map((b) => {
                      const pag = paginaDeBeneficio(b.id);
                      return (
                        <tr key={b.id} className="border-linea border-t align-top">
                          <td className="px-4 py-2">
                            <Link href={`/comercio/${b.comercio_key}` as Route} className="text-cielo-ink hover:underline">
                              {b.comercio?.nombre ?? b.comercio_key}
                            </Link>
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            {NOMBRE_FUENTE.get(b.fuente_id) ?? b.fuente_id}
                            <span className="text-humo-oscuro block text-xs">
                              {cuando.has(b.fuente_id) ? fechaHora(cuando.get(b.fuente_id)!) : ""}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            {b.titulo}
                            <span className="text-humo-oscuro block text-xs" title={b.descuento_raw}>
                              {b.descuento_raw.slice(0, 90)}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-xs whitespace-nowrap">
                            {pag ? (
                              <Link href={urlInspector(pag.fuenteId, pag.externalId)} className="text-cielo-ink hover:underline">
                                Inspector
                              </Link>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
