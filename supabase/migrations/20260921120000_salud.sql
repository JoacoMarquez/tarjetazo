-- Chequeos de salud de datos para el backoffice (/admin/salud) y, más
-- adelante, el resumen diario. Van como funciones para poder reusarlos desde
-- los dos lados. Solo los llama la service role: leen `pagina_cruda` y
-- beneficios que no están publicados.

-- ------------------------------------------------------------ páginas
-- Una página "sin beneficios" es una que bajamos pero de la que no salió ningún
-- tramo ni quedó nada en la cola de revisión: o no era un beneficio, o el
-- normalizador no entendió nada. No se usa `normalizada_en` porque el runner
-- lo pisa con null cada vez que la página llega sin cambios; el vínculo firme
-- es el id del beneficio (`fuente:external_id:n`).
create or replace function salud_paginas_vacias (p_limite int default 200)
returns table (fuente_id text, external_id text, url_fuente text, fetched_at timestamptz)
language sql stable as $$
  select p.fuente_id, p.external_id, p.url_fuente, p.fetched_at
    from pagina_cruda p
   where not exists (
           select 1 from beneficio b
            where b.fuente_id = p.fuente_id
              and starts_with(b.id, p.fuente_id || ':' || p.external_id || ':'))
     and not exists (
           select 1 from beneficio_revision r
            where r.fuente_id = p.fuente_id
              and r.url_fuente = p.url_fuente
              and not r.resuelto)
   order by p.fuente_id, p.fetched_at desc
   limit p_limite;
$$;

create or replace function salud_paginas ()
returns table (fuente_id text, paginas bigint, con_beneficios bigint, sin_beneficios bigint)
language sql stable as $$
  with vacias as (select v.fuente_id, count(*) as n from salud_paginas_vacias(100000) v group by 1)
  select p.fuente_id,
         count(*)                              as paginas,
         count(*) - coalesce(max(v.n), 0)      as con_beneficios,
         coalesce(max(v.n), 0)                 as sin_beneficios
    from pagina_cruda p
    left join vacias v using (fuente_id)
   group by p.fuente_id
   order by p.fuente_id;
$$;

-- ------------------------------------------------------------ saltos
-- Compara las dos últimas corridas cerradas sin error de cada fuente. No hay
-- historial de cuántos beneficios tenía una fuente, así que las señales son:
-- cuánto cambió la cantidad de páginas que trajo el fetch, y qué parte del
-- catálogo activo dio de baja la última corrida. Ojo: una corrida manual con
-- `--limite` trae pocas páginas y aparece como caída.
create or replace function salud_saltos (p_umbral numeric default 20)
returns table (
  fuente_id text, corrida_id uuid, empezo_en timestamptz,
  paginas int, paginas_anterior int, variacion_paginas_pct numeric,
  nuevos int, vencidos int, activos bigint, bajas_pct numeric, alerta boolean)
language sql stable as $$
  with cerradas as (
    select c.*, row_number() over (partition by c.fuente_id order by c.empezo_en desc) as n
      from corrida c
     where c.termino_en is not null and c.error is null
  ), activos as (
    select b.fuente_id, count(*) as n from beneficio b where b.estado_revision = 'ok' group by 1
  ), par as (
    select u.fuente_id, u.id, u.empezo_en, u.paginas, a.paginas as paginas_anterior,
           u.nuevos, u.vencidos, coalesce(ac.n, 0) as activos
      from cerradas u
      left join cerradas a on a.fuente_id = u.fuente_id and a.n = 2
      left join activos ac on ac.fuente_id = u.fuente_id
     where u.n = 1
  ), calc as (
    select par.*,
           case when paginas_anterior > 0
                then round(100.0 * (paginas - paginas_anterior) / paginas_anterior, 1) end as variacion,
           case when activos + vencidos > 0
                then round(100.0 * vencidos / (activos + vencidos), 1) end as bajas
      from par
  )
  select fuente_id, id, empezo_en, paginas, paginas_anterior, variacion,
         nuevos, vencidos, activos, bajas,
         coalesce(abs(variacion) >= p_umbral, false) or coalesce(bajas >= p_umbral, false)
    from calc
   order by fuente_id;
$$;

