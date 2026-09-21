-- Ajustes a los chequeos de salud tras la revisión del PR #32. La migración
-- original ya está aplicada, así que las funciones se reemplazan acá.

-- ------------------------------------------------------------ fecha local
-- Postgres corre en UTC: entre las 21:00 y las 00:00 de Uruguay `current_date`
-- ya es el día siguiente, y los chequeos de vigencia daban por vencido algo
-- que todavía rige. Uruguay no tiene horario de verano.
create or replace function hoy_uy () returns date
language sql stable as $$
  select (now() at time zone 'America/Montevideo')::date;
$$;

-- ------------------------------------------------------------ clave de página
-- La URL no identifica una página: Itaú publica 247 beneficios bajo 2 URLs y
-- Scotiabank 243 bajo 10. La cola pasa a guardar el `external_id`, que junto
-- con la fuente es la clave de `pagina_cruda`.
alter table beneficio_revision add column if not exists external_id text;
create index if not exists beneficio_revision_pagina_idx
  on beneficio_revision (fuente_id, external_id) where not resuelto;

-- Backfill solo donde la URL es de una única página; el resto queda en null.
update beneficio_revision r
   set external_id = u.external_id
  from (
    select fuente_id, url_fuente, min(external_id) as external_id
      from pagina_cruda
     group by 1, 2
    having count(*) = 1
  ) u
 where r.external_id is null
   and r.fuente_id = u.fuente_id
   and r.url_fuente = u.url_fuente;

-- ------------------------------------------------------------ páginas vacías
-- Cambios respecto de la primera versión:
--  · solo cuentan los beneficios no descartados: si una página cambia, el
--    normalizador devuelve 0 tramos y el runner descarta los anteriores, eso es
--    justo la regresión que este chequeo tiene que mostrar;
--  · las páginas que la fuente dejó de publicar (no se bajan hace más de 10
--    días respecto de lo último de su fuente) no son "vacías", ya no existen;
--  · la cola se correlaciona por `external_id`. Las filas viejas sin ese dato
--    no excluyen a ninguna página: mejor mostrar de más que esconder.
create or replace function salud_paginas_vacias (p_limite int default 200)
returns table (fuente_id text, external_id text, url_fuente text, fetched_at timestamptz)
language sql stable as $$
  with ultima as (
    select p.fuente_id, max(p.fetched_at) as ult from pagina_cruda p group by 1
  )
  select p.fuente_id, p.external_id, p.url_fuente, p.fetched_at
    from pagina_cruda p
    join ultima u on u.fuente_id = p.fuente_id
   where p.fetched_at >= u.ult - interval '10 days'
     and not exists (
           select 1 from beneficio b
            where b.fuente_id = p.fuente_id
              and b.estado_revision <> 'descartado'
              and starts_with(b.id, p.fuente_id || ':' || p.external_id || ':'))
     and not exists (
           select 1 from beneficio_revision r
            where r.fuente_id = p.fuente_id
              and r.external_id = p.external_id
              and not r.resuelto)
   order by p.fuente_id, p.fetched_at desc
   limit p_limite;
$$;

-- `salud_paginas` cuenta solo las páginas que la fuente sigue publicando, para
-- que "con beneficios" + "sin beneficios" sume el total que muestra.
create or replace function salud_paginas ()
returns table (fuente_id text, paginas bigint, con_beneficios bigint, sin_beneficios bigint)
language sql stable as $$
  with ultima as (
    select p.fuente_id, max(p.fetched_at) as ult from pagina_cruda p group by 1
  ), vivas as (
    select p.fuente_id
      from pagina_cruda p
      join ultima u on u.fuente_id = p.fuente_id
     where p.fetched_at >= u.ult - interval '10 days'
  ), vacias as (
    select v.fuente_id, count(*) as n from salud_paginas_vacias(100000) v group by 1
  )
  select p.fuente_id,
         count(*)                         as paginas,
         count(*) - coalesce(max(v.n), 0) as con_beneficios,
         coalesce(max(v.n), 0)            as sin_beneficios
    from vivas p
    left join vacias v using (fuente_id)
   group by p.fuente_id
   order by p.fuente_id;
$$;

-- ------------------------------------------------------------ inconsistencias
-- Igual que antes, con la fecha de Uruguay pasada de forma explícita.
create or replace function salud_inconsistencias (p_pct_max numeric default 60, p_limite int default 500)
returns table (tipo text, fuente_id text, beneficio_id text, comercio_key text, comercio text, detalle text, url_fuente text)
language sql stable as $$
  with hoy as (select hoy_uy() as d),
  restringe as (
    select b.fuente_id
      from beneficio b
     where b.estado_revision = 'ok'
     group by 1
    having count(*) >= 20
       and avg((cardinality(b.productos_elegibles) > 0)::int) >= 0.9
  ), reales as (
    select b.comercio_key,
           max(b.porcentaje) as best_pct, max(b.cuotas) as max_cuotas, count(*) as n
      from beneficio b, hoy
     where b.estado_revision = 'ok' and beneficio_vigente(b, hoy.d)
     group by 1
  ), todo as (
    select 'porcentaje_alto' as tipo, b.fuente_id, b.id, b.comercio_key,
           b.porcentaje::text || ' % — ' || b.descuento_raw as detalle, b.url_fuente
      from beneficio b, hoy
     where b.estado_revision = 'ok' and beneficio_vigente(b, hoy.d) and b.porcentaje > p_pct_max
    union all
    select 'vencido_publicado', b.fuente_id, b.id, b.comercio_key,
           'venció el ' || to_char(b.vigencia_hasta, 'DD/MM/YYYY'), b.url_fuente
      from beneficio b, hoy
     where b.estado_revision = 'ok' and b.vigencia_hasta < hoy.d
    union all
    select 'sin_productos', b.fuente_id, b.id, b.comercio_key, b.titulo, b.url_fuente
      from beneficio b, hoy
     where b.estado_revision = 'ok' and beneficio_vigente(b, hoy.d)
       and cardinality(b.productos_elegibles) = 0
       and b.fuente_id in (select r.fuente_id from restringe r)
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

create or replace function salud_comercios_sin_sucursal (p_limite int default 200)
returns table (comercio_key text, comercio text, categoria text, n_beneficios int)
language sql stable as $$
  select c.key, c.nombre, c.categoria, c.n_beneficios
    from comercio c
   where c.n_beneficios > 0
     and exists (
           select 1 from beneficio b
            where b.comercio_key = c.key and b.estado_revision = 'ok'
              and beneficio_vigente(b, hoy_uy()) and b.canal <> 'online')
     and not exists (select 1 from sucursal s where s.comercio_key = c.key and s.geom is not null)
   order by c.n_beneficios desc, c.nombre
   limit p_limite;
$$;

revoke execute on function hoy_uy() from public, anon, authenticated;
grant execute on function hoy_uy() to service_role;
