-- Catálogo auditado contra el sitio oficial de cada banco (2026-09-25). Decisiones
-- en docs/04-backoffice.md → "Auditoría del catálogo". Espejo de `PRODUCTOS`
-- (packages/core/src/fuentes.ts): 14 altas, 11 productos que pasan a
-- `activo = false`, redes y nombres corregidos y `url_oficial` para todos los
-- que la tienen. Idempotente: se puede correr dos veces.
--
-- Bajas (el banco no las emite): santander-amex, brou-visa-black,
-- scotiabank-visa-gold, scotiabank-visa-signature, itau-visa-signature,
-- bbva-platinum (Visa Platinum) e itau-debito (duplicaba la Volar). No son
-- plásticos: oca-blue (la cuenta; su tarjeta es oca-blue-debito),
-- itau-debito-u25 e itau-pocket (cuentas con la Visa Débito Volar) e
-- itau-personal-bank (el paquete, que pasa a ser la familia de las Infinite).

-- 1. Catálogo --------------------------------------------------------------
insert into producto (id, fuente_id, nombre, instrumento, red, tier, familia, activo, url_oficial) values
  ('brou-visa-debito', 'brou', 'BROU Visa Débito', 'debito', 'visa', null, null, true, 'https://www.brou.com.uy/personas/tarjetas/redbrou-visa/visa-institucional'),
  ('brou-visa', 'brou', 'BROU Visa', 'credito', 'visa', null, null, true, 'https://www.brou.com.uy/personas/tarjetas/visa/productos'),
  ('brou-visa-platinum', 'brou', 'BROU Visa Platinum', 'credito', 'visa', 'platinum', null, true, 'https://www.brou.com.uy/personas/tarjetas/visa-platinum'),
  ('brou-visa-gold', 'brou', 'BROU Visa Oro', 'credito', 'visa', 'gold', null, true, 'https://www.brou.com.uy/personas/tarjetas/visa/productos'),
  ('brou-recompensa-debito', 'brou', 'BROU Recompensa Mastercard Débito', 'debito', 'mastercard', null, null, true, 'https://www.brou.com.uy/personas/tarjetas/debito-mastercard/brou-recompensa-mastercard-debito'),
  ('brou-mastercard-debito', 'brou', 'BROU Mastercard Débito', 'debito', 'mastercard', null, null, true, 'https://www.brou.com.uy/personas/tarjetas/debito-mastercard/brou-mastercard-debito'),
  ('brou-recompensa', 'brou', 'BROU Recompensa Mastercard', 'credito', 'mastercard', null, null, true, 'https://www.brou.com.uy/personas/tarjetas/mastercard/brou-recompensa'),
  ('brou-recompensa-platinum', 'brou', 'BROU Recompensa Mastercard Platinum', 'credito', 'mastercard', 'platinum', null, true, 'https://www.brou.com.uy/personas/tarjetas/mastercard/mastercard-platinum'),
  ('brou-recompensa-gold', 'brou', 'BROU Recompensa Mastercard Oro', 'credito', 'mastercard', 'gold', null, true, 'https://www.brou.com.uy/personas/tarjetas/master/productos'),
  ('brou-recompensa-black', 'brou', 'BROU Recompensa Mastercard Black', 'credito', 'mastercard', 'black', null, true, 'https://www.brou.com.uy/personas/tarjetas/mastercard-black'),
  ('brou-mi-brou', 'brou', 'MI BROU Tarjeta Joven', 'debito', 'visa', null, null, true, 'https://www.brou.com.uy/personas/tarjetas/redbrou-visa/mi-brou'),
  ('brou-alfabrou-visa', 'brou', 'Prepaga AlfaBROU Visa', 'prepaga', 'visa', null, 'brou-alfabrou', true, 'https://www.brou.com.uy/personas/tarjetas/prepaga-alfabrou'),
  ('brou-alfabrou-mastercard', 'brou', 'Prepaga AlfaBROU Mastercard', 'prepaga', 'mastercard', null, 'brou-alfabrou', true, 'https://www.brou.com.uy/personas/tarjetas/prepaga-alfabrou'),
  ('brou-tuapp', 'brou', 'TuApp', 'saldo', 'propia', null, null, true, 'https://www.brou.com.uy/personas/beneficios/tuapp'),
  ('brou-visa-black', 'brou', 'BROU Visa Black', 'credito', 'visa', 'black', null, false, null),
  ('santander-visa', 'santander', 'Soy Santander Internacional Visa', 'credito', 'visa', null, 'santander-soy', true, 'https://www.santander.com.uy/todas-las-tarjetas/tarjeta-soy-santander'),
  ('santander-mastercard', 'santander', 'Soy Santander Internacional Mastercard', 'credito', 'mastercard', null, 'santander-soy', true, 'https://www.santander.com.uy/todas-las-tarjetas/tarjeta-soy-santander'),
  ('santander-visa-platinum', 'santander', 'Soy Santander Platinum Visa', 'credito', 'visa', 'platinum', 'santander-soy-platinum', true, 'https://www.santander.com.uy/todas-las-tarjetas/tarjeta-soy-santander'),
  ('santander-mastercard-platinum', 'santander', 'Soy Santander Platinum Mastercard', 'credito', 'mastercard', 'platinum', 'santander-soy-platinum', true, 'https://www.santander.com.uy/todas-las-tarjetas/tarjeta-soy-santander'),
  ('santander-debito', 'santander', 'Débito Soy Santander', 'debito', 'visa', null, null, true, 'https://www.santander.com.uy/todas-las-cuentas/soy-santander'),
  ('santander-farmacard', 'santander', 'Farmacard Santander', 'credito', 'mastercard', null, null, true, 'https://www.santander.com.uy/todas-las-tarjetas/farmacard'),
  ('santander-hipermas', 'santander', 'Hipermás Santander', 'credito', 'mastercard', null, null, true, 'https://www.santander.com.uy/todas-las-tarjetas/hipermas'),
  ('santander-aadvantage-visa', 'santander', 'AAdvantage Visa', 'credito', 'visa', null, 'santander-aadvantage', true, 'https://www.santander.com.uy/todas-las-tarjetas/Tarjeta-Aadvantage'),
  ('santander-aadvantage-mastercard', 'santander', 'AAdvantage Mastercard', 'credito', 'mastercard', null, 'santander-aadvantage', true, 'https://www.santander.com.uy/todas-las-tarjetas/Tarjeta-Aadvantage'),
  ('santander-select', 'santander', 'Select Visa Infinite', 'credito', 'visa', 'infinite', 'santander-select', true, 'https://www.santander.com.uy/select/pack-trilogy-soy'),
  ('santander-select-mastercard-black', 'santander', 'Select Mastercard Black', 'credito', 'mastercard', 'black', 'santander-select', true, 'https://www.santander.com.uy/select/pack-trilogy-soy'),
  ('santander-select-debito', 'santander', 'Débito Select', 'debito', 'visa', null, 'santander-select', true, 'https://www.santander.com.uy/select/pack-trilogy-soy'),
  ('santander-private', 'santander', 'Private Banking Visa Infinite', 'credito', 'visa', 'infinite', 'santander-private', true, 'https://www.santander.com.uy/tarjetas/pack-trilogy-soy-private-banking'),
  ('santander-private-mastercard-black', 'santander', 'Private Banking Mastercard Black', 'credito', 'mastercard', 'black', 'santander-private', true, 'https://www.santander.com.uy/tarjetas/pack-trilogy-soy-private-banking'),
  ('santander-private-debito', 'santander', 'Débito Private Banking', 'debito', 'visa', null, 'santander-private', true, 'https://www.santander.com.uy/tarjetas/pack-trilogy-soy-private-banking'),
  ('santander-aadvantage-visa-infinite', 'santander', 'AAdvantage Visa Infinite', 'credito', 'visa', 'infinite', 'santander-aadvantage-trilogy', true, 'https://www.santander.com.uy/select/pack-trilogy-aadvantage'),
  ('santander-aadvantage-mastercard-black', 'santander', 'AAdvantage Mastercard Black', 'credito', 'mastercard', 'black', 'santander-aadvantage-trilogy', true, 'https://www.santander.com.uy/select/pack-trilogy-aadvantage'),
  ('santander-aadvantage-debito', 'santander', 'Débito Select AAdvantage', 'debito', 'visa', null, 'santander-aadvantage-trilogy', true, 'https://www.santander.com.uy/select/pack-trilogy-aadvantage'),
  ('santander-amex', 'santander', 'American Express Santander', 'credito', 'amex', null, null, false, null),
  ('scotiabank-amex-gold', 'scotiabank', 'American Express Gold Scotiabank', 'credito', 'amex', 'gold', null, true, 'https://www.scotiabank.com.uy/Personas/Tarjetas/Tipos-de-tarjetas/american-express/amex-gold'),
  ('scotiabank-amex-platinum', 'scotiabank', 'The Platinum Card American Express Scotiabank', 'credito', 'amex', 'platinum', null, true, 'https://www.scotiabank.com.uy/Personas/Tarjetas/Tipos-de-tarjetas/american-express/amex-metal'),
  ('scotiabank-amex-copa-platinum', 'scotiabank', 'American Express Copa Platinum Scotiabank', 'credito', 'amex', 'platinum', null, true, 'https://www.scotiabank.com.uy/Personas/Tarjetas/Tipos-de-tarjetas/american-express/amex-copa-platinum'),
  ('scotiabank-visa-platinum', 'scotiabank', 'Visa Platinum Scotiabank', 'credito', 'visa', 'platinum', null, true, 'https://www.scotiabank.com.uy/Personas/Tarjetas/Tipos-de-tarjetas/visa/visa-platinum'),
  ('scotiabank-visa-infinite', 'scotiabank', 'Visa Infinite Scotiabank', 'credito', 'visa', 'infinite', null, true, 'https://www.scotiabank.com.uy/Personas/Tarjetas/Tipos-de-tarjetas/visa/visa-infinite'),
  ('scotiabank-amex', 'scotiabank', 'American Express Scotiabank', 'credito', 'amex', null, null, true, 'https://www.scotiabank.com.uy/Personas/Tarjetas/Tipos-de-tarjetas/american-express/amex-internacional'),
  ('scotiabank-debito-premium', 'scotiabank', 'Débito Premium Scotiabank', 'debito', 'visa', 'infinite', null, true, 'https://www.scotiabank.com.uy/Banca-Premium/Productos/Productos/paquete-premium'),
  ('scotiabank-debito', 'scotiabank', 'Débito Scotiabank', 'debito', 'visa', null, null, true, 'https://www.scotiabank.com.uy/Personas/Tarjetas/Tipos-de-tarjetas/visa/visa-debito'),
  ('scotiabank-visa', 'scotiabank', 'Visa Scotiabank', 'credito', 'visa', null, null, true, 'https://www.scotiabank.com.uy/Personas/Tarjetas/Tipos-de-tarjetas/visa/visa-internacional'),
  ('scotiabank-mastercard', 'scotiabank', 'Mastercard Scotiabank', 'credito', 'mastercard', null, null, true, 'https://www.scotiabank.com.uy/Personas/Tarjetas/Tipos-de-tarjetas/mastercard/master-internacional'),
  ('scotiabank-visa-gold', 'scotiabank', 'Visa Gold Scotiabank', 'credito', 'visa', 'gold', null, false, null),
  ('scotiabank-visa-signature', 'scotiabank', 'Visa Signature Scotiabank', 'credito', 'visa', 'signature', null, false, null),
  ('itau-debito-volar', 'itau', 'Visa Débito Volar', 'debito', 'visa', null, null, true, 'https://www.itau.com.uy/inst/abriTuCuenta.html'),
  ('itau-debito-junior', 'itau', 'Visa Débito Junior', 'debito', 'visa', null, null, true, 'https://www.itau.com.uy/inst/cuentaJunior.html'),
  ('itau-debito-sueldo', 'itau', 'Itaú Débito Sueldos', 'debito', 'visa', null, null, true, null),
  ('itau-alimentacion', 'itau', 'Itaú Tarjeta Alimentación', 'prepaga', 'visa', null, null, true, 'https://www.itau.com.uy/inst/tarjetaAlimentacion.html'),
  ('itau-visa', 'itau', 'Visa Volar Internacional', 'credito', 'visa', null, null, true, 'https://www.itau.com.uy/inst/tarjetaVolar.html'),
  ('itau-mastercard', 'itau', 'Mastercard Volar Internacional', 'credito', 'mastercard', null, null, true, 'https://www.itau.com.uy/inst/tarjetaVolar.html'),
  ('itau-visa-platinum', 'itau', 'Visa Volar Platinum', 'credito', 'visa', 'platinum', null, true, 'https://www.itau.com.uy/inst/tarjetaVolar.html'),
  ('itau-mastercard-black', 'itau', 'Mastercard Volar Black', 'credito', 'mastercard', 'black', null, true, 'https://www.itau.com.uy/inst/tarjetaVolar.html'),
  ('itau-latam-pass', 'itau', 'Visa LATAM Pass Internacional', 'credito', 'visa', null, null, true, 'https://www.itau.com.uy/inst/tarjetaLatam.html'),
  ('itau-latam-pass-platinum', 'itau', 'Visa LATAM Pass Platinum', 'credito', 'visa', 'platinum', null, true, 'https://www.itau.com.uy/inst/tarjetaLatam.html'),
  ('itau-visa-infinite-volar', 'itau', 'Visa Infinite Volar', 'credito', 'visa', 'infinite', 'itau-personal-bank', true, 'https://www.itau.com.uy/inst/personalBank_personal.html'),
  ('itau-latam-pass-infinite', 'itau', 'Visa LATAM Pass Infinite', 'credito', 'visa', 'infinite', 'itau-personal-bank', true, 'https://www.itau.com.uy/inst/personalBank_personal.html'),
  ('itau-debito-infinite', 'itau', 'Visa Débito Infinite Volar', 'debito', 'visa', 'infinite', 'itau-personal-bank', true, 'https://www.itau.com.uy/inst/personalBank_personal.html'),
  ('itau-debito-u25', 'itau', 'Itaú Débito U25', 'debito', 'visa', null, null, false, 'https://www.itau.com.uy/inst/cuentaU25.html'),
  ('itau-pocket', 'itau', 'Itaú Cuenta Pocket', 'debito', 'visa', null, null, false, 'https://www.itau.com.uy/inst/cuentapocket.html'),
  ('itau-personal-bank', 'itau', 'Itaú Personal Bank', 'debito', 'visa', null, null, false, 'https://www.itau.com.uy/inst/personalBank_personal.html'),
  ('itau-debito', 'itau', 'Débito Itaú', 'debito', 'visa', null, null, false, null),
  ('itau-visa-signature', 'itau', 'Itaú Visa Signature', 'credito', 'visa', 'signature', null, false, null),
  ('oca-blue-debito', 'oca', 'OCA Blue Débito', 'debito', 'visa', null, null, true, 'https://ocablue.uy/'),
  ('oca-mastercard', 'oca', 'OCA Mastercard', 'credito', 'mastercard', null, null, true, 'https://oca.uy/tarjeta-de-credito/'),
  ('oca-visa', 'oca', 'OCA Visa', 'credito', 'visa', null, null, true, 'https://oca.uy/tarjeta-de-credito/'),
  ('oca-blue', 'oca', 'OCA Blue', 'credito', 'propia', null, null, false, 'https://ocablue.uy/'),
  ('bbva-debito', 'bbva', 'Débito BBVA', 'debito', 'visa', null, null, true, 'https://www.bbva.com.uy/personas/productos/tarjetas/tarjeta-de-debito.html'),
  ('bbva-credito', 'bbva', 'Visa Internacional BBVA', 'credito', 'visa', null, 'bbva-internacional', true, 'https://www.bbva.com.uy/personas/productos/tarjetas/tarjeta-de-credito/tarjetas-visa/visa-internacional.html'),
  ('bbva-mastercard-internacional', 'bbva', 'Mastercard Internacional BBVA', 'credito', 'mastercard', null, 'bbva-internacional', true, 'https://www.bbva.com.uy/personas/productos/tarjetas/tarjeta-de-credito/tarjetas-mastercard-/mastercard-internacional.html'),
  ('bbva-oro', 'bbva', 'Visa Oro BBVA', 'credito', 'visa', 'gold', 'bbva-oro', true, 'https://www.bbva.com.uy/personas/productos/tarjetas/tarjeta-de-credito/tarjetas-visa/visa-oro.html'),
  ('bbva-mastercard-oro', 'bbva', 'Mastercard Oro BBVA', 'credito', 'mastercard', 'gold', 'bbva-oro', true, 'https://www.bbva.com.uy/personas/productos/tarjetas/tarjeta-de-credito/tarjetas-mastercard-/mastercard-oro.html'),
  ('bbva-mastercard-platinum', 'bbva', 'Mastercard Platinum BBVA', 'credito', 'mastercard', 'platinum', null, true, 'https://www.bbva.com.uy/personas/productos/tarjetas/tarjeta-de-credito/tarjetas-mastercard-/mastercard-platinum.html'),
  ('bbva-black', 'bbva', 'Mastercard Black BBVA', 'credito', 'mastercard', 'black', null, true, 'https://www.bbva.com.uy/personas/productos/tarjetas/tarjeta-de-credito/tarjetas-mastercard-/mastercard-black.html'),
  ('bbva-infinite', 'bbva', 'Visa Infinite BBVA', 'credito', 'visa', 'infinite', null, true, 'https://www.bbva.com.uy/personas/productos/tarjetas/tarjeta-de-credito/tarjetas-visa/visa-infinite.html'),
  ('bbva-comunidad-plus', 'bbva', 'Comunidad Plus BBVA (Ta-Ta)', 'credito', 'visa', null, null, true, 'https://www.bbva.com.uy/personas/productos/tarjetas/tarjeta-de-credito/tarjeta-comunidad-plus.html'),
  ('bbva-sodimac', 'bbva', 'BBVA Sodimac', 'credito', 'visa', null, null, true, 'https://www.bbva.com.uy/personas/productos/tarjetas/tarjeta-de-credito/sodimac.html'),
  ('bbva-consolid-travel', 'bbva', 'BBVA Consolid Travel Mastercard', 'credito', 'mastercard', null, 'bbva-consolid-travel', true, 'https://www.bbva.com.uy/personas/productos/tarjetas/tarjeta-de-credito/consolid-travel.html'),
  ('bbva-consolid-travel-visa', 'bbva', 'BBVA Consolid Travel Visa', 'credito', 'visa', null, 'bbva-consolid-travel', true, 'https://www.bbva.com.uy/personas/productos/tarjetas/tarjeta-de-credito/consolid-travel.html'),
  ('bbva-abtour-visa', 'bbva', 'BBVA Abtour Visa', 'credito', 'visa', null, 'bbva-abtour', true, 'https://www.bbva.com.uy/personas/productos/tarjetas/tarjeta-de-credito/abtour.html'),
  ('bbva-abtour-mastercard', 'bbva', 'BBVA Abtour Mastercard', 'credito', 'mastercard', null, 'bbva-abtour', true, 'https://www.bbva.com.uy/personas/productos/tarjetas/tarjeta-de-credito/abtour.html'),
  ('bbva-penarol-internacional', 'bbva', 'Peñarol BBVA Mastercard Internacional', 'credito', 'mastercard', null, null, true, 'https://www.bbva.com.uy/personas/productos/tarjetas/tarjeta-de-credito/tarjeta_peniarol.html'),
  ('bbva-penarol-oro', 'bbva', 'Peñarol BBVA Mastercard Oro', 'credito', 'mastercard', 'gold', null, true, 'https://www.bbva.com.uy/personas/productos/tarjetas/tarjeta-de-credito/tarjeta_peniarol.html'),
  ('bbva-penarol-platinum', 'bbva', 'Peñarol BBVA Mastercard Platinum', 'credito', 'mastercard', 'platinum', null, true, 'https://www.bbva.com.uy/personas/productos/tarjetas/tarjeta-de-credito/tarjeta_peniarol.html'),
  ('bbva-nacional-internacional', 'bbva', 'Nacional BBVA Mastercard Internacional', 'credito', 'mastercard', null, null, true, 'https://www.bbva.com.uy/personas/productos/tarjetas/tarjeta-de-credito/tarjeta_nacional.html'),
  ('bbva-nacional-oro', 'bbva', 'Nacional BBVA Mastercard Oro', 'credito', 'mastercard', 'gold', null, true, 'https://www.bbva.com.uy/personas/productos/tarjetas/tarjeta-de-credito/tarjeta_nacional.html'),
  ('bbva-nacional-platinum', 'bbva', 'Nacional BBVA Mastercard Platinum', 'credito', 'mastercard', 'platinum', null, true, 'https://www.bbva.com.uy/personas/productos/tarjetas/tarjeta-de-credito/tarjeta_nacional.html'),
  ('bbva-platinum', 'bbva', 'Visa Platinum BBVA', 'credito', 'visa', 'platinum', null, false, null),
  ('midinero-mastercard', 'midinero', 'Midinero Mastercard', 'prepaga', 'mastercard', null, null, true, 'https://www.midinero.com.uy/productos/midinero-tarjeta-prepaga-uruguay/'),
  ('midinero-alimentacion', 'midinero', 'Midinero Alimentación', 'prepaga', 'mastercard', null, null, true, 'https://www.midinero.com.uy/productos/midinero-alimentacion/'),
  ('prex-saldo', 'prex', 'Saldo Prex', 'saldo', 'propia', null, null, true, 'https://www.prexcard.com/toke'),
  ('prex-mastercard', 'prex', 'Prex Mastercard', 'prepaga', 'mastercard', null, null, true, 'https://www.prexcard.com/')
