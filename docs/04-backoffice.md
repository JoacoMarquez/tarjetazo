# Tarjetazo — Backoffice (decisiones del grill-me, 2026-09-20)

## Qué es
Panel interno para un solo operador: ver si el pipeline anda, encontrar inconsistencias y beneficios faltantes o viejos sin revisar los ~1500 uno por uno, corregir por reglas y cargar las fichas de las tarjetas. No es un CMS de beneficios.

## Principios
1. **Lo scrapeado no se edita.** El upsert idempotente pisaría cualquier edición en la corrida siguiente. Toda corrección es una **regla** que el pipeline respeta (alias, ignorar, ocultar, verificado) o, si no alcanza, un **beneficio manual**.
2. **Al operador le llegan excepciones, no el catálogo.** Cola de revisión, alertas de salud, frescura y una muestra semanal para auditar.
3. **Push primero.** Resumen diario por Telegram *siempre*: si no llega, esa es la alerta. El dashboard es para diagnosticar después.
4. **Reglas en base conviven con reglas en código.** El código (`normalizador.ts`, `revision.ts`, `geo/cadenas.ts`) es la base versionada; las tablas de alias se aplican encima. Un alias estable se puede pasar a código.
5. Costo de API en el panel = **estimado** por tokens; la fuente de verdad sigue siendo el saldo real.

## Dónde vive y acceso
- Ruta `/admin` en `apps/web` (reusa shadcn, tipos de `core`, login Supabase existente). Usable desde el celular.
- Allowlist `ADMIN_EMAILS` (env var) verificada en middleware **y** en cada server action. Al resto: **404**, no 403.
- Escrituras con service role solo del lado del servidor. Sin RLS por rol.
- `corrida` pierde la policy de lectura pública; revisar que `beneficio_revision` tampoco la tenga (el `raw` y los errores son material interno, como ya lo es `pagina_cruda`).

## Flujo de carga de beneficios
Dos caminos. El operador nunca carga el catálogo: toca las excepciones y lo que ninguna fuente publica.

### Camino 1 — automático (casi todo; ya funciona así)
```
06:00 cron → descubre URLs → baja página → ¿cambió el hash?
                                             ├─ no → nada (gratis)
                                             └─ sí → normaliza (Claude o parser) → valida Zod
                                                        ├─ válido y tarjetas mapeadas → upsert en `beneficio` → visible en la web
                                                        └─ no valida / tarjeta desconocida → `beneficio_revision` (cola)
```
Si la fuente deja de publicar una página, el cron marca el beneficio `descartado`. El backoffice no interviene en este camino; el operador actúa cuando llega el Telegram:
- **Ítems en la cola** → **Asignar tarjeta**: se guarda el alias, se revalidan todos los ítems con ese motivo y entran solos a `beneficio`; ese nombre no vuelve a pasar por la cola. Si es basura: **Descartar** o **Ignorar siempre**.
- **Algo se normalizó mal** → inspector → **re-normalizar**. Si se repite, es un bug del scraper y se arregla en código.

### Camino 2 — manual (lo que ninguna fuente scrapeada publica)
1. `/admin/beneficios/nuevo`.
2. Comercio por autocomplete sobre los existentes; si no está, se crea ahí mismo (nombre + rubro).
3. Formulario: fuente y tarjetas elegibles, tipo y porcentaje, días, tope, canal, **vigencia hasta** (obligatoria, 60 días por defecto), link o nota de dónde se vio.
4. Pasa por el mismo schema Zod que el pipeline, queda con `origen = 'manual'` y aparece en la web al instante.
5. El cron nunca lo toca: no pertenece a ninguna página scrapeada.
6. Días antes de vencer aparece en "manuales por vencer": se extiende o se deja caer.

Si después el banco lo publica y el scraper lo levanta, Salud de datos marca el duplicado (mismo comercio, fuente y porcentaje) y se borra el manual.

Carga en lote: sigue por CLI con `scrape ingerir <json>` (supuesto; no hay subida de JSON/CSV desde la UI).

### Cuando falta un beneficio
| Situación | Qué se hace |
|---|---|
| La fuente lo publica pero no está en la web | Inspector / Salud de datos ("página con 0 tramos", "URL descubierta sin normalizar") → re-normalizar o arreglar el scraper. **No se carga a mano**: taparía el bug. |
| Ninguna fuente scrapeada lo publica | Carga manual (camino 2). |
| Falta un banco entero | Scraper nuevo en `packages/scrapers/src/fuentes/`. |

