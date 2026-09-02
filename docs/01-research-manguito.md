# Research: manguito.ar (relevado 2026-09-02)

Objetivo: entender a fondo el producto para replicarlo en Uruguay.

## 1. Qué es

Agregador de beneficios (descuentos, reintegros, cuotas) de bancos, billeteras, clubes, prepagas, gimnasios y supermercados de Argentina. Scrapea fuentes públicas (lo dicen en Términos), normaliza y muestra todo en un solo lugar, filtrado por "lo que usás" (banco + tipo de tarjeta, nunca número ni CVV).

Escala actual: **54.531 beneficios · 46 fuentes · 36.674 comercios · 18 rubros · 239 productos (tarjetas/segmentos)**.

## 2. Mapa de funcionalidades

### 2.1 Onboarding "Mis tarjetas" (core del producto)
- Modal "Elegí lo que usás" con buscador y secciones: **Bancos (21), Billeteras (10), Gimnasios (2), Clubes y membresías (3), Prepagas (3), Supermercados (5), Farmacias (1), Combustible (1)**.
- Al tocar un banco → segundo paso con checklist de productos: Visa Débito / Internacional / Gold / Platinum / Signature, Mastercard Internacional / Gold / … ("¿Cuáles de estas tenés? Es opcional"). Botones "Listo" y "Sacar este banco".
- Estado guardado en el dispositivo sin login (Supabase `signInAnonymously`); CTA "Iniciá sesión para no perderlas si cambiás de dispositivo".
- Mensaje de confianza repetido en toda la app: "El número se queda en tu billetera. Acá no lo cargás, no lo guardamos, no lo vemos" + botón "¿Por qué?".
- Tooltip de primer ingreso: "En menos de un minuto ves con qué tarjeta te conviene pagar hoy" (tour con driver.js).
- Header muestra badge con el logo del banco elegido en el botón "Mis tarjetas".

### 2.2 Home (`/`)
- Hero con contador vivo ("54.531 beneficios de 46 bancos…"), mosaico animado de logos (marquee), 2 CTAs (Seleccionar mis tarjetas / Ver mis beneficios) y buscador global.
- Sección **"Beneficios de hoy"** (cambia a "Tus beneficios de hoy" cuando tenés tarjetas): cards de comercio con logo, rubro, "HASTA 35% · 6 cuotas", badge "+11" (cantidad de fuentes extra).
- **"Explorá por rubro"**: 18 chips con contador por rubro.
- Carruseles por rubro (Gastronomía, Supermercados, Combustible, Viajes, Entretenimiento, Salud, Moda, Tecnología) con "Ver todo →".
- Bloque intercalado de conversión: "Elegí lo que usás y filtramos por vos" / "Mantené tus tarjetas al día".

### 2.3 Explorar (`/beneficios`)
- Buscador ("comercio, rubro o banco") + chip de fecha "Hoy".
- Sidebar de filtros (desktop) / drawer "Filtros" con contador (mobile):
  - Ordenar: Relevancia (= cantidad de fuentes) · Mayor descuento · Nombre A–Z
  - Toggles: **Solo con mis tarjetas** · **Ocultar vencidos**
  - Categoría (con contador de beneficios por rubro)
  - Fuente (banco/billetera) con contador y etiqueta "TUYA"; "Ver todas las fuentes (46)"
  - Cuándo: Hoy · Mañana · Elegir fecha · Todos los L M X J V S D
  - Tipo de descuento: % · 2x1 · Cuotas · Reintegro
- Grilla de **cards de comercio** (no de beneficio): logo, nombre, rubro, "HASTA 30% · 12 cuotas", chip verde "Para vos", corazón para guardar, avatar de la fuente.
- Estado en URL: `?cat=&bancos=&dias=&fecha=&mis=1&orden=&q=&tipo=&vencidos=&vista=` (compartible).
- Paginación por cursor (scroll infinito).

### 2.4 Cerca mío (`/cerca`) — el mapa
- Leaflet + tiles CARTO light (fallback OSM), sin controles de zoom nativos, botón "Centrar" flotante.
- Pide geolocalización; si falla muestra aviso y permite **buscar ciudad/barrio** (búsqueda local contra `/data/localidades.min.json`, sin geocoder externo) o **"Buscar en esta zona"** al mover el mapa.
- Marcadores custom: pin con logo del comercio + burbuja "25%" + badge "+3" (otras fuentes); clusters numerados; pins "tuyos" vs "otros" con estilos distintos.
- Popup del pin: lista de beneficios (banco, %, días, "Ver →"), "Cómo llegar" (Google Maps directions) y "Ver comercio →".
- Panel lateral: "Mostrando 43 de 11252", orden Por distancia / Mayor descuento, chips de rubro, toggle "Solo con mis tarjetas", selector "Tarjetas" (lista de fuentes con "TUYA"), lista de cards con **día que aplica + tope + distancia** ("Jueves · a 246 m", "tope $25.000").
- Aviso "Hay más comercios acá. Acercá o buscá de nuevo" cuando se pasa el límite de puntos.