on conflict (id) do update
  set fuente_id = excluded.fuente_id, nombre = excluded.nombre, instrumento = excluded.instrumento,
      red = excluded.red, tier = excluded.tier, familia = excluded.familia,
      activo = excluded.activo, url_oficial = excluded.url_oficial;

-- 2. Equivalencias viejo → nuevo --------------------------------------------
-- Las mismas que EQUIVALENCIAS_PRODUCTO en @tarjetazo/core, salvo las de
-- Santander Select/Private: esas ya se aplicaron en 20260925120100 y hoy
-- `santander-select` es un plástico, así que volver a expandirlo estaría mal.
-- Un id que no figura en su propia lista es una baja y sale de la lista.
create temporary table equivalencia (viejo text primary key, nuevos text[] not null) on commit drop;
insert into equivalencia values
  ('bbva-consolid-travel', array['bbva-consolid-travel', 'bbva-consolid-travel-visa']),
  ('santander-amex', array[]::text[]),
  ('brou-visa-black', array[]::text[]),
  ('scotiabank-visa-gold', array[]::text[]),
  ('scotiabank-visa-signature', array[]::text[]),
  ('itau-visa-signature', array['itau-visa-infinite-volar', 'itau-latam-pass-infinite']),
  ('bbva-platinum', array['bbva-mastercard-platinum']),
  ('itau-debito', array['itau-debito-volar']),
  ('itau-debito-u25', array['itau-debito-volar']),
  ('itau-pocket', array['itau-debito-volar']),
  ('itau-personal-bank', array['itau-visa-infinite-volar', 'itau-latam-pass-infinite', 'itau-debito-infinite']),
  ('oca-blue', array['oca-blue-debito']);