### Glosario
- **Hash**: huella digital del texto de una página. Si coincide con la de ayer, la página no cambió y no se reprocesa (no cuesta nada). "Re-normalizar" borra el hash guardado; "Ocultar" se levanta cuando el hash cambia; un hash sin cambios hace meses sugiere página vieja.
- **Zod**: control de calidad antes de guardar. Define la forma de un beneficio válido (porcentaje entre 1 y 100, fechas coherentes, tipo permitido). Detecta datos imposibles, no datos equivocados pero posibles (25% donde decía 20%): para eso está la auditoría por muestreo.

## Pantallas

### Dashboard de corridas (F1)
Tabla fuente × últimas N corridas con las columnas de `corrida` (páginas, sin cambios, nuevos, actualizados, vencidos, a revisar, error, duración). Marca corridas abiertas/trabadas y fuentes que no corrieron anoche. Contadores: cola de revisión pendiente, alertas abiertas, manuales por vencer.

### Salud de datos (F1)
Todo SQL sobre lo existente:
- URLs descubiertas vs normalizadas por fuente; páginas con 0 tramos.
- Salto/caída > X% de beneficios de una fuente vs la corrida anterior.
- Inconsistencias: porcentaje > 60; vencido pero visible; sin productos elegibles en fuente que siempre restringe; comercio sin rubro o sin sucursal; nombres de comercio casi iguales (`Farmashop` / `Farma Shop`).
- Geocoding: sucursales sin coordenadas, por precisión, estado del cache.
- (F3) Búsquedas de usuarios sin resultado — la mejor señal de comercio faltante.

### Cola de revisión (F1)
Ítems de `beneficio_revision` agrupados por motivo. Cuatro acciones:
1. **Asignar tarjeta** → crea `producto_alias` y revalida todos los ítems con el mismo motivo.
2. **Descartar**.
3. **Ignorar siempre** → regla para que ese patrón no vuelva a la cola.
4. **Abrir en inspector**.

No hay "editar JSON y aprobar". Si un ítem no se resuelve con alias, es un bug del scraper o un caso de carga manual.

