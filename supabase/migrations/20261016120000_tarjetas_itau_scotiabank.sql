-- Tarjetas que faltaban (relevadas al cargar las fichas, #26): Visa LATAM Pass
-- (Internacional y Platinum) y la débito U25 de Itaú; Amex Gold, The Platinum
-- Card y Amex Copa Platinum de Scotiabank. Además, los beneficios publicados de
-- Scotiabank mandaban "Amex Gold/Oro" a la Visa Gold y "The Platinum Card" a la
-- Visa Platinum. Se corrigen con las mismas reglas que ahora usa el
-- normalizador, sin volver a pasar las páginas por el modelo.
insert into producto (id, fuente_id, nombre, instrumento, red, tier) values
  ('itau-latam-pass', 'itau', 'Visa LATAM Pass Itaú', 'credito', 'visa', null),
  ('itau-latam-pass-platinum', 'itau', 'Visa LATAM Pass Platinum Itaú', 'credito', 'visa', 'platinum'),
  ('itau-debito-u25', 'itau', 'Itaú Débito U25', 'debito', 'visa', null),
  ('scotiabank-amex-gold', 'scotiabank', 'American Express Gold Scotiabank', 'credito', 'amex', 'gold'),
  ('scotiabank-amex-platinum', 'scotiabank', 'The Platinum Card American Express Scotiabank', 'credito', 'amex', 'platinum'),
  ('scotiabank-amex-copa-platinum', 'scotiabank', 'American Express Copa Platinum Scotiabank', 'credito', 'amex', 'platinum')
on conflict (id) do update
  set nombre = excluded.nombre, instrumento = excluded.instrumento, red = excluded.red,
      tier = excluded.tier, activo = true;

create temporary table ajuste on commit drop as
select id, fuente_id, productos_elegibles as p,
       translate(lower(descuento_raw), 'áéíóú', 'aeiou') as d,
       translate(lower(descuento_raw || ' ' || coalesce(legales_raw, '')), 'áéíóú', 'aeiou') as t
  from beneficio
 where fuente_id in ('scotiabank', 'itau') and cardinality(productos_elegibles) > 0;

-- Scotiabank
-- "The Platinum Card American Express": es solo la Amex, no la Visa Platinum.
update ajuste set p = array_remove(p, 'scotiabank-visa-platinum') || array['scotiabank-amex-platinum']
 where fuente_id = 'scotiabank' and t ~ 'platinum card' and d !~ 'visa platinum';
-- "Amex Gold/Oro": la Visa Gold había entrado por error.
update ajuste set p = array_remove(p, 'scotiabank-visa-gold') || array['scotiabank-amex-gold']
 where fuente_id = 'scotiabank' and t ~ '(amex|american express) *(gold|oro)|gold card' and d !~ 'visa gold';
update ajuste set p = p || array['scotiabank-amex-platinum', 'scotiabank-amex-copa-platinum']
 where fuente_id = 'scotiabank' and t ~ '(amex|american express) *platinum' and t !~ 'platinum card';
-- "Gold" o "Platinum" a secas valen para todas las de ese nivel.
update ajuste set p = p || array['scotiabank-amex-gold']
 where fuente_id = 'scotiabank' and 'scotiabank-visa-gold' = any (p) and d !~ 'visa gold';
update ajuste set p = p || array['scotiabank-amex-platinum', 'scotiabank-amex-copa-platinum']
 where fuente_id = 'scotiabank' and 'scotiabank-visa-platinum' = any (p) and d !~ 'visa platinum' and t !~ 'platinum card';
-- Todas las de crédito.
update ajuste set p = p || array['scotiabank-amex-gold', 'scotiabank-amex-platinum', 'scotiabank-amex-copa-platinum']
 where fuente_id = 'scotiabank' and p @> array['scotiabank-visa', 'scotiabank-mastercard', 'scotiabank-amex'];

-- Itaú
update ajuste set p = p || array['itau-latam-pass', 'itau-latam-pass-platinum']
 where fuente_id = 'itau' and p @> array['itau-visa', 'itau-mastercard'];
update ajuste set p = p || array['itau-latam-pass-platinum']
 where fuente_id = 'itau' and 'itau-visa-platinum' = any (p) and d !~ 'volar';
update ajuste set p = p || array['itau-debito-u25']
 where fuente_id = 'itau' and p @> array['itau-debito-volar', 'itau-debito-sueldo'];

update beneficio b
   set productos_elegibles = (select array_agg(distinct x order by x) from unnest(a.p) x)
  from ajuste a
 where b.id = a.id
   and (select array_agg(distinct x order by x) from unnest(a.p) x)
       is distinct from (select array_agg(distinct x order by x) from unnest(b.productos_elegibles) x);