-- ------------------------------------------------------------ inconsistencias
-- Una fila por hallazgo. `tipo`:
--   porcentaje_alto       más de p_pct_max % (casi siempre un tope leído como porcentaje)
--   vencido_publicado     venció y sigue 'ok': la fuente dejó la página arriba
--   derivados_desfasados  el comercio muestra best_pct / conteos que ya no salen
--                         de sus beneficios vigentes (nadie recalcula cuando un
--                         beneficio vence sin que cambie la fila)
--   sin_productos         no restringe tarjetas en una fuente que casi siempre lo hace
--   comercio_en_otros     cayó al rubro comodín
create or replace function salud_inconsistencias (p_pct_max numeric default 60, p_limite int default 500)
returns table (tipo text, fuente_id text, beneficio_id text, comercio_key text, comercio text, detalle text, url_fuente text)
language sql stable as $$
  with restringe as (
    select b.fuente_id
      from beneficio b
     where b.estado_revision = 'ok'
     group by 1
    having count(*) >= 20
       and avg((cardinality(b.productos_elegibles) > 0)::int) >= 0.9
  ), reales as (
    select b.comercio_key,
           max(b.porcentaje) as best_pct, max(b.cuotas) as max_cuotas, count(*) as n
      from beneficio b
     where b.estado_revision = 'ok' and beneficio_vigente(b)
     group by 1
  ), todo as (
    select 'porcentaje_alto' as tipo, b.fuente_id, b.id, b.comercio_key,
           b.porcentaje::text || ' % — ' || b.descuento_raw as detalle, b.url_fuente
      from beneficio b
     where b.estado_revision = 'ok' and beneficio_vigente(b) and b.porcentaje > p_pct_max
    union all
    select 'vencido_publicado', b.fuente_id, b.id, b.comercio_key,
           'venció el ' || to_char(b.vigencia_hasta, 'DD/MM/YYYY'), b.url_fuente
      from beneficio b
     where b.estado_revision = 'ok' and b.vigencia_hasta < current_date
    union all
    select 'sin_productos', b.fuente_id, b.id, b.comercio_key, b.titulo, b.url_fuente
      from beneficio b
     where b.estado_revision = 'ok' and beneficio_vigente(b)
       and cardinality(b.productos_elegibles) = 0
       and b.fuente_id in (select fuente_id from restringe)
    union all
    select 'derivados_desfasados', null, null, c.key,
           'muestra ' || c.n_beneficios || ' beneficios / ' || coalesce(c.best_pct::text, '—')
             || ' %; vigentes: ' || coalesce(r.n, 0) || ' / ' || coalesce(r.best_pct::text, '—') || ' %',
           null
      from comercio c
      left join reales r on r.comercio_key = c.key
     where c.n_beneficios <> coalesce(r.n, 0)
        or c.best_pct is distinct from r.best_pct
        or c.max_cuotas is distinct from r.max_cuotas
    union all
    select 'comercio_en_otros', null, null, c.key, c.n_beneficios || ' beneficios', null
      from comercio c
     where c.categoria = 'otros' and c.n_beneficios > 0
  )
  select t.tipo, t.fuente_id, t.id, t.comercio_key, c.nombre, t.detalle, t.url_fuente
    from todo t
    join comercio c on c.key = t.comercio_key
   order by t.tipo, t.fuente_id nulls last, c.nombre
   limit p_limite;
$$;

-- Comercios con nombre casi igual: candidatos a fusionar. `%` usa el índice
-- trigram de `comercio.nombre`; después se filtra por el umbral pedido.
create or replace function salud_nombres_parecidos (p_similitud real default 0.6, p_limite int default 200)
returns table (key_a text, nombre_a text, n_a int, key_b text, nombre_b text, n_b int, similitud real)
language sql stable as $$
  select a.key, a.nombre, a.n_beneficios, b.key, b.nombre, b.n_beneficios,
         similarity(a.nombre, b.nombre) as s
    from comercio a
    join comercio b on a.key < b.key and a.nombre % b.nombre
   where similarity(a.nombre, b.nombre) >= p_similitud
   order by s desc, a.nombre
   limit p_limite;
$$;

-- Comercios con beneficios presenciales vigentes que no aparecen en el mapa.
create or replace function salud_comercios_sin_sucursal (p_limite int default 200)
returns table (comercio_key text, comercio text, categoria text, n_beneficios int)
language sql stable as $$
  select c.key, c.nombre, c.categoria, c.n_beneficios
    from comercio c
   where c.n_beneficios > 0
     and exists (
           select 1 from beneficio b
            where b.comercio_key = c.key and b.estado_revision = 'ok'
              and beneficio_vigente(b) and b.canal <> 'online')
     and not exists (select 1 from sucursal s where s.comercio_key = c.key and s.geom is not null)
   order by c.n_beneficios desc, c.nombre
   limit p_limite;
$$;

-- ------------------------------------------------------------ geocoding
create or replace function salud_geocoding ()
returns table (metrica text, cantidad bigint)
language sql stable as $$
  select 'sucursales', count(*) from sucursal
  union all select 'sucursales_sin_coordenadas', count(*) from sucursal where geom is null
  union all
  select 'precision_' || coalesce(s.precision::text, 'sin_dato'), count(*)
    from sucursal s where s.geom is not null group by s.precision
  union all select 'cache_consultas', count(*) from geocode_cache
  union all select 'cache_sin_resultado', count(*) from geocode_cache where lat is null;
$$;

-- ------------------------------------------------------------ resumen
-- Conteos para el dashboard y el resumen diario. Sin límite: cuenta todo.
create or replace function salud_resumen ()
returns table (tipo text, cantidad bigint)
language sql stable as $$
  select i.tipo, count(*) from salud_inconsistencias(60, 1000000) i group by 1
  union all select 'paginas_sin_beneficios', count(*) from salud_paginas_vacias(1000000)
  union all select 'saltos', count(*) from salud_saltos() s where s.alerta
  union all select 'nombres_parecidos', count(*) from salud_nombres_parecidos(0.6, 1000000)
  union all select 'comercios_sin_sucursal', count(*) from salud_comercios_sin_sucursal(1000000);
$$;

-- PostgREST expone todo `public` por RPC: que solo lo llame la service role.
do $$
declare f text;
begin
  foreach f in array array[
    'salud_paginas_vacias(int)', 'salud_paginas()', 'salud_saltos(numeric)',
    'salud_inconsistencias(numeric, int)', 'salud_nombres_parecidos(real, int)',
    'salud_comercios_sin_sucursal(int)', 'salud_geocoding()', 'salud_resumen()']
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