Cómo quedó implementado (#16):
- Una página con una tarjeta desconocida **igual publica sus beneficios**, sin esa tarjeta. Por eso *Asignar tarjeta* además pone `pagina_cruda.hash = ''` en las páginas afectadas: la próxima corrida las re-normaliza con el alias (una llamada al modelo por página). Revalidar la cola sola no corrige el beneficio.
- La cola se agrupa por problema y fuente, no por fila. Una fila queda resuelta cuando todos sus problemas están cubiertos por un alias, una regla de ignorar o `beneficio_revision.descartados` (descartes a mano, sin regla).
- `producto_alias` y `regla_ignorar` matchean por texto exacto normalizado (`normalizarNombreTarjeta` de `@tarjetazo/core`) y van **antes** que los regex de `normalizador.ts`. Un alias puede apuntar a varias tarjetas.
- Los errores de validación de un tramo ("tramo N: …") solo se pueden descartar.
- Al re-normalizar una página, el runner da por resueltas sus filas viejas y encola de nuevo lo que siga sin resolverse: no se acumulan duplicados.
- Si las tablas de reglas no existen todavía, el runner avisa y sigue solo con las reglas de código.
- La página se identifica por `(fuente_id, external_id)`, nunca por URL: Itaú publica 247 beneficios bajo 2 URLs. La cola guarda `external_id`; el cierre de ítems y la re-normalización van por esa clave.
- Los problemas de una fila se leen de `raw.problemas`; `motivo` es un resumen cortado a 500 caracteres y solo sirve de respaldo.
- Las reglas actúan en `mapearProductos`. Los normalizadores propios (BBVA) no pasan por ahí, pero tampoco mandan nombres de tarjeta a la cola, así que no hay nada a lo que ponerle un alias. Si un parser propio empieza a informar desconocidos, tiene que delegar en `mapearProductos`.

### Registro de beneficios (F2)
Tabla filtrable del **estado actual** de `beneficio` (fuente, comercio, tipo, vigencia, `estado_revision`, origen, semáforo de frescura) con link al inspector y a la URL de la fuente. Sin historial de cambios.

### Inspector de página (F2)
Texto de `pagina_cruda` lado a lado con los tramos normalizados. Botón **re-normalizar** (invalida el hash para que la próxima corrida la vuelva a procesar).

### Novedades de anoche (F2)
Beneficios nuevos, modificados y dados de baja por la última corrida de cada fuente. Requiere `corrida_id` en `beneficio`.

### Auditoría por muestreo (F2)
10 beneficios por semana, vista lado a lado del inspector, ✓ / ✗. Muestra ponderada hacia fuentes nuevas, páginas que cambiaron hace poco y porcentajes altos; casi nada para fuentes con parser determinista (BBVA). Resultado: **precisión estimada por fuente**. Un ✗ no edita: abre el inspector o deja anotado el bug. Un segundo modelo como auditor queda descartado hasta que este número diga que hace falta.

### Frescura (F2, recortada en el grill del 2026-09-23)
Responde "¿la página del banco quedó vieja?" para los beneficios sin `vigencia_hasta` (480, 439 de Santander). Lo que había en el diseño original y se descartó con datos: el detector de fechas en el texto (3 casos en 480) y el chequeo de links (el fetch diario ya da de baja las páginas que desaparecen; Itaú, Scotiabank y OCA comparten URLs).

- `pagina_cruda.hash_desde`: desde cuándo la página tiene ese hash. Arranca de cero (el backfill de `normalizada_en` fue el 21/9): la señal sirve recién a los ~6 meses.
- Semáforo por beneficio: **verde** con vigencia futura o página cambiada hace poco; **amarillo** sin `vigencia_hasta` y hash sin cambios hace > 180 días (a recalibrar); **rojo** reservado para señales que hoy no hay.
- Se ve como sección en Salud de datos y como columna + filtro en el registro de beneficios.
- **Ocultar** = `estado_revision = 'oculto'`: la web ya filtra por `ok`; cuando la página cambia, el runner re-normaliza y vuelve a `ok`.
- **Verificado hasta** = `beneficio.verificado_hasta` (90 días por defecto): no vuelve a la lista hasta esa fecha.
- Telegram avisa solo rojos nuevos.

### Carga manual (F3)
Formulario que crea beneficios con `origen = 'manual'` pasando por el mismo schema Zod y guardas que `scrape ingerir`. `external_id` propio, así las bajas automáticas (que son por página de cada fuente) nunca los tocan. **`vigencia_hasta` obligatoria**, 60 días por defecto. Alerta "manuales por vencer" para renovar o dejar caer.

### Fusión de comercios (F3)
Unir dos `comercio` y dejar la regla en `comercio_alias` para las corridas siguientes.

### Catálogo de tarjetas (#40, grill del 2026-09-22)
- `producto` = **un plástico** (red + tier), con `familia` que agrupa los packs (Pack Trilogy Select = Visa Infinite + Mastercard Black, dos filas). Los beneficios apuntan a plásticos; la ficha, la foto y la elección del usuario son por familia.
- Ids actuales se conservan; los genéricos sin producto real pasan a `activo = false` con un mapa viejo → nuevo que migra beneficios y la billetera del usuario.
- El scraper mapea tiers por red + tier ("infinite" → productos de la fuente con Visa Infinite) y productos por nombre. Tiers nuevos: `infinite`, `world`, `world_elite`.
- Piloto Santander desde su sitio oficial; el resto llega por #27. El catálogo sigue en código hasta #26/#27.

### Fichas de tarjeta (F4, grill del 2026-09-23)
Sondeo: Santander, BROU y BBVA publican el catálogo server-rendered con datos; Itaú casi sin datos estructurados; OCA y Prex con JavaScript; Scotiabank sin verificar. No hay formato común: cada banco es un scraper.

- **Alcance**: scraper de catálogo para Santander, BROU y BBVA. Los demás (3 a 8 tarjetas cada uno) se cargan a mano en la bandeja.
- **Extracción**: nombre, red, tier, imagen y URL oficial determinista; los campos de la ficha con Claude desde el texto de la página oficial, una vez por tarjeta y cuando cambie el hash.
- **Campos de la ficha**: costo anual (pesos o UI), costo bonificado y condición, ingreso mínimo, requisitos, tasa, puntos/millas, seguros, salas VIP, link de solicitud, "otros" libre.
- **Todo es sugerencia** (`producto_ficha_sugerencia`), también la imagen: el scraper nunca escribe en `producto_ficha`. La carga inicial se acepta en bloque. Al aceptar, la imagen se baja del banco a Storage (bucket `tarjetas`); subida manual para lo que el banco no publica. Solo frente; sin dorso genérico.
- **Catálogo híbrido**: ids, red, tier y familia siguen en código; ficha, imagen y `activo` en la base. Una tarjeta nueva es una sugerencia de alta que se agrega en código.
- **Cadencia**: `catalogo.yml` semanal (lunes). "Revisar ahora" es un link a Actions; el backoffice muestra la última revisión. Corporativas, pymes y agro se descartan por nombre.
- Orden: #27 → #26. La página pública `/tarjeta/[id]` sigue aparte (#11).
- **Bandeja (#26)** en `/admin/tarjetas`: sugerencias por familia con aceptar/ignorar por fila, por familia o todas (carga inicial). Aceptar es un upsert parcial de `producto_ficha`; la foto se baja con headers de navegador (BBVA da 403 a otros clientes, y sin AVIF en el Accept) al bucket público `tarjetas` como `<familia>/frente-<hash>.<ext>`. Un valor que no encaja con su columna o una foto que no baja quedan pendientes. Las altas no se aceptan en la base: la bandeja da la línea para `PRODUCTOS` y se marcan "ya la agregué". La ficha (`/admin/tarjetas/<familia>`) edita todo, sube frente y dorso recortados en el navegador a proporción ID-1, y muestra la vista previa con `Tarjeta3D` (la misma que usará #11). Subir una foto a mano no toca `imagen_origen`: el banco solo se vuelve a sugerir si cambia su foto.

### Auditoría del catálogo (2026-09-25)
Los 79 productos del catálogo semilla se verificaron contra el sitio oficial de cada banco. La migración `20261020120000_catalogo_auditado.sql` aplica el resultado.

- **Bajas** (`activo = false`, nunca se borran): tarjetas que el banco no emite (Amex Santander, BROU Visa Black, Scotiabank Visa Gold y Visa Signature, Itaú Visa Signature, BBVA Visa Platinum) y un duplicado (`itau-debito`).
- **Lo que no es un plástico** también se da de baja y pasa a su plástico real: OCA Blue, la cuenta, pasa a su Visa Débito; U25 y Pocket pasan a la Visa Débito Volar. `itau-personal-bank` pasa a ser la familia de las tres Infinite de Itaú, y su ficha sigue sirviendo.
- **Saldo y TuApp:** `prex-saldo` y `brou-tuapp` quedan como medios de pago con instrumento `saldo`. Se pueden elegir en "mis tarjetas", pero no van a `/tarjetas`, no tienen `/tarjeta/[id]` y no entran en el sitemap (`FAMILIAS_TARJETA`).
- **Mapa viejo → nuevo:** vive en `EQUIVALENCIAS_PRODUCTO` (@tarjetazo/core) y lo usan tres cosas:
  - la migración, sobre `beneficio.productos_elegibles` y `producto_alias.producto_ids`;
  - la billetera guardada en localStorage;
  - los links con `?productos=`.
- **Listas que quedarían vacías:** si al quitar un id sin equivalente la lista queda vacía, no se escribe. Vacío es "todas las de la fuente", así que la fila queda como estaba y se revisa a mano. Al 2026-09-25 no había ningún caso.
- **Altas:** los clubes de BBVA se cargan como una fila por nivel. Cada nivel es su propia familia, igual que Soy y Soy Platinum.
- **Sin tocar:** los productos dudosos (Farmacard e Hipermás sin red publicada, AAdvantage sin tier confirmado, Itaú Débito Sueldos).

### Bajas del catálogo (después de la auditoría)
Para que no vuelva a colarse una tarjeta fantasma (`20261022120000_catalogo_bajas.sql`):
- **Sugerencia de baja:** el scraper de catálogo guarda qué familias dio cada página (`catalogo_pagina.familias`). Si una familia que se veía no aparece en una revisión **completa** de la fuente (sin `--limite`, sin páginas fallidas y sin una página que antes tenía tarjetas y ahora ninguna), deja una sugerencia `tipo = 'baja'`, una por familia. Solo cuenta lo que se vio alguna vez: TuApp o las tarjetas que viven en páginas que no se leen nunca se proponen.
- **Nunca se aplica sola:** en `/admin/tarjetas` se confirma en el sitio del banco, se da de baja en código (`activo: false` en `PRODUCTOS` y una migración que pase los beneficios, como la de la auditoría) y se marca «Ya la di de baja». Si la familia vuelve a aparecer, la sugerencia pendiente se borra.
- **Primera revisión:** las páginas extraídas antes de la columna no tienen familias y se vuelven a extraer una vez (unas 25 páginas). Esa revisión no propone bajas.
- **Salud:** «Tarjetas sin página oficial» lista los productos activos sin `url_oficial`. Es accionable: se confirma que la tarjeta existe y se carga la url, o se la da de baja.

## Resumen diario por Telegram (F2)
Paso final de `.github/workflows/scrapers.yml`. Una línea por fuente (ok / error, nuevos, bajas), cola de revisión, alertas de salud y frescura nuevas, manuales por vencer, link a `/admin`. Secrets nuevos: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.

## Cambios de schema
| Fase | Cambio |
|---|---|
| F1 | Quitar policy de lectura pública de `corrida` (y de `beneficio_revision` si la tiene). |
| F1 | `producto_alias (fuente_id, texto, producto_ids[])`; `regla_ignorar (fuente_id, texto)`; `beneficio_revision.descartados text[]`. El runner lee las dos tablas al arrancar. |
| F2 | `beneficio.corrida_id`; `corrida.tokens_entrada`, `corrida.tokens_salida`. |
| F2 | `pagina_cruda.hash_desde`; `pagina_cruda.http_status` (o tabla de chequeo de links). |
| F2 | `regla_ocultar (fuente_id, external_id, hash_al_ocultar)`; `verificacion (beneficio_id, verificado_hasta)`. |
| F2 | `auditoria (beneficio_id, semana, resultado, nota)`. |
| F3 | `beneficio.origen` (`scraper` \| `manual`); `comercio_alias (alias_key → comercio_key)`; `busqueda_sin_resultado (q, filtros, created_at)`. |
| F4 | Rediseño de `producto` (#40); `producto_ficha (producto_id, …campos, imagen_frente, imagen_dorso, updated_at)`; `producto_ficha_sugerencia (producto_id | null, campo, valor_actual, valor_visto, url, imagen_url, estado)`; bucket `tarjetas`. |

Nombres tentativos; se cierran en cada issue.

## Fases
- **F1** — Auth + layout, dashboard de corridas, salud de datos, cola de revisión con alias.
- **F2** — Registro, inspector, novedades, auditoría, frescura, Telegram, tokens por corrida.
- **F3** — Carga manual, búsquedas sin resultado, fusión de comercios.
- **F4** — Rediseño del catálogo (#40) → scraper de catálogo por banco a sugerencias (#27) → bandeja de aceptar + ficha y Storage (#26).

## Fuera de este proyecto
- Issues de la web pública: página `/tarjeta/[id]`; "Actualizado: <último fetch OK>" y aviso "sin fecha de fin publicada, confirmá en el local" en cada beneficio.
- Para después: corrección de pines en mapa, catálogo (fuentes activas, orden de rubros, `en_home`), reportes de usuarios ("este beneficio está mal"), disparar/destrabar corridas desde la UI (`workflow_dispatch`), segundo modelo como auditor, historial de cambios de beneficios, señal "comercio en 3+ fuentes pero no en una grande".

## Pendientes
- Conteo de beneficios sin `vigencia_hasta` por fuente. **Si son mayoría, Frescura (`hash_desde` + regex de fechas) pasa de F2 a F1.**
  ```sql
  select fuente_id,
         count(*) filter (where vigencia_hasta is null) as sin_fin,
         count(*) as total
  from beneficio
  where estado_revision <> 'descartado'
  group by 1 order by 2 desc;
  ```
- Umbrales a calibrar con datos reales: X% de salto entre corridas, 180 días de hash, 60% de porcentaje máximo.