-- Lista nueva: lo que no es baja, más los equivalentes de lo que había.
-- Devuelve null si queda vacía (vacío es "todas las de la fuente": nunca se
-- escribe, y la fila queda como estaba para revisarla a mano).
create or replace function pg_temp.remapear (p text[]) returns text[] language sql stable as $$
  select array_agg(distinct x order by x)
    from (
      select x from unnest(p) x
       where not exists (select 1 from equivalencia e where e.viejo = x and not x = any (e.nuevos))
      union
      select n from equivalencia e, unnest(e.nuevos) n where e.viejo = any (p)
    ) s;
$$;

-- Personal Bank en una lista de débito genérica ("tarjetas de débito Itaú",
-- que trae también la Volar) es solo la débito del paquete, no las de crédito.
update beneficio
   set productos_elegibles = array_replace(productos_elegibles, 'itau-personal-bank', 'itau-debito-infinite')
 where 'itau-personal-bank' = any (productos_elegibles)
   and 'itau-debito-volar' = any (productos_elegibles);

update beneficio
   set productos_elegibles = pg_temp.remapear(productos_elegibles)
 where productos_elegibles && (select array_agg(viejo) from equivalencia)
   and cardinality(pg_temp.remapear(productos_elegibles)) > 0
   and pg_temp.remapear(productos_elegibles) is distinct from (select array_agg(distinct x order by x) from unnest(productos_elegibles) x);

