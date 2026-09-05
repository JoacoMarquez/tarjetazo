import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, MapPin, Sparkles } from "lucide-react";
import { EncabezadoSitio, NavInferior, PieSitio } from "@/components/nav";
import { CopiarLink } from "@/components/copiar-link";
import {
  aplicaHoy,
  cifra,
  comerciosDelRubro,
  fichaComercio,
  labelCategoria,
  nombreFuente,
  pesos,
  type BeneficioFicha,
} from "@/lib/comercio";
import { NOMBRES_DIA, diaEnUruguay } from "@/lib/filtros";

// El cron corre una vez por día; una hora de caché por página es de sobra y
// mantiene a Supabase fuera del camino de cada visita.
export const revalidate = 3600;
export const dynamicParams = true;

const BASE = "https://tarjetazo.uy";

type Props = { params: Promise<{ key: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  const ficha = await fichaComercio(key);
  if (!ficha || ficha.beneficios.length === 0) return { title: "Comercio no encontrado" };
  const { comercio, beneficios } = ficha;
  const mejor = beneficios[0]!;
  const fuentes = [...new Set(beneficios.map((b) => nombreFuente(b.fuente_id)))];
  const titulo = `${comercio.nombre}: ${cifra(mejor)} con ${fuentes.slice(0, 3).join(", ")}`;
  const descripcion = `Descuentos y cuotas en ${comercio.nombre} (${labelCategoria(comercio.categoria)}) con tarjetas de ${fuentes.join(", ")}. ${beneficios.length} ${beneficios.length === 1 ? "beneficio vigente" : "beneficios vigentes"}, con tope, días y letra chica.`;
  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: `/comercio/${comercio.key}` },
    openGraph: { title: titulo, description: descripcion, url: `/comercio/${comercio.key}` },
  };
}

function diasLegibles(dias: number[]) {
  if (dias.length === 0 || dias.length === 7) return "todos los días";
  return dias.map((d) => NOMBRES_DIA[d]!.slice(0, 3)).join(", ");
}

function FilaBeneficio({ b }: { b: BeneficioFicha }) {
  return (
    <li>
      <Link
        href={`/comercio/${b.comercio_key}/${b.fuente_id}`}
        className="border-linea bg-card hover:border-cielo-ln flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors"
      >
        <div className="min-w-0">
          <p className="font-medium">{b.titulo}</p>
          <p className="text-humo mt-0.5 text-xs">
            {nombreFuente(b.fuente_id)} · {diasLegibles(b.dias_semana)}
            {b.tope_monto != null && ` · tope ${pesos(b.tope_monto)}${b.tope_periodo ? `/${b.tope_periodo}` : ""}`}
          </p>
        </div>
        <span className="num text-cielo shrink-0 text-xl font-bold">{cifra(b)}</span>
      </Link>
    </li>
  );
}

