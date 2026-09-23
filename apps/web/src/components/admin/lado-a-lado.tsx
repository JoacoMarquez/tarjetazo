import { PRODUCTO_POR_ID } from "@/lib/marca";
import { fechaCorta, numero } from "@/lib/admin/formato";
import { diasCorto, type Tramo } from "@/lib/admin/paginas";
import { cn } from "@/lib/utils";

/**
 * El texto que publicó la fuente al lado de lo que extrajo el normalizador. Lo
 * usa el inspector de página y lo va a usar la auditoría por muestreo (#20):
 * la pregunta en los dos casos es "¿esto dice lo que dice la página?".
 */
export function LadoALado({
  contenido,
  tramos,
  aparte,
  acciones,
}: {
  contenido: string;
  tramos: Tramo[];
  /** Algo más para mostrar debajo de los tramos (la cola de revisión, un formulario). */
  aparte?: React.ReactNode;
  /** Botones debajo de cada tramo (ocultar, verificar). */
  acciones?: (t: Tramo) => React.ReactNode;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section aria-labelledby="texto-fuente" className="min-w-0">
        <h2 id="texto-fuente" className="text-base">
          Texto de la fuente{" "}
          <span className="text-humo-oscuro text-xs font-normal">
            {numero(contenido.length)} caracteres
          </span>
        </h2>
        <pre className="border-linea bg-papel text-tinta mt-2 max-h-[70vh] overflow-auto rounded-xl border px-4 py-3 font-sans text-sm leading-relaxed whitespace-pre-wrap">
          {contenido}
        </pre>
      </section>

      <section aria-labelledby="tramos" className="min-w-0">
        <h2 id="tramos" className="text-base">
          Lo que extrajo el normalizador{" "}
          <span className="text-humo-oscuro text-xs font-normal">
            {tramos.length} {tramos.length === 1 ? "tramo" : "tramos"}
          </span>
        </h2>
        {tramos.length === 0 ? (
          <p className="border-linea bg-papel text-pizarra mt-2 rounded-xl border px-4 py-3 text-sm">
            Esta página no dejó ningún beneficio: o no era un beneficio, o el
            normalizador no entendió el texto.
          </p>
        ) : (
          <ListaTramos tramos={tramos} acciones={acciones} />
        )}
        {aparte}
      </section>
    </div>
  );
}

export function ListaTramos({
  tramos,
  acciones,
}: {
  tramos: Tramo[];
  acciones?: (t: Tramo) => React.ReactNode;
}) {
  return (
    <ol className="mt-2 flex flex-col gap-3">
      {tramos.map((t) => (
        <li key={t.id}>
          <TarjetaTramo t={t} />
          {acciones ? <div className="mt-1 flex flex-wrap gap-2">{acciones(t)}</div> : null}
        </li>
      ))}
    </ol>
  );
}

function TarjetaTramo({ t }: { t: Tramo }) {
  const descuento =
    t.tipo === "cuotas"
      ? `${t.cuotas ?? "?"} cuotas`
      : t.tipo === "2x1"
        ? "2x1"
        : `${t.tipo === "reintegro" ? "Reintegro " : ""}${t.porcentaje === null ? "?" : Number(t.porcentaje)} %`;
  const filas: [string, React.ReactNode][] = [
    ["Tarjetas", t.productos_elegibles.length === 0 ? "Todas las de la fuente" : t.productos_elegibles.map((id) => PRODUCTO_POR_ID[id]?.nombre ?? id).join(" · ")],
    ["Días", diasCorto(t.dias_semana)],
    [
      "Vigencia",
      t.vigencia_desde || t.vigencia_hasta
        ? `${t.vigencia_desde ? fechaCorta(t.vigencia_desde) : "…"} – ${t.vigencia_hasta ? fechaCorta(t.vigencia_hasta) : "…"}`
        : "Sin fechas",
    ],
    ["Canal", t.canal],
  ];
  if (t.departamentos.length) filas.push(["Departamentos", t.departamentos.join(", ")]);
  if (t.tope_monto !== null) filas.push(["Tope", `$ ${numero(Number(t.tope_monto))} por ${t.tope_periodo ?? "?"}`]);
  if (t.compra_minima !== null) filas.push(["Compra mínima", `$ ${numero(Number(t.compra_minima))}`]);
  if (t.requiere_activacion) filas.push(["Activación", "Requiere activarlo"]);

  return (
    <article
      className={cn(
        "border-linea bg-papel rounded-xl border px-4 py-3",
        (t.estado_revision === "descartado" || t.estado_revision === "oculto") && "opacity-60",
      )}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm">
          <span className="font-display text-lg font-bold">{descuento}</span>{" "}
          <span className="text-pizarra">{t.titulo}</span>
        </p>
        <span className="text-humo-oscuro font-mono text-xs">
          {t.id.slice(t.id.lastIndexOf(":") + 1)} ·{" "}
          {t.estado_revision === "ok" ? "publicado" : t.estado_revision === "oculto" ? "oculto a mano" : t.estado_revision}
          {t.verificado_hasta ? ` · verificado hasta ${fechaCorta(t.verificado_hasta)}` : ""}
        </span>
      </header>
      <p className="text-humo-oscuro mt-1 text-xs">Texto original: «{t.descuento_raw}»</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        {filas.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-humo-oscuro">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {t.legales_raw ? (
        <details className="mt-2 text-xs">
          <summary className="text-cielo-ink cursor-pointer select-none">Legales</summary>
          <p className="text-pizarra mt-1 whitespace-pre-wrap">{t.legales_raw}</p>
        </details>
      ) : null}
    </article>
  );
}
