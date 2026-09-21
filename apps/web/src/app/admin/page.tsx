import type { Metadata } from "next";
import Link from "next/link";
import { FUENTES } from "@tarjetazo/core";
import { EstadoCorridaBadge } from "@/components/admin/estado-corrida";
import { createSupabaseAdmin, exigirAdmin } from "@/lib/admin";
import {
  agruparPorFuente,
  duracion,
  esProblema,
  estadoCorrida,
  resumenError,
  type Corrida,
} from "@/lib/admin/corridas";
import { fechaHora, numero } from "@/lib/admin/formato";

export const metadata: Metadata = { title: "Corridas" };

/** Corridas que se muestran por fuente: con el cron diario, algo más de una semana. */
const POR_FUENTE = 10;
const COLUMNAS =
  "id, fuente_id, empezo_en, termino_en, paginas, sin_cambios, nuevos, actualizados, vencidos, a_revisar, error";

const NOMBRE_FUENTE = new Map(FUENTES.map((f) => [f.id as string, f.nombre]));

/**
 * Una consulta por fuente del catálogo, y no las últimas N de la tabla: con un
 * tope global, una fuente que deja de correr termina saliendo de la ventana y
 * desaparece del monitoreo justo cuando más importa verla.
 */
async function corridasPorFuente(db: ReturnType<typeof createSupabaseAdmin>) {
  const resultados = await Promise.all(
    FUENTES.map((f) =>
      db
        .from("corrida")
        .select(COLUMNAS)
        .eq("fuente_id", f.id)
        .order("empezo_en", { ascending: false })
        .limit(POR_FUENTE)
        .returns<Corrida[]>(),
    ),
  );
  return {
    error: resultados.find((r) => r.error)?.error ?? null,
    data: resultados
      .flatMap((r) => r.data ?? [])
      .sort((a, b) => b.empezo_en.localeCompare(a.empezo_en)),
  };
}

