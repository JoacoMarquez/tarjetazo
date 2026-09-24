-- Altas y correcciones que trajo la primera revisión completa del catálogo (#27).
-- BBVA: Oro y Platinum se emiten Visa o Mastercard, como la Internacional; la
-- Visa Infinite tenía tier 'black'. BROU: AlfaBROU (la "Prepaga Internacional",
-- Visa o Mastercard) y MI BROU, que es una Visa Débito para jóvenes y figuraba
-- como prepaga de red propia.
insert into producto (id, fuente_id, nombre, instrumento, red, tier, familia, url_oficial) values
  ('bbva-mastercard-oro', 'bbva', 'Mastercard Oro BBVA', 'credito', 'mastercard', 'gold', 'bbva-oro', 'https://www.bbva.com.uy/personas/productos/tarjetas/tarjeta-de-credito/tarjetas-mastercard-/mastercard-oro.html'),
  ('bbva-mastercard-platinum', 'bbva', 'Mastercard Platinum BBVA', 'credito', 'mastercard', 'platinum', 'bbva-platinum', 'https://www.bbva.com.uy/personas/productos/tarjetas/tarjeta-de-credito/tarjetas-mastercard-/mastercard-platinum.html'),
  ('brou-alfabrou-visa', 'brou', 'Prepaga AlfaBROU Visa', 'prepaga', 'visa', null, 'brou-alfabrou', 'https://www.brou.com.uy/web/guest/personas/tarjetas/prepaga-alfabrou'),
  ('brou-alfabrou-mastercard', 'brou', 'Prepaga AlfaBROU Mastercard', 'prepaga', 'mastercard', null, 'brou-alfabrou', 'https://www.brou.com.uy/web/guest/personas/tarjetas/prepaga-alfabrou')
on conflict (id) do update
  set nombre = excluded.nombre, instrumento = excluded.instrumento, red = excluded.red,
      tier = excluded.tier, familia = excluded.familia, url_oficial = excluded.url_oficial, activo = true;

update producto set nombre = 'Visa Oro BBVA', familia = 'bbva-oro' where id = 'bbva-oro';
update producto set nombre = 'Visa Platinum BBVA', familia = 'bbva-platinum' where id = 'bbva-platinum';
update producto set tier = 'infinite' where id = 'bbva-infinite';
update producto set instrumento = 'debito', red = 'visa' where id = 'brou-mi-brou';

-- Los beneficios de BBVA ya publicados: el parser solo corre sobre páginas que
-- cambiaron. "Oro" y "Platinum" sin red valen para las dos.
update beneficio
   set productos_elegibles = (
     select array_agg(distinct x order by x) from unnest(productos_elegibles || array['bbva-mastercard-oro']) x)
 where 'bbva-oro' = any (productos_elegibles) and not 'bbva-mastercard-oro' = any (productos_elegibles);

update beneficio
   set productos_elegibles = (
     select array_agg(distinct x order by x) from unnest(productos_elegibles || array['bbva-mastercard-platinum']) x)
 where 'bbva-platinum' = any (productos_elegibles) and not 'bbva-mastercard-platinum' = any (productos_elegibles);
