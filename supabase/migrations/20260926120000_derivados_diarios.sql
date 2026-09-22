-- Los derivados de `comercio` (best_pct, max_cuotas, n_beneficios, n_fuentes)
-- solo se recalculaban desde el trigger de `beneficio`. Cuando un beneficio
-- vence por fecha sin que su página cambie, nadie toca la fila, el trigger no
-- dispara y el comercio sigue mostrando un descuento que ya no rige (#30). El
-- runner llama a esto al final de cada corrida. De paso, la vigencia se evalúa
-- con la fecha de Uruguay y no con la de la conexión (UTC).

create or replace function recalcular_derivados_comercio (p_comercio_key text)
returns void language sql as $$
  update comercio c
     set best_pct     = d.best_pct,
         max_cuotas   = d.max_cuotas,
         n_beneficios = d.n_beneficios,
         n_fuentes    = d.n_fuentes,
         updated_at   = now()
    from (
      select max(b.porcentaje)            as best_pct,
             max(b.cuotas)                as max_cuotas,
             count(*)                     as n_beneficios,
             count(distinct b.fuente_id)  as n_fuentes
        from beneficio b
       where b.comercio_key = p_comercio_key
         and b.estado_revision = 'ok'
         and beneficio_vigente(b, hoy_uy())
    ) d
   where c.key = p_comercio_key;
$$;

-- Todos los comercios de una vez, sin pasar por el trigger. Un `update` sobre
-- ~1.100 comercios y ~2.400 beneficios: menos de un segundo. Devuelve cuántos
-- comercios cambiaron, para el log de la corrida. Solo toca los que cambian,
-- para no mover `updated_at` de los demás.
create or replace function recalcular_derivados_todos ()
returns int language sql as $$
  with d as (
    select b.comercio_key,
           max(b.porcentaje)           as best_pct,
           max(b.cuotas)               as max_cuotas,
           count(*)                    as n_beneficios,
           count(distinct b.fuente_id) as n_fuentes
      from beneficio b
     where b.estado_revision = 'ok'
       and beneficio_vigente(b, hoy_uy())
     group by b.comercio_key
  ), cambiados as (
    update comercio c
       set best_pct     = d.best_pct,
           max_cuotas   = d.max_cuotas,
           n_beneficios = coalesce(d.n_beneficios, 0),
           n_fuentes    = coalesce(d.n_fuentes, 0),
           updated_at   = now()
      from comercio c2
      left join d on d.comercio_key = c2.key
     where c.key = c2.key
       and (c.best_pct     is distinct from d.best_pct
         or c.max_cuotas   is distinct from d.max_cuotas
         or c.n_beneficios is distinct from coalesce(d.n_beneficios, 0)
         or c.n_fuentes    is distinct from coalesce(d.n_fuentes, 0))
    returning 1
  )
  select count(*)::int from cambiados;
$$;

-- `hoy_uy()` la llaman ahora funciones que corren con la anon key (el trigger
-- y las consultas públicas): tiene que poder ejecutarla cualquiera.
grant execute on function hoy_uy() to anon, authenticated;
revoke execute on function recalcular_derivados_todos() from public, anon, authenticated;
grant execute on function recalcular_derivados_todos() to service_role;