export default async function Corridas() {
  await exigirAdmin();
  const db = createSupabaseAdmin();
  // Uruguay no tiene horario de verano: la fecha local es siempre UTC-3.
  const hoy = new Date(Date.now() - 3 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [corridas, cola, beneficios] = await Promise.all([
    corridasPorFuente(db),
    db
      .from("beneficio_revision")
      .select("id", { count: "exact", head: true })
      .eq("resuelto", false),
    db
      .from("beneficio")
      .select("id", { count: "exact", head: true })
      .eq("estado_revision", "ok")
      .or(`vigencia_desde.is.null,vigencia_desde.lte.${hoy}`)
      .or(`vigencia_hasta.is.null,vigencia_hasta.gte.${hoy}`),
  ]);

  const fallo = corridas.error ?? cola.error ?? beneficios.error;
  if (fallo) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl">Corridas</h1>
        <p
          role="alert"
          className="border-coral-ln bg-coral-s text-coral-ink mt-6 rounded-lg border px-4 py-3 text-sm"
        >
          No se pudo leer la base: {fallo.message}
        </p>
      </div>
    );
  }

  const ahora = Date.now();
  const todas = agruparPorFuente(
    corridas.data,
    ahora,
    POR_FUENTE,
    FUENTES.map((f) => f.id),
  );
  // Las que nunca corrieron van aparte: se ven, pero no son una alarma.
  const fuentes = todas.filter((f) => f.estado !== "sin_historial");
  const sinHistorial = todas.filter((f) => f.estado === "sin_historial");
  const conProblema = fuentes.filter((f) => esProblema(f.estado)).length;
  const ultima = corridas.data[0];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl">Corridas</h1>
      <p className="text-pizarra mt-1 text-sm">
        Últimas {POR_FUENTE} corridas de cada fuente. El cron corre todos los
        días a las 06:00.
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato
          titulo="Fuentes con problema"
          valor={`${conProblema} de ${fuentes.length}`}
          alerta={conProblema > 0}
        />
        <Dato titulo="Cola de revisión" valor={numero(cola.count ?? 0)} />
        <Dato
          titulo="Beneficios publicados"
          valor={numero(beneficios.count ?? 0)}
        />
        <Dato
          titulo="Última corrida"
          valor={ultima ? fechaHora(ultima.empezo_en) : "—"}
        />
      </dl>

      {fuentes.length === 0 ? (
        <p className="text-pizarra mt-8 text-sm">Todavía no hay corridas.</p>
      ) : (
        <div className="mt-8 flex flex-col gap-6">
          {fuentes.map((f) => (
            <section
              key={f.fuenteId}
              aria-labelledby={`fuente-${f.fuenteId}`}
              className="border-linea bg-papel overflow-hidden rounded-xl border"
            >
              <header className="border-linea flex items-center justify-between gap-3 border-b px-4 py-3">
                <h2 id={`fuente-${f.fuenteId}`} className="text-base">
                  {NOMBRE_FUENTE.get(f.fuenteId) ?? f.fuenteId}
                </h2>
                <EstadoCorridaBadge estado={f.estado} />
              </header>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="text-humo-oscuro text-left text-xs">
                      <Th>Empezó</Th>
                      <Th>Estado</Th>
                      <Th num>Páginas</Th>
                      <Th num>Sin cambios</Th>
                      <Th num>Nuevos</Th>
                      <Th num>Actualizados</Th>
                      <Th num>Vencidos</Th>
                      <Th num>A revisar</Th>
                      <Th num>Duración</Th>
                      <Th>Error</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.corridas.map((c) => (
                      <tr key={c.id} className="border-linea border-t">
                        <td className="px-4 py-2 whitespace-nowrap">
                          <Link
                            href={`/admin/corridas/${c.id}`}
                            className="text-cielo-ink hover:underline"
                          >
                            {fechaHora(c.empezo_en)}
                          </Link>
                        </td>
                        <td className="px-4 py-2">
                          <EstadoCorridaBadge estado={estadoCorrida(c, ahora)} />
                        </td>
                        <Td>{numero(c.paginas)}</Td>
                        <Td>{numero(c.sin_cambios)}</Td>
                        <Td destacar={c.nuevos > 0}>{numero(c.nuevos)}</Td>
                        <Td destacar={c.actualizados > 0}>
                          {numero(c.actualizados)}
                        </Td>
                        <Td destacar={c.vencidos > 0}>{numero(c.vencidos)}</Td>
                        <Td destacar={c.a_revisar > 0}>{numero(c.a_revisar)}</Td>
                        <Td>{duracion(c) ?? "—"}</Td>
                        <td className="text-coral-ink max-w-[22rem] px-4 py-2 text-xs">
                          {c.error ? (
                            <Link
                              href={`/admin/corridas/${c.id}`}
                              title="Ver el error completo"
                              className="hover:underline"
                            >
                              {resumenError(c.error)}
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      {sinHistorial.length > 0 ? (
        <p className="text-humo-oscuro mt-6 text-sm">
          Sin corridas registradas (no están en el cron):{" "}
          {sinHistorial
            .map((f) => NOMBRE_FUENTE.get(f.fuenteId) ?? f.fuenteId)
            .join(", ")}
          .
        </p>
      ) : null}
    </div>
  );
}

function Dato({
  titulo,
  valor,
  alerta,
}: {
  titulo: string;
  valor: string;
  alerta?: boolean;
}) {
  return (
    <div
      className={
        alerta
          ? "border-coral-ln bg-coral-s rounded-xl border px-4 py-3"
          : "border-linea bg-papel rounded-xl border px-4 py-3"
      }
    >
      <dt className="text-humo-oscuro text-xs font-medium">{titulo}</dt>
      <dd className="font-display mt-1 text-xl font-bold">{valor}</dd>
    </div>
  );
}

function Th({ children, num }: { children: React.ReactNode; num?: boolean }) {
  return (
    <th
      scope="col"
      className={`px-4 py-2 font-medium whitespace-nowrap ${num ? "text-right" : ""}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  destacar,
}: {
  children: React.ReactNode;
  destacar?: boolean;
}) {
  return (
    <td
      className={`px-4 py-2 text-right tabular-nums whitespace-nowrap ${
        destacar ? "text-tinta font-semibold" : "text-pizarra"
      }`}
    >
      {children}
    </td>
  );
}
