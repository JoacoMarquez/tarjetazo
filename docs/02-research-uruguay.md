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
