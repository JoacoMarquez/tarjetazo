-- Dudosos de la auditoría del catálogo, resueltos con fuentes oficiales
-- (docs/04-backoffice.md → "Auditoría del catálogo"). Espejo de PRODUCTOS.
-- Idempotente.
--
-- - AAdvantage Visa y Mastercard son Platinum (FAQ de la página AAdvantage:
--   "AAdvantage® Visa y Mastercard Platinum"). Los beneficios de las Platinum
--   de Santander se les suman por red, que es lo que haría el normalizador
--   ("Platinum" → todas las Platinum de la fuente) al volver a leer las páginas.
-- - Hipermás se emite Visa o Mastercard (bases de la promo GDU 2026): pasa a ser
--   una familia con las dos, y sus beneficios suman la Visa.
-- - Itaú Débito Sueldos ya no se vende, pero el tarifario la cobra: queda activa
--   con la página de 2016.

-- 1. Catálogo -----------------------------------------------------------------
update producto set tier = 'platinum', nombre = 'AAdvantage Visa Platinum'
 where id = 'santander-aadvantage-visa';
update producto set tier = 'platinum', nombre = 'AAdvantage Mastercard Platinum'
 where id = 'santander-aadvantage-mastercard';
update producto set familia = 'santander-hipermas', nombre = 'Hipermás Santander Mastercard'
 where id = 'santander-hipermas';
insert into producto (id, fuente_id, nombre, instrumento, red, tier, familia, activo, url_oficial) values
  ('santander-hipermas-visa', 'santander', 'Hipermás Santander Visa', 'credito', 'visa', null, 'santander-hipermas', true,
   'https://www.santander.com.uy/todas-las-tarjetas/hipermas')
on conflict (id) do update
  set nombre = excluded.nombre, instrumento = excluded.instrumento, red = excluded.red, tier = excluded.tier,
      familia = excluded.familia, activo = excluded.activo, url_oficial = excluded.url_oficial;
update producto set url_oficial = 'https://www.itau.com.uy/inst/tarjetaPagoDeSueldos.html'
 where id = 'itau-debito-sueldo' and url_oficial is null;

-- 2. Beneficios y alias: donde está X, se suma Y --------------------------------
create temporary table suma (donde text, agrega text) on commit drop;
insert into suma values
  ('santander-visa-platinum', 'santander-aadvantage-visa'),
  ('santander-mastercard-platinum', 'santander-aadvantage-mastercard'),
  ('santander-hipermas', 'santander-hipermas-visa');

update beneficio b
   set productos_elegibles = (
     select array_agg(distinct x order by x)
       from unnest(b.productos_elegibles || array(select s.agrega from suma s where s.donde = any (b.productos_elegibles))) x)
 where exists (select 1 from suma s where s.donde = any (b.productos_elegibles) and not s.agrega = any (b.productos_elegibles));

update producto_alias a
   set producto_ids = (
     select array_agg(distinct x order by x)
       from unnest(a.producto_ids || array(select s.agrega from suma s where s.donde = any (a.producto_ids))) x)
 where exists (select 1 from suma s where s.donde = any (a.producto_ids) and not s.agrega = any (a.producto_ids));
