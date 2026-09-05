import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { FUENTES } from "@tarjetazo/core";
import { EncabezadoSitio, NavInferior, PieSitio } from "@/components/nav";
import { LinkSaliente } from "@/components/link-saliente";
import { CardBeneficio } from "@/components/card-beneficio";
import { fuente, productosDe, comparar } from "@/lib/comparar";
import { listarBeneficios } from "@/lib/consultas";
import { FILTROS_VACIOS, NOMBRES_DIA, diaEnUruguay } from "@/lib/filtros";
import { labelCategoria } from "@/lib/comercio";

export const revalidate = 3600;
export function generateStaticParams() {
  return FUENTES.map((f) => ({ id: f.id }));
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const f = fuente(id);
  if (!f) return { title: "Fuente no encontrada" };
  const titulo = `Beneficios de ${f.nombre} hoy: descuentos y cuotas`;
  const descripcion = `Todos los descuentos, reintegros y cuotas que ${f.nombre} publica hoy en Uruguay, por rubro y por tarjeta, con topes, días y letra chica. Actualizado a diario.`;
  return { title: titulo, description: descripcion, alternates: { canonical: `/banco/${id}` }, openGraph: { title: titulo, description: descripcion, url: `/banco/${id}` } };
}

export default async function PaginaBanco({ params }: Props) {
  const { id } = await params;
  const f = fuente(id);
  if (!f) notFound();

  const [hoy, todos, ranking] = await Promise.all([
    listarBeneficios({ ...FILTROS_VACIOS, bancos: [id], dia: "hoy", orden: "porcentaje" }, 0, 12),
    listarBeneficios({ ...FILTROS_VACIOS, bancos: [id], orden: "relevancia" }, 0, 1),
    // Sin la función del comparador en la base (migración pendiente) la página
    // sirve igual, sin el puesto en el ranking.
    comparar([], []).catch(() => []),
  ]);
  const mio = ranking.find((r) => r.fuente_id === id);
  const posicion = ranking.findIndex((r) => r.fuente_id === id) + 1;
  const productos = productosDe(id);
  const porRubro = new Map<string, number>();
  for (const r of mio?.rubros ?? []) porRubro.set(r.categoria, (porRubro.get(r.categoria) ?? 0) + Number(r.n_beneficios));
  const rubros = [...porRubro].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: f.nombre,
    url: f.url,
    sameAs: [`https://tarjetazo.uy/banco/${id}`],
    ...(hoy.beneficios.length > 0 && {
      makesOffer: hoy.beneficios.slice(0, 10).map((b) => ({
        "@type": "Offer",
        name: `${b.titulo} en ${b.comercio}`,
        description: b.descuento_raw,
        url: `https://tarjetazo.uy/comercio/${b.comercio_key}/${id}`,
        ...(b.vigencia_hasta && { validThrough: b.vigencia_hasta }),
      })),
    }),
  };

  return (
    <>
      <EncabezadoSitio />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto max-w-3xl px-5 pb-24 pt-8 md:pb-12">
        <p className="text-humo text-xs font-semibold uppercase tracking-widest">
          {f.tipo} · {NOMBRES_DIA[diaEnUruguay()]}
        </p>
        <h1 className="mt-2 text-3xl md:text-4xl">Beneficios de {f.nombre} hoy</h1>
        <p className="text-humo mt-2">
          {todos.total} {todos.total === 1 ? "beneficio vigente" : "beneficios vigentes"}
          {mio && `, ${mio.n_comercios} comercios`}
          {posicion > 0 && ` · puesto ${posicion} de ${ranking.length} en el `}
          {posicion > 0 && <Link href="/comparar" className="text-cielo underline underline-offset-4">comparador</Link>}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/app?bancos=${id}`} className="bg-primary text-primary-foreground inline-flex h-10 items-center rounded-md px-4 text-sm font-medium hover:opacity-90">
            Ver todos en lista y mapa
          </Link>
          <LinkSaliente href={f.url} fuente={id} desde="banco" className="border-linea bg-card hover:bg-secondary inline-flex h-10 items-center gap-1.5 rounded-md border px-4 text-sm font-medium">
            Sitio de {f.nombre} <ExternalLink className="size-4" />
          </LinkSaliente>
        </div>

        {productos.length > 0 && (
          <section className="mt-8">
            <h2 className="text-humo text-xs font-semibold uppercase tracking-widest">Tarjetas y medios de pago</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {productos.map((p) => (
                <li key={p.id} className="border-linea bg-card rounded-pill border px-3 py-1 text-sm">
                  {p.nombre}
                  <span className="text-humo ml-1 text-xs">{p.instrumento}{p.tier ? ` · ${p.tier}` : ""}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {rubros.length > 0 && (
          <section className="mt-8">
            <h2 className="text-humo text-xs font-semibold uppercase tracking-widest">Por rubro</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {rubros.map(([cat, n]) => (
                <li key={cat}>
                  <Link href={`/app?bancos=${id}&cat=${cat}`} className="border-linea bg-card hover:bg-secondary rounded-pill inline-flex items-center gap-1.5 border px-3 py-1.5 text-sm">
                    {labelCategoria(cat)} <span className="num text-cielo font-semibold">{n}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-humo text-xs font-semibold uppercase tracking-widest">Destacados de hoy</h2>
          {hoy.beneficios.length === 0 ? (
            <p className="text-humo mt-3 text-sm">Hoy no hay beneficios de {f.nombre} que apliquen; mirá la lista completa.</p>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {hoy.beneficios.map((b) => <li key={b.id}><CardBeneficio b={b} paraVos={false} /></li>)}
            </ul>
          )}
        </section>

        <p className="text-humo mt-10 text-xs">
          Los beneficios pertenecen a {f.nombre}; la publicación oficial es la que vale. Esta página resume datos públicos y no es una recomendación financiera.
        </p>
      </main>
      <PieSitio />
      <NavInferior />
    </>
  );
}
