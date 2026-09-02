import { CATEGORIAS, FUENTES } from "@tarjetazo/core";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-humo text-sm font-medium uppercase tracking-widest">Uruguay</p>
      <h1 className="mt-2 text-5xl">
        Tarjeta<span className="bg-marca bg-clip-text text-transparent">zo</span>
      </h1>
      <p className="text-humo mt-4 max-w-xl text-lg">
        Los descuentos, reintegros y cuotas de tus tarjetas, en un solo lugar. Elegís qué tenés y te
        decimos con cuál pagar.
      </p>

      <section className="mt-12">
        <h2 className="text-humo text-xs font-semibold uppercase tracking-widest">Fuentes v1</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {FUENTES.map((f) => (
            <li
              key={f.id}
              className="border-linea bg-card rounded-pill border px-3 py-1.5 text-sm font-medium"
            >
              {f.nombre}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-humo text-xs font-semibold uppercase tracking-widest">Rubros</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {CATEGORIAS.filter((c) => c.en_home).map((c) => (
            <li
              key={c.slug}
              className="bg-cielo-s text-cielo-ink rounded-pill px-3 py-1.5 text-sm font-medium"
            >
              {c.label}
            </li>
          ))}
        </ul>
      </section>

      <p className="text-humo border-linea mt-16 border-t pt-6 text-sm">
        En construcción — hito 1. Nunca te pedimos el número de tu tarjeta.
      </p>
    </main>
  );
}
