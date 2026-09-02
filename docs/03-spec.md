# Tarjetazo — Spec v1 (decisiones del grill-me, 2026-09-02)

## Qué es
Agregador uruguayo de beneficios (descuentos, reintegros, cuotas) de bancos, emisores y billeteras, filtrado por las tarjetas que tenés, con lista y mapa. Inspirado en manguito.ar (ver `01-research-manguito.md`). Nombre: **Tarjetazo**. Dominio canónico `tarjetazo.uy`, `tarjetazo.com.uy` redirige.

## Objetivo
Producto real para lanzar en Uruguay (b) con mentalidad de side project (a): tracción primero, monetización después. Competidor directo: Bankos (app nativa, sin web indexable). Ángulo: web con SEO por comercio + comparador data-driven.

## Alcance v1
Incluye: lista + mapa (una sola pantalla split), páginas de comercio SEO, home explicativa, selector "Mis tarjetas" sin cuenta, comparador "qué banco te conviene según tus rubros".
Excluye (v2): cuenta/login/sync, favoritos con cuenta, notificaciones, BBVA/ANDA/PassCard/Cabal/clubes, app nativa, comparador editorial.

## Fuentes v1 (en orden)
1. BROU (tracer bullet) 2. Santander 3. Scotiabank 4. Itaú 5. OCA 6. Prex.
Cobertura: todo el país en datos; geocoding y QA en Montevideo, Canelones y Maldonado.

## Datos
- Pipeline por fuente: `fetch → raw (HTML/JSON guardado) → normalizar con Claude (Sonnet 5, salida estructurada; Haiku 4.5 si escala) → validar Zod → upsert Supabase`. Lo que no valida queda en cola "revisar a mano". Se conserva siempre el texto original (`*_raw`) y se muestra como letra chica.
- Corre en GitHub Actions, cron diario (mantiene vivo Supabase Free). Playwright para sitios que bloquean bots.
- Geocoding: direcciones.ide.uy (oficial, gratis) con fallback Nominatim (1 req/s, cache).
- Modelo (adaptado de manguito):
  - `fuente {id, nombre, tipo: banco|emisor|billetera|club, logo_url, url, activa}`
  - `producto {id, fuente_id, nombre, instrumento: credito|debito|prepaga|saldo, red: visa|mastercard|amex|cabal|propia, tier: null|gold|platinum|black|signature}` (granularidad hasta tier, opcional en UI)
  - `categoria {slug, label, orden, en_home}`
  - `comercio {key, nombre, categoria, logo_url, best_pct, max_cuotas, n_beneficios, n_fuentes}`
  - `sucursal {comercio_key, direccion, localidad, departamento, geom (PostGIS)}`
  - `beneficio {id, fuente_id, comercio_key, titulo, descuento_raw, porcentaje, cuotas, tipo: porcentaje|cuotas|reintegro|2x1, dias_semana[], vigencia_desde/hasta, departamentos[], productos_elegibles[], tope_monto, tope_periodo, canal: presencial|online|ambos, mecanica: [qr|nfc|app], acumulable, compra_minima, requiere_activacion, legales_raw, como_usarlo[], url_fuente, fetched_at, estado_revision}`
- Dos niveles geográficos: `beneficio.departamentos[]` filtra en lista; `sucursal.geom` alimenta el mapa. Comercio sin sucursal geocodificada no aparece en el mapa.

## Producto / UI
- **Home** explicativa (hero con ejemplo real "Pagando en X hoy: BROU Débito 15%", contador, "hoy te conviene", rubros, cómo funciona, privacidad: nunca pedimos el número).
- **App**: una pantalla split lista + mapa (mobile: mapa arriba, hoja deslizable). Filtros: rubro, día (hoy/mañana/L–D), solo mis tarjetas, departamento, tipo (%/cuotas/reintegro), orden (relevancia, mayor %, distancia). Buscador "¿dónde vas a pagar?" que responde con qué tarjeta tuya conviene.
- **Mis tarjetas**: modal 2 pasos (fuente → productos opcionales), estado en localStorage, compartible por URL `?bancos=brou,santander`.
- **Comercio** `/comercio/[key]`: "hoy te conviene", beneficios por fuente, sucursales cercanas. **Beneficio** `/comercio/[key]/[fuente]`: ficha completa + cómo usarlo + letra chica + link a fuente oficial.
- **Comparador**: elegís rubros de gasto → ranking de fuentes por beneficios que te dan, links salientes con tracking (futura afiliación).
- Marca propia: misma estructura de tokens que manguito (base, -s, -ln, -ink, radios, display font + font para números) con paleta y tipografías distintas. **Aprobada 2026-09-02**: cielo `#0f6fd6` / menta `#0fae9c` / sol `#f7b500` + coral `#e8503a` para avisos, superficies hueso `#fbfaf6` / papel `#f2efe7`, texto tinta `#14202c` / humo `#6b7683`, línea `#e4e0d6`, gradiente cielo→menta→sol; tipografías Outfit (display), Inter (texto), Archivo tabular para números. Implementado en `apps/web/src/app/globals.css`. Logos oficiales de bancos con disclaimer y baja a pedido.
- Tono rioplatense (vos). Mobile first, bottom nav, PWA manifest.

## Stack
Monorepo pnpm: `apps/web` (Next.js 15 App Router, Tailwind, shadcn/ui, lucide, Leaflet + react-leaflet + markercluster, tiles CARTO/OSM), `packages/core` (schema Zod, tipos, normalizador), `packages/scrapers` (un módulo por fuente), `supabase/` (migraciones, PostGIS). Vercel Hobby + Supabase Free + PostHog free. Todo USD 0 salvo dominio y API de Claude (centavos/mes).

## Legal
Disclaimer "los beneficios pertenecen a sus fuentes", link a fuente oficial en cada beneficio, corregir/quitar a pedido, no scrapear zonas con login, respetar robots.txt. Inscribir base de datos de usuarios en URCDP cuando haya cuentas. Comparador solo con datos públicos verificables, sin recomendación financiera personalizada.

## Monetización (preparada, no activa)
Afiliación desde el comparador (links trackeados). Después: comercios destacados, publicidad.

## Hitos (tracer bullet, cada uno deployado)
1. Repo + monorepo + Supabase schema/PostGIS + tokens de diseño
2. Scraper BROU end-to-end con cron
3. Geocoding de sucursales
4. Mis tarjetas + pantalla split lista + mapa
5. Home + deploy Vercel + dominio
6. Fuentes Santander, Scotiabank, Itaú, OCA, Prex
7. Páginas comercio/beneficio SEO + sitemap + FAQ
8. Comparador data-driven
