# Research: mercado uruguayo de beneficios por tarjeta (2026-09-02)

## Resumen ejecutivo
- **Ninguna entidad uruguaya expone API pública**; hay que scrapear HTML. Las más estructuradas: BROU (URLs predecibles + filtros por medio de pago/departamento), Santander (rubro/departamento), OCA (filtros + listado "Tiendas de tu ciudad" con direcciones), Midinero (`?depto=`), y los WordPress (ANDA, Club El País, la diaria) que casi seguro exponen `/wp-json/`.
- **Casi nadie publica direcciones por comercio**; el único mapa nativo es Nativa Cabal. El diferencial (igual que manguito) es geocodificar y cruzar con OSM/Google Places.
- **Competidor directo: Bankos** (bankos.uy, app iOS/Android, lanzada oct-2025, +20k descargas, ~2.500 MAU, monetiza a comercios desde USD 70/mes, scraping propio + Google Maps + IA). DonDescuento UY parece abandonada. El resto son blogs sin mapa (descuento.uy, uruguaydescuentos.com).
- **Referencia open source**: UruguayAPI (github.com/AFornio/UruguayAPI, Rails) ya scrapea Santander, BROU y Scotiabank.
- **Geocoding**: servicio oficial gratuito sin API key en https://direcciones.ide.uy (Swagger en /swagger-ui.html) + CSV de direcciones por departamento en catalogodatos.gub.uy. Localidades INE 2023 (652 polígonos) para el buscador de ciudad tipo manguito.

## Fuentes (bancos)
| Entidad | URL | Público | Notas |
|---|---|---|---|
| Itaú | itau.com.uy/inst/beneficios.html (+ restaurantes, moda, beneficiosexclusivos) | Sí | HTML estático por rubro, ~150 locales sin direcciones |
| Santander | santander.com.uy/beneficios | Sí | Filtros medio de pago / 14 deptos / 13 rubros, "cargar más" (XHR probable), +200 comercios |
| BROU | beneficios.brou.com.uy/beneficios | Sí | 13 categorías, 19 deptos, medio de pago (Débito, Crédito, MI BROU, TuApp), detalle con tope/días/T&C |
| Scotiabank | scotiabank.com.uy/Personas/Tarjetas/Beneficios | Sí | +300 beneficios, sección "¿Dónde usar?" (posibles locales) |
| BBVA | bbva.com.uy/personas/productos/tarjetas/descuentos.html | Sí (403 a bots) | +300 comercios, subpáginas por rubro y comercio |
| HSBC → BTG Pactual | btgpactual.uy | Parcial | Sin listado público aún |
| Heritage | — | No | Sin programa propio |
| Bandes | bandes.com.uy/personas/tarjetas/beneficios-cabal | Sí | 7 beneficios; el resto vía Cabal |
| Citi | — | — | No opera retail en UY |

## Emisores / marcas
| Entidad | URL | Notas |
|---|---|---|
| OCA / OCA Blue | oca.uy/beneficios.html, oca.uy/tiendas-de-tu-ciudad/ | Filtros producto/medio/día/%/depto; listado con **direcciones** |
| Creditel | creditel.com.uy/promociones-descuentos | Promocional, sin listado |
| Visa UY | visa.com.uy/es_UY/promociones/ | Regionales, pocas locales |
| Mastercard | latam.mastercard.com (LAC) | Sin página UY |
| ANDA | anda.com.uy/categoria/dias-de-descuentos/ | WordPress, filtros depto/localidad, ~64 beneficios |
| PassCard | passcard.com.uy/tarjeta/promociones | Esquema por día de semana |
| Cabal / Nativa Cabal | nativacabal.com.uy/beneficios/ | +100 beneficios, **mapa por departamento** |
| Tarjeta Verde (ex FUCAC/Lider) | — | Sin listado público |

## Billeteras
| Entidad | URL | Notas |
|---|---|---|
| Prex | prexcard.com/beneficios | ~18 activos, mayormente online |
| Mercado Pago | mercadopago.com.uy/mp/promociones | 403 a bots, promos in-app |
| Midinero (Redpagos) | midinero.com.uy/beneficios/?depto= | 19 deptos, 10 categorías |
| Abitab (Abis) | abitab.com.uy/.../descuentos | 403 a bots |
| TuApp | beneficios.brou.com.uy/medios_de_pago/tuapp | 8 beneficios |
| Paganza / Ualá | — | Sin programa / no opera |

## Clubes, medios, telcos, otros
Club El País (WordPress, +200 marcas, /comercio/{slug}), la diaria Beneficios (WordPress), Comunidad Plus (Ta-Ta, app), Tienda Inglesa Club Card, Antel (~4), Club Movistar (solo app), Claro Club (2x1 cine), Tarjeta Dorada IM (PDF, +65). Mutualistas (Española, CASMU, Médica, SMI): sin programa comercial.

## Legal
- Ley 18.331 art. 9: datos de fuentes públicas no requieren consentimiento. Inscribir base en URCDP para datos de usuarios; nunca pedir números de tarjeta.
- Ley 17.011 marcas: uso nominativo de logos es práctica corriente; agregar disclaimer.
- BBVA, MP, Abitab bloquean bots (403) → headless browser o carga manual.

