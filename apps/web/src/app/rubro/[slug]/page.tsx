import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORIAS } from "@tarjetazo/core";
import { EncabezadoSitio } from "@/components/encabezado";
import { NavInferior, PieSitio } from "@/components/nav";
import { CardBeneficio } from "@/components/card-beneficio";
import { comparar } from "@/lib/comparar";
import { listarBeneficios } from "@/lib/consultas";
import { FILTROS_VACIOS, NOMBRES_DIA, diaEnUruguay } from "@/lib/filtros";
import { JsonLd } from "@/components/json-ld";

export const revalidate = 3600;
// "Otros" no es algo que alguien busque: no tiene página.
const RUBROS = CATEGORIAS.filter((c) => c.slug !== "otros");
export const dynamicParams = false;
export function generateStaticParams() {
  return RUBROS.map((c) => ({ slug: c.slug }));
}

type Props = { params: Promise<{ slug: string }> };

const rubro = (slug: string) => RUBROS.find((c) => c.slug === slug) ?? null;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = rubro(slug);
  if (!c) return { title: "Rubro no encontrado" };
  const titulo = `Descuentos en ${c.label.toLowerCase()} hoy con tarjetas en Uruguay`;
  const descripcion = `Los descuentos, reintegros y cuotas en ${c.label.toLowerCase()} de todos los bancos, emisores y billeteras de Uruguay: qué tarjeta conviene hoy, con topes, días y letra chica. Actualizado a diario.`;
  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: `/rubro/${slug}` },
    openGraph: { title: titulo, description: descripcion, url: `/rubro/${slug}` },
  };
}

export default async function PaginaRubro({ params }: Props) {
  const { slug } = await params;
  const c = rubro(slug);
  if (!c) notFound();

  const [hoy, todos, ranking] = await Promise.all([
    listarBeneficios({ ...FILTROS_VACIOS, categorias: [slug], dia: "hoy", orden: "porcentaje" }, 0, 12),
    listarBeneficios({ ...FILTROS_VACIOS, categorias: [slug], orden: "relevancia" }, 0, 1),
    comparar([slug], []).catch(() => []),
  ]);
  const fuentes = ranking.filter((r) => r.n_beneficios > 0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Descuentos en ${c.label.toLowerCase()} en Uruguay`,
    url: `https://tarjetazo.uy/rubro/${slug}`,
    ...(hoy.beneficios.length > 0 && {
      mainEntity: {
        "@type": "ItemList",
        itemListElement: hoy.beneficios.slice(0, 10).map((b, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `https://tarjetazo.uy/comercio/${b.comercio_key}/${b.fuente_id}`,
          name: `${b.titulo} en ${b.comercio}`,
        })),
      },
    }),
  };

  return (
    <>
      <EncabezadoSitio />
      <JsonLd datos={jsonLd} />
      <main className="mx-auto max-w-3xl px-5 pb-24 pt-8 md:pb-12">
        <p className="text-humo text-xs font-semibold uppercase tracking-widest">
          Rubro · {NOMBRES_DIA[diaEnUruguay()]}
        </p>
        <h1 className="mt-2 text-3xl md:text-4xl">Descuentos en {c.label.toLowerCase()} hoy</h1>
        <p className="text-humo mt-2">
          {todos.total} {todos.total === 1 ? "beneficio vigente" : "beneficios vigentes"}
          {fuentes.length > 0 && ` de ${fuentes.length} ${fuentes.length === 1 ? "fuente" : "bancos, emisores y billeteras"}`}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/app?cat=${slug}`} className="bg-primary text-primary-foreground inline-flex h-10 items-center rounded-md px-4 text-sm font-medium hover:opacity-90">
            Ver todos en lista y mapa
          </Link>
          <Link href="/comparar" className="border-linea bg-card hover:bg-secondary inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium">
            Comparar tus tarjetas
          </Link>
        </div>

        {fuentes.length > 0 && (
          <section className="mt-8">
            <h2 className="text-humo text-xs font-semibold uppercase tracking-widest">Por banco</h2>
            <ul className="divide-linea border-linea bg-card mt-3 divide-y rounded-md border">
              {fuentes.map((r) => (
                <li key={r.fuente_id}>
                  <Link href={`/app?bancos=${r.fuente_id}&cat=${slug}`} className="hover:bg-secondary flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="font-medium">{r.fuente_nombre}</span>
                    <span className="text-humo">
                      {r.n_beneficios} {r.n_beneficios === 1 ? "beneficio" : "beneficios"} en {r.n_comercios} {r.n_comercios === 1 ? "comercio" : "comercios"}
                      {r.mejor_pct != null && <> · hasta <span className="num text-cielo font-semibold">{r.mejor_pct}%</span></>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-humo text-xs font-semibold uppercase tracking-widest">Destacados de hoy</h2>
          {hoy.beneficios.length === 0 ? (
            <p className="text-humo mt-3 text-sm">Hoy no hay beneficios en {c.label.toLowerCase()} que apliquen; mirá la lista completa.</p>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {hoy.beneficios.map((b) => <li key={b.id}><CardBeneficio b={b} paraVos={false} /></li>)}
            </ul>
          )}
        </section>

        <nav className="mt-10">
          <h2 className="text-humo text-xs font-semibold uppercase tracking-widest">Otros rubros</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {RUBROS.filter((o) => o.slug !== slug).map((o) => (
              <li key={o.slug}>
                <Link href={`/rubro/${o.slug}`} className="border-linea bg-card hover:bg-secondary rounded-pill inline-block border px-3 py-1 text-sm">
                  {o.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <p className="text-humo mt-10 text-xs">
          Los beneficios pertenecen a cada banco o emisor; la publicación oficial es la que vale. Esta página resume datos públicos y no es una recomendación financiera.
        </p>
      </main>
      <PieSitio />
      <NavInferior />
    </>
  );
}
