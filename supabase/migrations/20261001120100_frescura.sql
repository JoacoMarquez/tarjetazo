-- Frescura (#21, recortada en el grill del 2026-09-23; ver docs/04-backoffice.md).

-- Desde cuándo la página tiene este hash. Arranca de cero: el backfill de
-- `normalizada_en` fue el 21/9 y no hay dato anterior confiable.
alter table pagina_cruda add column if not exists hash_desde timestamptz;
update pagina_cruda set hash_desde = coalesce(normalizada_en, fetched_at) where hash_desde is null;

-- "Lo miré y sigue vigente": sale de la lista de sospechosos hasta esta fecha.
alter table beneficio add column if not exists verificado_hasta date;

-- `cambio` suma 'oculto' (lo ocultó el operador).
alter table beneficio drop constraint if exists beneficio_cambio_check;
alter table beneficio add constraint beneficio_cambio_check
  check (cambio in ('nuevo', 'actualizado', 'restaurado', 'baja', 'oculto'));

-- Sospechosos de viejos ("amarillos"): publicados, sin fecha de fin, sin
-- verificación vigente, y su página no cambia hace más de p_dias.
create or replace function salud_frescura (p_dias int default 180, p_limite int default 500)
returns table (beneficio_id text, fuente_id text, external_id text, comercio_key text, comercio text,
               titulo text, hash_desde timestamptz, dias int)
language sql stable as $$
  select b.id, b.fuente_id, p.external_id, b.comercio_key, c.nombre, b.titulo, p.hash_desde,
         (hoy_uy() - (p.hash_desde at time zone 'America/Montevideo')::date)::int
    from beneficio b
    join pagina_cruda p
      on p.fuente_id = b.fuente_id
     and starts_with(b.id, p.fuente_id || ':' || p.external_id || ':')
    join comercio c on c.key = b.comercio_key
   where b.estado_revision = 'ok'
     and b.vigencia_hasta is null
     and (b.verificado_hasta is null or b.verificado_hasta < hoy_uy())
     and p.hash_desde < now() - make_interval(days => p_dias)
   order by p.hash_desde, b.id
   limit p_limite;
$$;

-- Informativo: no entra en las alertas accionables.
create or replace function salud_resumen ()
returns table (tipo text, cantidad bigint)
language sql stable as $$
  select i.tipo, count(*) from salud_inconsistencias(60, 1000000) i group by 1
  union all select 'paginas_sin_beneficios', count(*) from salud_paginas_vacias(1000000)
  union all select 'saltos', count(*) from salud_saltos() s where s.alerta
  union all select 'nombres_parecidos', count(*) from salud_nombres_parecidos(0.6, 1000000)
  union all select 'comercios_sin_sucursal', count(*) from salud_comercios_sin_sucursal(1000000)
  union all select 'frescura', count(*) from salud_frescura(180, 1000000);
$$;

revoke execute on function salud_frescura(int, int) from public, anon, authenticated;
grant execute on function salud_frescura(int, int) to service_role;