## Geodatos
- direcciones.ide.uy (REST oficial, sin key) · catalogodatos.gub.uy/dataset/ide-direcciones-geograficas-del-uruguay (CSV mensual)
- INE localidades 2023 · ckan.montevideo.gub.uy (barrios, calles) · github.com/vierja/geojson_montevideo
- Nominatim (1 req/s), Photon (self-host), LocationIQ (free tier)

## Censo de fuentes y emisores (medido el 2026-09-06)

Cruce de dos censos externos —el menú "Bancos y emisores" de tarjetasdecredito.com.uy
(comparador de tarjetas, no de beneficios) y la lista "Bancos y financieras" de bankos.uy
(competidor directo)— con mediciones propias de cada sitio. Sirve para decidir el orden
de las fuentes v2 y para sembrar el catálogo de productos cuando entren.

**Bankos cubre 10**: BROU, BBVA, Itaú, Scotiabank, Santander, OCA, Club El País, ANDA,
Mercado Pago y Prex. Tarjetazo tiene 5 en producción (6 con Prex, listo en rama).

| Fuente | Tipo | Bankos | Tamaño medido | Cómo publica | Esfuerzo |
|---|---|---|---|---|---|
| BROU, Santander, Itaú, OCA, Scotiabank | | ✓ | **hechas** (1.607 beneficios) | ver README | — |
| Prex | billetera | ✓ | 15 promos, 3-4 son beneficios de comercio | `www.prexcard.com/beneficios` → `/beneficiosprex?beneficio=<id>`; el host sin `www` redirige a la home | hecho, sin correr |
| **BBVA** | banco | ✓ | **~290 comercios** (10 páginas × 29 fichas) | `bbva.com.uy/personas/productos/tarjetas/descuentos.html`, paginado `.pag-N.html`, ficha por comercio; ya no da 403 con UA de navegador | bajo (como Santander) |
| **Nativa Cabal** | red (Bandes, Líder, Tarjeta D y otros) | — | **188 beneficios** | `nativacabal.com.uy/beneficios/`, server-rendered, filtros por departamento en el hash; sin coordenadas | bajo |
| Midinero (Redpagos) | billetera | — | 33 beneficios | `midinero.com.uy/beneficios-sitemap.xml` + ficha por beneficio | bajo |
| ANDA | emisor | ✓ | ~64 (dato de la investigación inicial) | WordPress; `/wp-json` responde 401 | medio (HTML) |
| Club El País | club | ✓ | 200+ marcas (dato inicial) | WordPress; el tipo `producto` de la API tiene 9 entradas, el catálogo está en HTML | medio |
| Mercado Pago | billetera | ✓ | in-app | 403 a bots, promos dentro de la app | inviable sin app |
| PassCard | emisor | — | ? | `passcard.com.uy` no respondió | por medir |
| Pronto+, Créditos Directos, Crédito de Valor, ASI | financieras | — | sin medir | probablemente pocos beneficios propios | por medir |
| Italmundo, Tarjeta D, Líder, Tarjeta Verde | emisores chicos | — | sin medir | varios operan sobre la red Cabal | por medir |
| Creditel | financiera | — | promocional | sin listado | bajo valor |
| TuApp, Bandes | | — | 8 y 7 | vía BROU y vía Cabal | bajo valor |
| Diners, Payoneer, HSBC→BTG, Heritage | | — | — | sin programa local público | — |

**Orden propuesto para v2**: BBVA → Nativa Cabal → Midinero → Club El País → ANDA. Con
BBVA se iguala la cobertura de bancos de Bankos; Nativa Cabal y Midinero no los tiene nadie.

**Costo de entrada**: el backfill de una fuente cuesta ~USD 0,013-0,016 por página
normalizada (medido en Itaú y Scotiabank); BBVA serían ~USD 4-5 una vez. En régimen el
cron reprocesa solo lo que cambia (el 2026-09-06: 1 página de 725).

### Tarjetas vistas por emisor (para sembrar `packages/core/src/fuentes.ts`)

Nombres tal como los publica cada emisor; los que ya están en el catálogo se omiten.

- **BBVA**: Visa Débito BBVA, Visa Infinite BBVA (más Visa clásica/Gold/Platinum y
  Mastercard, a confirmar en su listado).
- **OCA**: Visa de OCA, OCA Blue (débito y crédito) — ya en catálogo.
- **PassCard**: Passcard, Passcard Experta.
- **Italmundo**: Italmundo Platino.
- **Nativa Cabal**: red Cabal; emisores que la usan: Bandes, Líder, Tarjeta D, ANDA (parcial).
- **Pronto+, Créditos Directos, Crédito de Valor, ASI, Creditel**: tarjetas de crédito de
  financieras, típicamente Mastercard o Visa clásicas.
- **Midinero**: prepaga Mastercard (Redpagos).
- **Redes**: Visa, Mastercard, American Express, Maestro, Diners Club, Cabal.
