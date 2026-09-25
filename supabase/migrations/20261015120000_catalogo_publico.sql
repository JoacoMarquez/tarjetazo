-- Catálogo público de tarjetas (#70): cuántos beneficios vigentes aplican a
-- cada familia. Las familias viven en código (@tarjetazo/core), así que la
-- web las manda como jsonb: [{id, fuente_id, productos: [ids de plástico]}].
--
-- `vigentes` usa la misma regla que la lista pública (`aplica_a_productos`):
-- un beneficio sin tarjeta específica vale para todas las del banco, por eso
-- Soy, Select y Private de Santander empatan. `exclusivos` cuenta los que
-- nombran únicamente plásticos de esta familia: lo que aporta el tier.
create or replace function beneficios_por_familia (p_familias jsonb)
returns table (familia_id text, vigentes int, exclusivos int)
language sql stable as $$
  with fam as (
    select f->>'id'        as familia_id,
           f->>'fuente_id' as fuente_id,
           array(select jsonb_array_elements_text(f->'productos')) as productos
      from jsonb_array_elements(p_familias) f
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

grant execute on function beneficios_por_familia(jsonb) to anon, authenticated;
