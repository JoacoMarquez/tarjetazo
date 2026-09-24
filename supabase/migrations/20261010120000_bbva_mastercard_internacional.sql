-- Mastercard Internacional de BBVA (alta del scraper de catálogo, #27). BBVA
-- emite la Internacional Visa o Mastercard y sus beneficios dicen
-- "Internacional" sin red: las dos van en la familia `bbva-internacional`,
-- como Soy Santander, y todo beneficio de la Visa vale también para la otra.
insert into producto (id, fuente_id, nombre, instrumento, red, tier, familia, url_oficial) values
  ('bbva-mastercard-internacional', 'bbva', 'Mastercard Internacional BBVA', 'credito', 'mastercard', null, 'bbva-internacional',
   'https://www.bbva.com.uy/personas/productos/tarjetas/tarjeta-de-credito/tarjetas-mastercard-/mastercard-internacional.html')
on conflict (id) do update
  set nombre = excluded.nombre, instrumento = excluded.instrumento, red = excluded.red,
      tier = excluded.tier, familia = excluded.familia, url_oficial = excluded.url_oficial, activo = true;

update producto
   set nombre = 'Visa Internacional BBVA', familia = 'bbva-internacional'
 where id = 'bbva-credito';

-- Los beneficios ya publicados: el parser de BBVA solo corre sobre páginas que
-- cambiaron, así que los de hoy se completan acá.
update beneficio
   set productos_elegibles = (
     select array_agg(distinct x order by x)
       from unnest(productos_elegibles || array['bbva-mastercard-internacional']) x)
 where 'bbva-credito' = any (productos_elegibles)
   and not 'bbva-mastercard-internacional' = any (productos_elegibles);
