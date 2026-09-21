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

### Frescura (F2; sube a F1 según conteo, ver Pendientes)
Responde "¿venció?" y "¿la página del banco quedó vieja?". Semáforo calculado por beneficio:
- **Verde**: vigencia futura, o la página cambió hace poco.
- **Amarillo**: sin `vigencia_hasta` y hash sin cambios hace > 180 días.
- **Rojo**: el texto (`legales_raw` / `contenido`) menciona una fecha de fin ya pasada y figura vigente; o `url_fuente` da 404 / redirige a la home.

Además: ranking de fuentes que dejan publicadas páginas con vigencia vencida (para desconfiar más de sus beneficios sin fecha). Acciones:
- **Ocultar** → regla por `(fuente_id, external_id)`; se levanta sola si la página cambia de hash.
- **Verificado hasta** → no vuelve a la lista por 90 días.

### Carga manual (F3)
Formulario que crea beneficios con `origen = 'manual'` pasando por el mismo schema Zod y guardas que `scrape ingerir`. `external_id` propio, así las bajas automáticas (que son por página de cada fuente) nunca los tocan. **`vigencia_hasta` obligatoria**, 60 días por defecto. Alerta "manuales por vencer" para renovar o dejar caer.

### Fusión de comercios (F3)
Unir dos `comercio` y dejar la regla en `comercio_alias` para las corridas siguientes.

### Fichas de tarjeta (F4, paralelizable: solo depende del auth)
- `producto_ficha`, **siempre manual**. Campos: costo anual, costo bonificado, ingreso mínimo, requisitos, tasa, programa de puntos/millas, seguros, salas VIP, link de solicitud.
- Imagen: **foto frente y dorso** en Supabase Storage, subida desde el backoffice; en la web, flip/tilt con CSS 3D. No modelos `.glb`.
- Carga inicial a mano (pocas decenas de tarjetas).
- Después: scraper de **sugerencias** solo desde los sitios oficiales de cada banco (no agregadores). Nunca escribe en la ficha: deja "Itaú Platinum: costo anual 4.200 → 4.800, ¿aceptar?". Mismo patrón que `beneficio_revision`.

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
| F4 | `producto_ficha (producto_id, …campos, imagen_frente, imagen_dorso, updated_at)`; `producto_ficha_sugerencia (producto_id, campo, valor_actual, valor_visto, url, estado)`; bucket `tarjetas`. |

Nombres tentativos; se cierran en cada issue.

## Fases
- **F1** — Auth + layout, dashboard de corridas, salud de datos, cola de revisión con alias.
- **F2** — Registro, inspector, novedades, auditoría, frescura, Telegram, tokens por corrida.
- **F3** — Carga manual, búsquedas sin resultado, fusión de comercios.
- **F4** — Fichas de tarjeta + Storage; luego scraper de sugerencias.

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