update producto_alias
   set producto_ids = pg_temp.remapear(producto_ids)
 where producto_ids && (select array_agg(viejo) from equivalencia)
   and cardinality(pg_temp.remapear(producto_ids)) > 0
   and pg_temp.remapear(producto_ids) is distinct from (select array_agg(distinct x order by x) from unnest(producto_ids) x);

-- 3. BROU Mastercard Débito ---------------------------------------------------
-- "Mastercard débito" a secas iba a la Recompensa Débito; vale también para la
-- débito sin puntos. Si el texto nombra Recompensa, es solo la del programa.
update beneficio
   set productos_elegibles = (
     select array_agg(distinct x order by x) from unnest(productos_elegibles || array['brou-mastercard-debito']) x)
 where fuente_id = 'brou'
   and 'brou-recompensa-debito' = any (productos_elegibles)
   and not 'brou-mastercard-debito' = any (productos_elegibles)
   and lower(descuento_raw || ' ' || coalesce(legales_raw, '')) !~ 'recompensa';

-- 4. Fichas ------------------------------------------------------------------
-- Sin la Visa, la Mastercard Platinum de BBVA es su propia familia.
update producto_ficha set familia_id = 'bbva-mastercard-platinum'
 where familia_id = 'bbva-platinum'
   and not exists (select 1 from producto_ficha where familia_id = 'bbva-mastercard-platinum');
update producto_ficha_sugerencia set familia_id = 'bbva-mastercard-platinum' where familia_id = 'bbva-platinum';
-- La de OCA Blue repetía la de la débito (misma foto, sin datos). Las de las
-- cuentas de Itaú (U25, Pocket, Débito) quedan: no se muestran y guardan datos
-- cargados a mano. La de Personal Bank sigue siendo la del paquete.
delete from producto_ficha where familia_id = 'oca-blue';
