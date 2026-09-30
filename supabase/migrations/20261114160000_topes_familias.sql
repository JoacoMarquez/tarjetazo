-- `beneficios_por_familia` (20261113150000_rpc_topes.sql) acotaba familias (200)
-- y productos por familia (300, en aplica_a_productos) por separado. Como cada
-- familia elige su fuente, 200 familias apuntando a la fuente más grande con
-- 300 productos cada una costaban cientos de veces la llamada de la web.
-- Topes sobre el total: la web manda 75 familias, 92 productos y como mucho
-- 16 familias de una misma fuente (FAMILIAS_TARJETA); pasarlos da vacío.

create or replace function beneficios_por_familia (p_familias jsonb)
returns table (familia_id text, vigentes int, exclusivos int)
language sql stable as $$
  with pedido as materialized (
    select f
      from jsonb_array_elements(p_familias) f
     where jsonb_array_length(p_familias) <= 200
  ),
  topes as (
    select coalesce(sum(case when jsonb_typeof(f->'productos') = 'array'
                             then jsonb_array_length(f->'productos') else 0 end), 0) <= 600
           and coalesce(max(por_fuente), 0) <= 40 as ok
      from pedido,
           lateral (select count(*) as por_fuente from pedido p2
                     where p2.f->>'fuente_id' = pedido.f->>'fuente_id') c
  ),
  fam as materialized (
    select distinct on (f->>'id')
           f->>'id'        as familia_id,
           f->>'fuente_id' as fuente_id,
           array(select jsonb_array_elements_text(f->'productos')) as productos
      from pedido
     where (select ok from topes)
  )
  select fam.familia_id,
         count(b.id)::int as vigentes,
         count(b.id) filter (
           where cardinality(b.productos_elegibles) > 0
             and b.productos_elegibles <@ fam.productos
         )::int as exclusivos
    from fam
    left join beneficio b
      on b.fuente_id = fam.fuente_id
     and b.estado_revision = 'ok'
     and beneficio_vigente(b)
     and aplica_a_productos(b, fam.productos)
   group by fam.familia_id;
$$;
