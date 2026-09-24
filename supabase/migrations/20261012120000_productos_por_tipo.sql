-- Beneficios con `productos_elegibles` vacío cuyo texto nombra un tipo de
-- tarjeta sin nombrar ninguna ("30% con tarjetas de débito", "con tarjetas de
-- crédito"). El modelo deja la lista vacía en esos casos y vacío es "todas las
-- de la fuente", así que un descuento solo con débito aparecía en las páginas
-- de las de crédito. El normalizador ya lo resuelve (`productosPorTipo`); esto
-- corrige lo publicado con la misma regla, sin volver a pasar las páginas por
-- el modelo: manda el texto del tramo y, si no dice nada, la letra chica.
with texto as (
  select id, fuente_id,
         regexp_replace(translate(lower(descuento_raw), 'áéíóú', 'aeiou'),
                        'debitos? automaticos?', '', 'g') as d,
         regexp_replace(translate(lower(coalesce(legales_raw, '')), 'áéíóú', 'aeiou'),
                        'debitos? automaticos?', '', 'g') as l
    from beneficio
   where origen = 'scraper'
     and cardinality(productos_elegibles) = 0
),
menciones as (
  select id, fuente_id,
         array_remove(array[
           case when d ~ '\mcredito\M' then 'credito' end,
           case when d ~ '\mdebito\M' then 'debito' end,
           case when d ~ '\mprepagas?\M' then 'prepaga' end], null) as en_tramo,
         array_remove(array[
           case when l ~ '\mcredito\M' then 'credito' end,
           case when l ~ '\mdebito\M' then 'debito' end,
           case when l ~ '\mprepagas?\M' then 'prepaga' end], null) as en_legales
    from texto
),
nuevos as (
  select m.id,
         (select array_agg(p.id order by p.id)
            from producto p
           where p.fuente_id = m.fuente_id
             and p.activo
             and p.instrumento::text = any (
               case when cardinality(m.en_tramo) > 0 then m.en_tramo else m.en_legales end)) as productos
    from menciones m
)
update beneficio b
   set productos_elegibles = n.productos
  from nuevos n
 where b.id = n.id
   and n.productos is not null;
