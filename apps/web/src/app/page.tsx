import Link from "next/link";
import { ArrowRight, Lock, MapPin, RefreshCw, Scale, Search, Sparkles } from "lucide-react";
import { CATEGORIAS, FUENTES } from "@tarjetazo/core";
import { EncabezadoSitio, NavInferior, PieSitio } from "@/components/nav";
import { hoyTeConviene, resumen } from "@/lib/stats";
import { comparar } from "@/lib/comparar";
import { NOMBRES_DIA, diaEnUruguay } from "@/lib/filtros";

// Los beneficios cambian con el cron diario; una hora de caché alcanza y evita
// pegarle a Supabase en cada visita.
export const revalidate = 3600;

function Numero({ valor, label }: { valor: number; label: string }) {
  return (
    <div>
      <p className="num text-cielo text-3xl font-bold leading-none">
        {valor.toLocaleString("es-UY")}
      </p>
      <p className="text-humo mt-1 text-xs">{label}</p>
    </div>
  );
}

export default async function Home() {
  const [datos, destacados, ranking] = await Promise.all([
    resumen(),
    hoyTeConviene(12),
    // Si la función del comparador no está, la home sale sin ese bloque.
    comparar([], []).catch(() => []),
  ]);
  const podio = ranking.slice(0, 3);
  const maximo = podio[0]?.puntos || 1;
  const hoy = NOMBRES_DIA[diaEnUruguay()]!;
  // Un "100% de descuento" nunca es un descuento sobre una compra: es una
  // bonificación de un costo mal tipificada al normalizar. El normalizador ya
  // las descarta, pero el hero no depende de que ninguna fuente futura se
  // cuele con el mismo error.
  const ejemplo = destacados.find((b) => (b.porcentaje ?? 0) < 100) ?? destacados[0];
  const grilla = destacados.filter((b) => b.id !== ejemplo?.id).slice(0, 6);

  return (
    <>
      <EncabezadoSitio />

      <main className="mx-auto max-w-5xl px-5 pb-24 md:pb-8">
        <section className="py-12 md:py-20">
          <p className="text-humo text-xs font-semibold uppercase tracking-widest">
            Uruguay · {hoy}
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl leading-[1.1] md:text-6xl">
            Todos los descuentos de tus tarjetas, en un solo lugar.
          </h1>
          <p className="text-humo mt-4 max-w-xl text-lg">
            Decinos qué tarjetas tenés y te decimos con cuál pagar. Sin cuenta, sin instalar
            nada y sin pedirte el número.
          </p>

          {ejemplo && (
            <p className="border-cielo-ln bg-cielo-s text-cielo-ink mt-6 inline-flex flex-wrap items-center gap-2 rounded-lg border px-4 py-3 text-sm">
              <Sparkles className="size-4 shrink-0" />
              <span>
                Pagando hoy en <strong>{ejemplo.comercio}</strong>:{" "}
                <strong className="num">
                  {ejemplo.porcentaje != null
                    ? `${Math.round(ejemplo.porcentaje)}%`
                    : ejemplo.tipo === "2x1"
                      ? "2x1"
                      : `${ejemplo.cuotas} cuotas`}
                </strong>{" "}
                con {ejemplo.fuente_nombre}
              </span>
            </p>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/app"
              className="bg-primary text-primary-foreground inline-flex h-11 items-center gap-2 rounded-md px-5 font-medium hover:opacity-90"
            >
              Ver los beneficios <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/ayuda"
              className="border-linea bg-card hover:bg-secondary inline-flex h-11 items-center rounded-md border px-5 font-medium"
            >
              Cómo funciona
            </Link>
          </div>

          <div className="border-linea mt-10 grid grid-cols-2 gap-6 border-t pt-6 sm:grid-cols-4">
            <Numero valor={datos.beneficios} label="beneficios vigentes" />
            <Numero valor={datos.comercios} label="comercios" />
            <Numero valor={datos.sucursales} label="locales en el mapa" />
            <Numero valor={datos.fuentes} label="bancos y billeteras" />
          </div>
        </section>

        {grilla.length > 0 && (
          <section className="border-linea border-t py-12">
            <h2 className="text-2xl">Hoy te conviene</h2>
            <p className="text-humo mt-1 text-sm">
              Lo que más ahorra este {hoy}, según lo que publican las fuentes.
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {grilla.map((b) => (
                <li key={b.id}>
                  <Link
                    href={{ pathname: "/app", query: { comercio: b.comercio_key } }}
                    className="border-linea bg-card hover:border-cielo-ln flex h-full flex-col rounded-lg border p-4 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-display font-bold">{b.comercio}</span>
                      <span className="num text-cielo shrink-0 text-xl font-bold">
                        {b.porcentaje != null
                          ? `${Math.round(b.porcentaje)}%`
                          : b.tipo === "2x1"
                            ? "2x1"
                            : `${b.cuotas}c`}
                      </span>
                    </div>
                    <span className="text-humo mt-1 text-xs">{b.fuente_nombre}</span>
                    <span className="text-humo mt-2 line-clamp-2 text-sm">
                      {b.descuento_raw}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="border-linea border-t py-12">
          <h2 className="text-2xl">Por rubro</h2>
          <ul className="mt-6 flex flex-wrap gap-2">
            {CATEGORIAS.map((c) => (
              <li key={c.slug}>
                <Link
                  href={{ pathname: "/app", query: { cat: c.slug } }}
                  className="border-linea bg-card hover:border-cielo-ln hover:bg-cielo-s hover:text-cielo-ink rounded-pill border px-3.5 py-2 text-sm font-medium transition-colors"
                >
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {podio.length > 0 && (
          <section className="border-linea border-t py-12">
            <h2 className="flex items-center gap-2 text-2xl">
              <Scale className="text-cielo size-6" /> ¿Qué banco te conviene?
            </h2>
            <p className="text-humo mt-1 text-sm">
              Ranking por cantidad y calidad de lo que publica cada fuente. Elegí tus rubros y se
              recalcula, con la fórmula a la vista.
            </p>
            <ol className="mt-6 space-y-3">
              {podio.map((r, i) => (
                <li key={r.fuente_id} className="border-linea bg-card rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Link href={`/banco/${r.fuente_id}`} className="font-display hover:text-cielo font-bold hover:underline">
                      <span className="text-humo mr-2 text-sm">{i + 1}.</span>
                      {r.fuente_nombre}
                    </Link>
                    <span className="text-humo text-xs">
                      {r.n_beneficios} beneficios · {r.n_comercios} comercios
                    </span>
                  </div>
                  <div className="bg-papel mt-3 h-2 overflow-hidden rounded-pill">
                    <div className="bg-marca h-full rounded-pill" style={{ width: `${Math.max(4, (r.puntos / maximo) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ol>
            <Link
              href="/comparar"
              className="bg-primary text-primary-foreground mt-6 inline-flex h-11 items-center gap-2 rounded-md px-5 font-medium hover:opacity-90"
            >
              Comparar según dónde gastás <ArrowRight className="size-4" />
            </Link>
          </section>
        )}

        <section className="border-linea border-t py-12">
          <h2 className="text-2xl">Cómo funciona</h2>
          <ol className="mt-6 grid gap-6 sm:grid-cols-3">
            {[
              {
                icono: Search,
                titulo: "Elegís tus tarjetas",
                texto:
                  "Marcás los bancos y billeteras que usás. Queda guardado en tu navegador, sin cuenta.",
              },
              {
                icono: MapPin,
                titulo: "Filtrás por lo tuyo",
                texto:
                  "Por rubro, por día y por departamento. En el mapa ves qué locales tenés cerca.",
              },
              {
                icono: RefreshCw,
                titulo: "Se actualiza solo",
                texto:
                  "Todos los días leemos las páginas oficiales de cada fuente y guardamos su texto original.",
              },
            ].map((p) => (
              <li key={p.titulo}>
                <p.icono className="text-cielo size-6" />
                <h3 className="mt-3 text-base">{p.titulo}</h3>
                <p className="text-humo mt-1 text-sm">{p.texto}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-linea border-t py-12">
          <h2 className="text-2xl">Fuentes</h2>
          <p className="text-humo mt-1 text-sm">
            Los beneficios pertenecen a cada banco o emisor; nosotros los ordenamos y enlazamos
            a la publicación oficial.
          </p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {FUENTES.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/banco/${f.id}`}
                  className="border-linea bg-card hover:border-cielo-ln hover:bg-cielo-s hover:text-cielo-ink rounded-pill inline-block border px-3.5 py-2 text-sm font-medium transition-colors"
                >
                  {f.nombre}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-menta-ln bg-menta-s text-menta-ink mt-4 rounded-lg border p-6">
          <h2 className="flex items-center gap-2 text-xl">
            <Lock className="size-5" /> Nunca te pedimos el número de tu tarjeta
          </h2>
          <p className="mt-2 max-w-2xl text-sm">
            Tarjetazo no pide datos personales, no tiene cuentas y no se conecta con tu banco.
            Lo único que guardamos es qué bancos elegiste, y queda en tu navegador: si borrás
            los datos del sitio, desaparece.
          </p>
        </section>
      </main>

      <PieSitio />
      <NavInferior />
    </>
  );
}