export default async function PaginaComercio({ params }: Props) {
  const { key } = await params;
  const ficha = await fichaComercio(key);
  if (!ficha || ficha.beneficios.length === 0) notFound();
  const { comercio, beneficios, sucursales } = ficha;

  const hoy = beneficios.filter(aplicaHoy);
  const mejorHoy = hoy[0];
  const porFuente = new Map<string, BeneficioFicha[]>();
  for (const b of beneficios) porFuente.set(b.fuente_id, [...(porFuente.get(b.fuente_id) ?? []), b]);
  const relacionados = await comerciosDelRubro(comercio.categoria, comercio.key);
  const url = `${BASE}/comercio/${comercio.key}`;

  // Schema.org: manguito no lo tiene. Organization para el comercio y una
  // Offer por beneficio, con el porcentaje cuando lo hay.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: comercio.nombre,
    url,
    ...(sucursales[0] && {
      location: sucursales.slice(0, 20).map((s) => ({
        "@type": "Place",
        name: s.nombre ?? comercio.nombre,
        address: { "@type": "PostalAddress", streetAddress: s.direccion, addressLocality: s.localidad ?? undefined, addressRegion: s.departamento, addressCountry: "UY" },
        geo: { "@type": "GeoCoordinates", latitude: s.lat, longitude: s.lng },
      })),
    }),
    makesOffer: beneficios.map((b) => ({
      "@type": "Offer",
      name: b.titulo,
      description: b.descuento_raw,
      url: `${url}/${b.fuente_id}`,
      offeredBy: { "@type": "Organization", name: nombreFuente(b.fuente_id) },
      ...(b.vigencia_hasta && { validThrough: b.vigencia_hasta }),
      ...(b.vigencia_desde && { validFrom: b.vigencia_desde }),
      ...(b.porcentaje != null && {
        priceSpecification: { "@type": "PriceSpecification", name: `${Math.round(b.porcentaje)}% de descuento` },
      }),
    })),
  };

  return (
    <>
      <EncabezadoSitio />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="mx-auto max-w-3xl px-5 pb-24 pt-8 md:pb-12">
        <nav aria-label="Migas" className="text-humo text-xs">
          <Link href="/app" className="hover:underline">Beneficios</Link>
          {" › "}
          <Link href={`/app?cat=${comercio.categoria}`} className="hover:underline">
            {labelCategoria(comercio.categoria)}
          </Link>
        </nav>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl md:text-4xl">{comercio.nombre}</h1>
            <p className="text-humo mt-1 text-sm">
              {beneficios.length} {beneficios.length === 1 ? "beneficio" : "beneficios"} de{" "}
              {porFuente.size} {porFuente.size === 1 ? "fuente" : "fuentes"}
              {sucursales.length > 0 && ` · ${sucursales.length} ${sucursales.length === 1 ? "local" : "locales"}`}
            </p>
          </div>
          <CopiarLink url={url} />
        </div>

        {mejorHoy ? (
          <section className="border-menta-ln bg-menta-s text-menta-ink mt-6 rounded-lg border p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest">
              <Sparkles className="size-3.5" /> Hoy {NOMBRES_DIA[diaEnUruguay()]} te conviene
            </p>
            <p className="mt-2 text-lg">
              <strong className="num text-2xl">{cifra(mejorHoy)}</strong> con{" "}
              <strong>{nombreFuente(mejorHoy.fuente_id)}</strong>
              {mejorHoy.tope_monto != null && (
                <span className="text-sm"> · tope {pesos(mejorHoy.tope_monto)}{mejorHoy.tope_periodo ? `/${mejorHoy.tope_periodo}` : ""}</span>
              )}
            </p>
            {hoy.length > 1 && <p className="mt-1 text-sm">Y {hoy.length - 1} más que también aplican hoy.</p>}
          </section>
        ) : (
          <p className="border-linea bg-card text-humo mt-6 rounded-lg border p-4 text-sm">
            Hoy {NOMBRES_DIA[diaEnUruguay()]} no aplica ninguno; mirá los días de cada uno abajo.
          </p>
        )}

        {[...porFuente].map(([fuenteId, lista]) => (
          <section key={fuenteId} className="mt-8">
            <h2 className="text-humo text-xs font-semibold uppercase tracking-widest">
              Con {nombreFuente(fuenteId)}
            </h2>
            <ul className="mt-3 space-y-2">
              {lista.map((b) => <FilaBeneficio key={b.id} b={b} />)}
            </ul>
          </section>
        ))}

        {sucursales.length > 0 && (
          <section className="mt-10">
            <h2 className="text-humo text-xs font-semibold uppercase tracking-widest">Locales</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {sucursales.slice(0, 24).map((s) => (
                <li key={s.id} className="border-linea bg-card rounded-lg border p-3 text-sm">
                  <p className="font-medium">{s.nombre ?? comercio.nombre}</p>
                  <p className="text-humo">{s.direccion}{s.localidad ? `, ${s.localidad}` : ""}</p>
                  <a
                    className="text-cielo mt-1 inline-flex items-center gap-1 text-xs underline underline-offset-4"
                    href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    <MapPin className="size-3" /> Cómo llegar
                  </a>
                </li>
              ))}
            </ul>
            {sucursales.length > 24 && (
              <p className="text-humo mt-2 text-xs">Y {sucursales.length - 24} locales más en el mapa.</p>
            )}
          </section>
        )}

        {relacionados.length > 0 && (
          <section className="mt-10">
            <h2 className="text-humo text-xs font-semibold uppercase tracking-widest">
              Más en {labelCategoria(comercio.categoria)}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {relacionados.map((c) => (
                <li key={c.key}>
                  <Link
                    href={`/comercio/${c.key}`}
                    className="border-linea bg-card hover:bg-secondary rounded-pill inline-flex items-center gap-1.5 border px-3 py-1.5 text-sm"
                  >
                    {c.nombre}
                    {c.best_pct != null && <span className="num text-cielo font-semibold">{Math.round(c.best_pct)}%</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-humo mt-10 text-xs">
          Los beneficios pertenecen a cada fuente. Antes de pagar, confirmá en la publicación oficial: en cada ficha está el link.{" "}
          <Link href="/app" className="text-cielo inline-flex items-center gap-1 underline underline-offset-4">
            Ver todos en el mapa <ArrowRight className="size-3" />
          </Link>
        </p>
      </main>
      <PieSitio />
      <NavInferior />
    </>
  );
}

