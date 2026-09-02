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

Dos migraciones: `20260902120000_init.sql` (esquema) y `20260902120100_catalogo.sql`
(rubros, fuentes y productos; idempotente, se puede reaplicar). El esquema define las tablas `fuente`,
`producto`, `categoria`, `comercio`, `sucursal` (geography Point 4326), `beneficio` y la
cola `beneficio_revision`, más la función `sucursales_cercanas()` para el mapa y triggers
que recalculan los derivados de `comercio`. Lectura pública vía RLS; escribe solo el
pipeline con la service role key.

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
