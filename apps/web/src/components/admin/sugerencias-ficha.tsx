import Link from "next/link";
import { BotonEnviar } from "@/components/admin/boton-enviar";
import { aceptarSugerencias, ignorarSugerencias } from "@/app/admin/tarjetas/actions";
import { etiquetaDe, mostrar, urlImagen, type Ficha, type Sugerencia } from "@/lib/admin/fichas";

/**
 * Las sugerencias pendientes de una familia: qué vio el scraper contra lo que
 * dice la ficha hoy, con aceptar/ignorar por fila y para todas. Se usa en la
 * bandeja y en la ficha.
 */
export function SugerenciasFicha({
  familiaId,
  nombre,
  fuente,
  sugerencias,
  ficha,
  volverA,
  conLinkAFicha,
}: {
  familiaId: string;
  nombre: string;
  fuente: string;
  sugerencias: Sugerencia[];
  ficha: Ficha | null;
  volverA: string;
  conLinkAFicha?: boolean;
}) {
  const ids = sugerencias.map((s) => s.id);
  const url = sugerencias[0]?.url;
  return (
    <section
      aria-labelledby={`sug-${familiaId}`}
      className="border-linea bg-papel overflow-hidden rounded-xl border"
    >
      <header className="border-linea flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b px-4 py-3">
        <h3 id={`sug-${familiaId}`} className="text-base">
          {conLinkAFicha ? (
            <Link href={`/admin/tarjetas/${familiaId}`} className="hover:underline">
              {nombre}
            </Link>
          ) : (
            nombre
          )}{" "}
          <span className="text-humo-oscuro text-xs font-normal">
            {fuente} · {sugerencias.length} {sugerencias.length === 1 ? "sugerencia" : "sugerencias"}
          </span>
        </h3>
        {url ? (
          <a href={url} target="_blank" rel="noreferrer noopener" className="text-cielo-ink text-xs hover:underline">
            Página del banco ↗
          </a>
        ) : null}
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-humo-oscuro text-left text-xs">
              <th scope="col" className="w-36 px-4 py-2 font-medium">Campo</th>
              <th scope="col" className="w-[38%] px-4 py-2 font-medium">Sugerido</th>
              <th scope="col" className="w-[30%] px-4 py-2 font-medium">En la ficha</th>
              <th scope="col" className="w-44 px-4 py-2"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {sugerencias.map((s) => (
              <tr key={s.id} className="border-linea border-t align-top">
                <td className="px-4 py-2 font-medium">{etiquetaDe(s.campo ?? "")}</td>
                <td className="px-4 py-2">
                  {s.campo === "imagen" ? (
                    <Foto src={urlImagen(s.archivo) ?? String(s.valor)} alt={`Foto sugerida de ${nombre}`} />
                  ) : (
                    <Valor v={mostrar(s.campo ?? "", s.valor)} />
                  )}
                </td>
                <td className="text-pizarra px-4 py-2">
                  {s.campo === "imagen" ? (
                    ficha?.imagen_frente ? (
                      <Foto src={urlImagen(ficha.imagen_frente)!} alt={`Foto actual de ${nombre}`} />
                    ) : (
                      "—"
                    )
                  ) : (
                    <Valor v={mostrar(s.campo ?? "", ficha?.[s.campo as keyof Ficha] ?? null)} />
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-2">
                    <form action={aceptarSugerencias}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="volver_a" value={volverA} />
                      <BotonEnviar primario>Aceptar</BotonEnviar>
                    </form>
                    <form action={ignorarSugerencias}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="volver_a" value={volverA} />
                      <BotonEnviar>Ignorar</BotonEnviar>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sugerencias.length > 1 ? (
        <footer className="border-linea flex flex-wrap justify-end gap-2 border-t px-4 py-3">
          <form action={aceptarSugerencias}>
            <Ids ids={ids} volverA={volverA} />
            <BotonEnviar primario>Aceptar las {sugerencias.length}</BotonEnviar>
          </form>
          <form action={ignorarSugerencias}>
            <Ids ids={ids} volverA={volverA} />
            <BotonEnviar>Ignorar las {sugerencias.length}</BotonEnviar>
          </form>
        </footer>
      ) : null}
    </section>
  );
}

export function Ids({ ids, volverA }: { ids: string[]; volverA: string }) {
  return (
    <>
      {ids.map((id) => (
        <input key={id} type="hidden" name="id" value={id} />
      ))}
      <input type="hidden" name="volver_a" value={volverA} />
    </>
  );
}

function Valor({ v }: { v: string | string[] }) {
  if (!Array.isArray(v)) return <span className="break-words">{v}</span>;
  return (
    <ul className="list-disc space-y-0.5 pl-4">
      {v.map((x) => (
        <li key={x} className="break-words">{x}</li>
      ))}
    </ul>
  );
}

export function Foto({ src, alt }: { src: string; alt: string }) {
  return (
    // Fotos del banco o de Storage: sin optimizador de Next.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" className="border-linea h-16 w-auto max-w-[10rem] rounded-md border object-contain" />
  );
}