### 2.5 Página de comercio (`/comercio/[key]`)
- Breadcrumb, botón "Copiar link", header "Coto · Supermercados · 89 beneficios de 22 tarjetas".
- Bloque **"HOY TE CONVIENE"**: qué tarjeta tuya aplica hoy y el mejor beneficio.
- Upsell contextual: "1 beneficio más de tus tarjetas pagando con MODO — La app es gratis, descargala".
- "Para vos, hoy" (fecha) → tus beneficios; luego **"Otros beneficios acá"**: una fila por fuente con resumen "Jue · Pagando con MODO (NFC) · Tope $12.000/sem · Solo en sucursales · 9 beneficios · HASTA 30%".
- "Publicado por Coto: 11 beneficios sin banco asociado" (promos propias del comercio).
- **"Los locales más cercanos · 8 de 637 en esta zona"** con dirección, barrio y distancia.
- Páginas especiales `/super/[slug]` (Coto, Jumbo, Disco, Vea, Carrefour, Día) server-rendered para SEO.

### 2.6 Detalle de beneficio (`/comercio/[key]/fuente/[fuente]`)
- "Banco Galicia en Coto · 6 beneficios", % grande, ficha: **Fuente (Ir al sitio) · Tope · Días · Vigencia · Nota · Acumulable · Tarjetas · Mecánica (QR/NFC) · Canal (sucursal/online) · Sucursales (126)**.
- "Cómo usarlo" en pasos numerados + "Letra chica" colapsable.
- Otras variantes del mismo banco en el comercio (6/12 cuotas).

### 2.7 Favoritos (`/guardados`), Perfil (`/cuenta`), Auth
- Favoritos por comercio (corazón en cualquier card), sincronizados con cuenta.
- Perfil: "Tu billetera" (editar tarjetas, "con tu tarjeta tenés 997 beneficios hoy"), Favoritos, Notificaciones (PRÓXIMAMENTE), Ubicación, Ayuda/FAQ, Escribinos, Crear cuenta / Ya tengo cuenta.
- Login: Google OAuth o email+contraseña (Supabase Auth).

### 2.8 Otros
- Buscador global ⌘K (custom).
- FAQ SEO larga (`/ayuda`): por rubro y por entidad.
- Términos y Privacidad muy claros sobre scraping de fuentes públicas y uso de marcas.
- Mobile: bottom-nav (Inicio · Explorar · Cerca mío · Favoritos · Perfil), PWA manifest (standalone).
- Contacto: "Me falta un banco", "Encontré un error" (mailto).
- Endpoints no usados aún en el front pero ya existen: búsqueda semántica y **"analyze-savings"** (subís un resumen de tarjeta y estima cuánto ahorrás).

## 3. Stack técnico (verificado)

| Capa | Qué usan | Evidencia |
|---|---|---|
| Frontend | **Next.js 14.2 App Router** (React 18), Webpack | headers `x-powered-by: Next.js`, chunks `/_next/static/chunks/app/*` |
| Hosting | **Vercel** (edge gru1) | `server: Vercel`, `x-vercel-id` |
| Estilos | **Tailwind v3**, tema custom, sin dark mode | vars `--tw-*`, breakpoints 640/768/1024 |
| Componentes | **No hay librería** (ni shadcn/Radix/MUI). Todo a mano con Tailwind | 0 hits de `data-radix`, `data-slot`, etc. |
| Íconos | **lucide-react** | `class="lucide lucide-heart"` |
| Tour onboarding | **driver.js** | CSS `.driver-popover` |
| Mapa | **Leaflet 1.9.4 + react-leaflet + leaflet.markercluster**, tiles **CARTO light_all** (fallback OSM) | chunks lazy, URLs de tiles |
| Geocoding | Ninguno externo: JSON local de localidades (185 KB) | `/data/localidades.min.json` |
| Backend | **FastAPI** ("Benefits API" v2.0.0) en `api.manguito.ar`, detrás de Cloudflare, cache `s-maxage=60` | `/openapi.json`, errores Pydantic |
| Auth + estado de usuario | **Supabase** (anon sign-in, Google OAuth, email) — tablas `profiles`, `favorites`, `favoritos_comercios`; storage `logos_fuentes` | `@supabase/ssr` |
| Analytics | **PostHog** (session replay, surveys) + Vercel Analytics | scripts |
| SEO | sitemap con 36.687 URLs (`/comercio/[key]`), FAQ, títulos por página; sin JSON-LD | sitemap.xml |
| Scraper | ~diario por proveedor (`last_fetched_at` en `/stats`) | endpoint `/stats` |

