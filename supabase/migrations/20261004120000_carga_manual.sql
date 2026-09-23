-- Beneficios cargados a mano desde el backoffice (#23): lo que ninguna fuente
-- scrapeada publica (un cartel, Instagram, un mail del banco). El runner no los
-- toca: no pertenecen a ninguna página, así que nunca se dan de baja solos.
-- Tienen que tener fecha de fin (60 días por defecto en el formulario).
alter table beneficio
  add column if not exists origen text not null default 'scraper'
    check (origen in ('scraper', 'manual')),
  add column if not exists nota_manual text;
alter table beneficio add constraint beneficio_manual_con_fin_ck
  check (origen <> 'manual' or vigencia_hasta is not null);
create index if not exists beneficio_manual_idx on beneficio (vigencia_hasta) where origen = 'manual';

-- Manuales que vencen en los próximos p_dias (para renovarlos o dejarlos caer)
-- y manuales que ya tienen un gemelo scrapeado (mismo comercio, fuente y
-- descuento): el banco lo empezó a publicar y el manual sobra.
create or replace function salud_manuales (p_dias int default 7)
returns table (tipo text, beneficio_id text, comercio_key text, comercio text, titulo text,
               vigencia_hasta date, gemelo_id text)
language sql stable as $$
  select 'manual_por_vencer', b.id, b.comercio_key, c.nombre, b.titulo, b.vigencia_hasta, null
    from beneficio b join comercio c on c.key = b.comercio_key
   where b.origen = 'manual' and b.estado_revision = 'ok'
     and b.vigencia_hasta between hoy_uy() and hoy_uy() + p_dias
  union all
  select 'manual_duplicado', m.id, m.comercio_key, c.nombre, m.titulo, m.vigencia_hasta, min(s.id)
    from beneficio m
    join comercio c on c.key = m.comercio_key
    join beneficio s
      on s.origen = 'scraper' and s.estado_revision = 'ok'
     and s.comercio_key = m.comercio_key and s.fuente_id = m.fuente_id
     and s.tipo = m.tipo
     and s.porcentaje is not distinct from m.porcentaje
     and s.cuotas is not distinct from m.cuotas
     and beneficio_vigente(s)
   where m.origen = 'manual' and m.estado_revision = 'ok' and beneficio_vigente(m)
   group by m.id, m.comercio_key, c.nombre, m.titulo, m.vigencia_hasta;
$$;

create or replace function salud_resumen ()
returns table (tipo text, cantidad bigint)
language sql stable as $$
  select i.tipo, count(*) from salud_inconsistencias(60, 1000000) i group by 1
  union all select 'paginas_sin_beneficios', count(*) from salud_paginas_vacias(1000000)
  union all select 'saltos', count(*) from salud_saltos() s where s.alerta
  union all select 'nombres_parecidos', count(*) from salud_nombres_parecidos(0.6, 1000000)
  union all select 'comercios_sin_sucursal', count(*) from salud_comercios_sin_sucursal(1000000)
  union all select 'frescura', count(*) from salud_frescura(180, 1000000)
  union all select m.tipo, count(*) from salud_manuales(7) m group by 1;
$$;

revoke execute on function salud_manuales(int) from public, anon, authenticated;
grant execute on function salud_manuales(int) to service_role;
