import { createSupabaseAdmin, exigirAdmin } from "@/lib/admin";

type UltimaCorrida = {
  fuente_id: string;
  empezo_en: string;
  termino_en: string | null;
  error: string | null;
};

const fechaHora = new Intl.DateTimeFormat("es-UY", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Montevideo",
});

export default async function InicioAdmin() {
  await exigirAdmin();
  const db = createSupabaseAdmin();

  const [cola, beneficios, corrida] = await Promise.all([
    db
      .from("beneficio_revision")
      .select("id", { count: "exact", head: true })
      .eq("resuelto", false),
    db
      .from("beneficio")
      .select("id", { count: "exact", head: true })
      .eq("estado_revision", "ok"),
    db
      .from("corrida")
      .select("fuente_id, empezo_en, termino_en, error")
      .order("empezo_en", { ascending: false })
      .limit(1)
      .maybeSingle<UltimaCorrida>(),
  ]);

  const fallo = cola.error ?? beneficios.error ?? corrida.error;
  const ultima = corrida.data;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl">Backoffice</h1>
      <p className="text-pizarra mt-1 text-sm">
        Las pantallas de corridas, salud de datos y cola de revisión llegan en
        los próximos issues. Esto confirma que el acceso y la base funcionan.
      </p>

      {fallo ? (
        <p
          role="alert"
          className="border-coral-ln bg-coral-s text-coral-ink mt-6 rounded-lg border px-4 py-3 text-sm"
        >
          No se pudo leer la base: {fallo.message}
        </p>
      ) : (
        <dl className="mt-6 grid gap-3 sm:grid-cols-3">
          <Dato titulo="Beneficios publicados" valor={beneficios.count ?? 0} />
          <Dato titulo="Cola de revisión" valor={cola.count ?? 0} />
          <Dato
            titulo="Última corrida"
            valor={ultima ? ultima.fuente_id : "—"}
            detalle={
              ultima
                ? `${fechaHora.format(new Date(ultima.empezo_en))} · ${
                    ultima.error
                      ? "con error"
                      : ultima.termino_en
                        ? "ok"
                        : "abierta"
                  }`
                : "Todavía no hay corridas"
            }
          />
        </dl>
      )}
    </div>
  );
}

function Dato({
  titulo,
  valor,
  detalle,
}: {
  titulo: string;
  valor: number | string;
  detalle?: string;
}) {
  return (
    <div className="border-linea bg-papel rounded-xl border px-4 py-3">
      <dt className="text-humo-oscuro text-xs font-medium">{titulo}</dt>
      <dd className="font-display mt-1 text-2xl font-bold">
        {typeof valor === "number" ? valor.toLocaleString("es-UY") : valor}
      </dd>
      {detalle ? <p className="text-pizarra mt-0.5 text-xs">{detalle}</p> : null}
    </div>
  );
}
