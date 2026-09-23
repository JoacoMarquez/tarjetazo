-- Por qué una página quedó sin beneficios (#35). "Páginas sin beneficios"
-- mezclaba tres cosas: páginas que no son un beneficio (el normalizador lo
-- decidió bien), páginas retiradas y fallos reales. El runner guarda ahora el
-- resultado de la última normalización; desde el inspector se puede marcar a
-- mano una página como "no es un beneficio" (vale hasta que la página cambie).

alter table pagina_cruda
  add column if not exists resultado text
    check (resultado in ('beneficios', 'no_es_beneficio', 'sin_tramos')),
  add column if not exists tramos int;

-- Backfill: lo único que se puede saber sin re-normalizar es qué páginas
-- tienen beneficios vigentes. El resto queda sin clasificar (null).
with n as (
  select p.fuente_id, p.external_id,
         (select count(*) from beneficio b
           where b.fuente_id = p.fuente_id
             and b.estado_revision <> 'descartado'
             and starts_with(b.id, p.fuente_id || ':' || p.external_id || ':')) as tramos
    from pagina_cruda p
   where p.resultado is null
)
update pagina_cruda p
   set resultado = 'beneficios', tramos = n.tramos
  from n
 where n.fuente_id = p.fuente_id and n.external_id = p.external_id and n.tramos > 0;

-- Cambia el tipo de retorno: hay que recrearlas (y volver a cerrar los permisos,
-- que `create function` otorga a public).
drop function if exists salud_paginas();
drop function if exists salud_paginas_vacias(int);

-- Páginas vivas que no dejaron beneficios y que nadie decidió que "no son un
-- beneficio". Las sin clasificar (null) se muestran: mejor de más que de menos.
create function salud_paginas_vacias (p_limite int default 200)
returns table (fuente_id text, external_id text, url_fuente text, fetched_at timestamptz, resultado text)
language sql stable as $$
  with ultima as (
    select p.fuente_id, max(p.fetched_at) as ult from pagina_cruda p group by 1
  )
  select p.fuente_id, p.external_id, p.url_fuente, p.fetched_at, p.resultado
    from pagina_cruda p
    join ultima u on u.fuente_id = p.fuente_id
   where p.fetched_at >= u.ult - interval '10 days'
     and p.resultado is distinct from 'no_es_beneficio'
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
   order by p.fuente_id, p.resultado nulls first, p.fetched_at desc
   limit p_limite;
$$;

create function salud_paginas ()
returns table (fuente_id text, paginas bigint, con_beneficios bigint, no_son_beneficio bigint, sin_beneficios bigint)
language sql stable as $$
  with ultima as (
    select p.fuente_id, max(p.fetched_at) as ult from pagina_cruda p group by 1
  ), vivas as (
    select p.fuente_id, p.resultado
      from pagina_cruda p
      join ultima u on u.fuente_id = p.fuente_id
     where p.fetched_at >= u.ult - interval '10 days'
  ), vacias as (
    select v.fuente_id, count(*) as n from salud_paginas_vacias(100000) v group by 1
  )
  select p.fuente_id,
         count(*) as paginas,
         count(*) - count(*) filter (where p.resultado = 'no_es_beneficio') - coalesce(max(v.n), 0) as con_beneficios,
         count(*) filter (where p.resultado = 'no_es_beneficio') as no_son_beneficio,
         coalesce(max(v.n), 0) as sin_beneficios
    from vivas p
    left join vacias v using (fuente_id)
   group by p.fuente_id
   order by p.fuente_id;
$$;

revoke execute on function salud_paginas_vacias(int) from public, anon, authenticated;
revoke execute on function salud_paginas() from public, anon, authenticated;
grant execute on function salud_paginas_vacias(int) to service_role;
grant execute on function salud_paginas() to service_role;
