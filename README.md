# Tarjetazo

Agregador uruguayo de beneficios de tarjetas: descuentos, reintegros y cuotas de bancos,
emisores y billeteras, filtrados por las tarjetas que tenés, con lista y mapa.

Decisiones de producto: [`docs/03-spec.md`](docs/03-spec.md).
Investigación: [`docs/01-research-manguito.md`](docs/01-research-manguito.md),
[`docs/02-research-uruguay.md`](docs/02-research-uruguay.md).

## Estructura

```
apps/web           Next.js 15 (App Router) + Tailwind v4 + shadcn/ui + lucide
packages/core      Schemas Zod, tipos compartidos, catálogo de fuentes y rubros
packages/scrapers  Un módulo por fuente (BROU primero)
supabase/          Migraciones (PostGIS) y seed del catálogo
```

## Correr local

Requiere Node 20+ y pnpm (`corepack enable pnpm`).

```bash
pnpm install
cp .env.example .env.local   # completar con las claves de Supabase
pnpm dev                     # http://localhost:3000
```

Otros comandos: `pnpm build`, `pnpm typecheck`, `pnpm lint`.

## Base de datos

Con la [CLI de Supabase](https://supabase.com/docs/guides/local-development):

```bash
supabase start                          # Postgres + PostGIS local
supabase db reset                       # aplica todas las migraciones
```

Contra el proyecto hosteado (Supabase Free):

```bash
supabase link --project-ref <ref>
supabase db push
```

Migraciones en `supabase/migrations/`: el esquema, el catálogo (rubros, fuentes y
productos; idempotente), los productos reales de BROU y el caché de páginas crudas.
El esquema define las tablas `fuente`,
`producto`, `categoria`, `comercio`, `sucursal` (geography Point 4326), `beneficio` y la
cola `beneficio_revision`, más la función `sucursales_cercanas()` para el mapa y triggers
que recalculan los derivados de `comercio`. Lectura pública vía RLS; escribe solo el
pipeline con la service role key.

## Scrapers

Un módulo por fuente en `packages/scrapers/src/fuentes/`. El pipeline es
`descubrir URLs → bajar → texto plano → normalizar con Claude → validar Zod → upsert`.

```bash
pnpm --filter @tarjetazo/scrapers scrape brou --limite=3
```

`--solo-fetch` baja y cachea las páginas sin llamar a Claude (útil para probar el
descubrimiento sin gastar tokens). Necesita `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY` y `ANTHROPIC_API_KEY` en el entorno.

Cada página se guarda en `pagina_cruda` con un hash: si en la corrida siguiente el
hash no cambió, no se vuelve a normalizar y no cuesta nada. Lo que la fuente dejó
de publicar se marca `estado_revision = 'descartado'` en vez de borrarse. Los
tramos que no validan, o cuyas tarjetas no supimos mapear, van a
`beneficio_revision`. Cada corrida queda registrada en `corrida`.

Corre solo con el workflow `.github/workflows/scrapers.yml` (cron diario a las
06:00 de Uruguay), que además mantiene despierto el proyecto de Supabase Free.
Secrets del repo: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`.

### Notas sobre BROU

Todo el sitio es server-rendered, así que no hace falta Playwright. El mismo
beneficio se publica bajo varias categorías (`/gastronomia/expocafe` y
`/destacados/expocafe` son la misma página), por eso la identidad es el slug
final. Ni el sitemap ni las páginas de categoría listan todo por separado, así
que se unen las dos fuentes de URLs. Una página suele contener varios beneficios
(distinto porcentaje según el tier de la tarjeta): cada uno es una fila.

## Geocoding

Los bancos no publican direcciones: de 88 páginas de BROU, una sola las trae. Así que
las sucursales salen de OpenStreetMap para las cadenas que un beneficio nombra
(`packages/scrapers/src/geo/cadenas.ts`), y el geocodificador queda listo para cuando
una fuente sí publique la dirección.

```bash
pnpm --filter @tarjetazo/scrapers geo osm          # sucursales de cadenas desde OSM
pnpm --filter @tarjetazo/scrapers geo pendientes   # geocodifica las que tienen dirección sin punto
pnpm --filter @tarjetazo/scrapers geo localidades  # localidades del país, para el buscador de zona
```

`direcciones.ide.uy` es el geocodificador principal: resuelve en dos pasos
(`candidates` interpreta el texto libre, `find` devuelve el punto) y su `reverse`
completa el departamento de los locales de OSM, que rara vez traen `addr:state`.
Nominatim queda de fallback, con su límite de 1 req/s. Todo pasa por `geocode_cache`,
que cachea también los fallos para no reintentarlos cada corrida.

Dos cosas aprendidas peleando con Overpass, por si hay que tocarlo:

- Las consultas con regex sobre todo el país expiran; con `area(3600287072)` (Uruguay)
  y nombres exactos tardan segundos. Por eso `cadenas.ts` lista nombres literales.
- Con `bbox` en vez de área entra ruido argentino: una prueba devolvió una estación de
  tren de Buenos Aires llamada "Devoto".
- Los mirrors públicos a veces responden 200 con cero elementos por bases
  desincronizadas. Se acepta el primer resultado con contenido y se da la consulta por
  vacía solo si todos coinciden.

## Diseño

Tokens de marca en `apps/web/src/app/globals.css`: paleta cielo / menta / sol (más coral
para avisos), con variantes `-s` (fondo suave), `-ln` (línea) e `-ink` (texto); superficies
hueso/papel, texto tinta/humo, escala de radios y gradiente de marca. Tipografías:
**Outfit** (display), **Inter** (texto), **Archivo** tabular para números (`.num`).
Las vars semánticas de shadcn/ui están mapeadas encima, así que `pnpm dlx shadcn@latest add <x>`
sale con la marca puesta.

## Deploy

Vercel, con **Root Directory = `apps/web`** y las variables de `.env.example`.

## Legal

Los beneficios pertenecen a sus fuentes; cada ficha enlaza a la publicación oficial.
Corregimos o damos de baja contenido a pedido. Nunca pedimos el número de tu tarjeta.