### 3.1 Design tokens (para replicar el look & feel)
- Paleta: `--verde #2fa84f`, `--amarillo #ffc233`, `--naranja #ff7a18` (Tailwind `naranja #f26419`), `--rojo #e8470b`, fondos `--crema #fffcf5` / `--papel #f7f4ed`, texto `--carbon #241c15`, secundario `--humo #7b6f60`, bordes `--linea #ece4d6`. Gradiente de marca verde→amarillo→naranja→rojo.
- Variantes por color: `-s` (soft bg), `-ln` (línea), `-ink` (texto). Extras: `chip-bg/bd/tx`, `hoy-bg`, `ok-bg`, `expired`, `muted`.
- Tipografía: **Bricolage Grotesque** (display/body, 400–800) + **Space Grotesk** para números (%/cuotas). Cargadas con `next/font/google`.
- Radios: ui 4 · container 6 · btn 12 · panel 16 · card 18 · hero 22 · pill 9999.
- Sombra "pop": `0 16px 40px -16px rgba(60,40,10,.45)`.
- Animaciones: fadeIn, fadeInUp, livePulse (punto verde del contador), marquee horizontal/vertical de logos.

### 3.2 API (contratos que vale la pena copiar)
- `GET /v2/home?dia=` · `/v2/benefits?q&providers[]&categorias[]&tarjeta&dias[]&tipo_descuento&sort&cursor&limit&vigentes&fecha` · `/v2/benefits/counts` · `/v2/merchants` · `/v2/merchant?key=` · `/v2/featured?categoria=` · `/v2/map/points?min_lat&max_lat&min_lng&max_lng&categorias&providers&zoom&limit` · `/v2/fuentes` · `/v2/productos` · `/v2/categorias` · `/v2/sitemap/merchants` · `/stats`.

### 3.3 Modelo de datos (inferido del OpenAPI)
- **Fuente** `{id, nombre, logo_url, rol: emisor|pasarela, tipo: banco|billetera|comercio|club|salud|gimnasio, activa, publica_como_comercio}`
- **Producto** (tarjeta/segmento) `{id, nombre, tipo: tarjeta|segmento|membresia|cuenta|plan, fuente_id, instrumento: credito|debito|saldo|prepaga, red: visa|mastercard|amex|cabal|propia, tier: gold|platinum|black|signature}`
- **Categoria** `{slug, label, orden, en_home}` (18)
- **Beneficio (Promo)** `{provider, id, titulo, descuento (texto), porcentaje_descuento, cuotas, comercio, categoria, vigencia_desde/hasta, dias (texto), dias_semana [1..7], tipo_descuento, localidades[], tarjetas[{nombre,tipo}], monto_tope, tope_periodo, mecanicas[] (nfc|qr|modo), canal (presencial|online), legales, como_usarlo[], imagen, url_detalle, fuentes[], acumulable, compra_minima, requiere_activacion, nota, nota_ia, sucursales[], productos_elegibles[], publicado_por, fetched_at}`
- **Comercio (MerchantCard)** `{comercio_key, comercio, categoria, imagen_url, best_pct, max_cuotas, n_beneficios, n_fuentes, fuentes[]}`
- **MapPoint** `{comercio_key, lat, lng, direccion, localidad, imagen_url, branch_count, n_benefits, benefits[]}`
- Hay campos `*_raw` + `nota_ia` → usan IA para normalizar el texto scrapeado (mecánica, tope, acumulable, etc.).

## 4. Biblioteca de componentes
No existe una librería pública ni open source: los componentes son propios (Tailwind + lucide). Lo replicable es el **sistema de tokens** (3.1) y el inventario de componentes observado:

`Header/BottomNav · CardSelectorModal (2 pasos) · ProviderTile · ProductChecklist · MerchantCard · BenefitRow (fila por fuente) · BenefitDetailSheet (ficha + cómo usarlo + letra chica) · CategoryChip (con contador) · FilterSidebar/FilterDrawer · DayPicker (L–D) · SortSelect · Toggle · SearchBar (⌘K palette) · HeroCounter (live dot) · LogoMarquee · MapView (pin con logo + % + cluster) · MapPopup · NearbyList · BranchList · ShareLinkButton · HeartButton · EmptyState · UpsellBanner (MODO) · OnboardingTour · FAQ accordion`.

Recomendación para Uruguay: usar **shadcn/ui** (Radix + Tailwind) como base y aplicar tokens equivalentes; ahorra todo lo que ellos hicieron a mano (Dialog, Sheet, Popover, Switch, Command).

## 5. Lo que hace bien / dónde está el valor
1. **Privacidad como mensaje central** (nunca pedimos el número) baja la fricción del onboarding.
2. **"Hoy" como eje**: todo se responde a "¿con qué pago hoy acá?".
3. **Normalización fuerte** (tope, días, canal, mecánica, acumulable) — es la parte más difícil y la que da valor.
4. **Mapa con "tuyos" vs "otros"** y distancia + día en la misma card.
5. SEO masivo por comercio (36k páginas) + FAQ por entidad.
6. Funciona sin cuenta; la cuenta solo sincroniza.

## 6. Riesgos / cosas a decidir para Uruguay
- Fuentes de datos: scraping de sitios públicos de bancos (legal en sus Términos, pero cada banco es un scraper distinto y se rompe).
- Volumen: Uruguay tiene ~10 bancos + OCA/Creditel/Prex/etc.; el valor está en la normalización y el mapa, no en 50k beneficios.
- Geocoding de sucursales (ellos parecen tener direcciones scrapeadas + coordenadas).
- Uso de marcas/logos de terceros.
