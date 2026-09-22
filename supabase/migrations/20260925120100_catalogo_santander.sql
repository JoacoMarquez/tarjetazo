-- Catálogo de Santander una fila por plástico, con familia (#40). Decisiones en
-- docs/04-backoffice.md → "Catálogo de tarjetas". Los ids existentes se
-- conservan; `santander-select` y `santander-private` pasan de "cualquier
-- tarjeta del pack" a la Visa Infinite del pack, y los beneficios que los
-- referenciaban reciben además los otros dos plásticos.

alter table producto
  add column if not exists familia     text,
  add column if not exists activo      boolean not null default true,
  add column if not exists url_oficial text;
create index if not exists producto_familia_idx on producto (fuente_id, familia);

insert into producto (id, fuente_id, nombre, instrumento, red, tier, familia, url_oficial) values
  ('santander-visa', 'santander', 'Soy Santander Internacional Visa', 'credito', 'visa', null, 'santander-soy', 'https://www.santander.com.uy/todas-las-tarjetas/tarjeta-soy-santander'),
  ('santander-mastercard', 'santander', 'Soy Santander Internacional Mastercard', 'credito', 'mastercard', null, 'santander-soy', 'https://www.santander.com.uy/todas-las-tarjetas/tarjeta-soy-santander'),
  ('santander-visa-platinum', 'santander', 'Soy Santander Platinum Visa', 'credito', 'visa', 'platinum', 'santander-soy-platinum', 'https://www.santander.com.uy/todas-las-tarjetas/tarjeta-soy-santander'),
  ('santander-mastercard-platinum', 'santander', 'Soy Santander Platinum Mastercard', 'credito', 'mastercard', 'platinum', 'santander-soy-platinum', 'https://www.santander.com.uy/todas-las-tarjetas/tarjeta-soy-santander'),
  ('santander-debito', 'santander', 'Débito Soy Santander', 'debito', 'mastercard', null, null, null),
  ('santander-farmacard', 'santander', 'Farmacard Santander', 'credito', 'mastercard', null, null, 'https://www.santander.com.uy/todas-las-tarjetas/farmacard'),
  ('santander-hipermas', 'santander', 'Hipermás Santander', 'credito', 'mastercard', null, null, 'https://www.santander.com.uy/todas-las-tarjetas/hipermas'),
  ('santander-amex', 'santander', 'American Express Santander', 'credito', 'amex', null, null, null),
  ('santander-aadvantage-visa', 'santander', 'AAdvantage Visa', 'credito', 'visa', null, 'santander-aadvantage', 'https://www.santander.com.uy/todas-las-tarjetas/Tarjeta-Aadvantage'),
  ('santander-aadvantage-mastercard', 'santander', 'AAdvantage Mastercard', 'credito', 'mastercard', null, 'santander-aadvantage', 'https://www.santander.com.uy/todas-las-tarjetas/Tarjeta-Aadvantage'),
  ('santander-select', 'santander', 'Select Visa Infinite', 'credito', 'visa', 'infinite', 'santander-select', 'https://www.santander.com.uy/select/pack-trilogy-soy'),
  ('santander-select-mastercard-black', 'santander', 'Select Mastercard Black', 'credito', 'mastercard', 'black', 'santander-select', 'https://www.santander.com.uy/select/pack-trilogy-soy'),
  ('santander-select-debito', 'santander', 'Débito Select', 'debito', 'visa', null, 'santander-select', 'https://www.santander.com.uy/select/pack-trilogy-soy'),
  ('santander-private', 'santander', 'Private Banking Visa Infinite', 'credito', 'visa', 'infinite', 'santander-private', 'https://www.santander.com.uy/tarjetas/pack-trilogy-soy-private-banking'),
  ('santander-private-mastercard-black', 'santander', 'Private Banking Mastercard Black', 'credito', 'mastercard', 'black', 'santander-private', 'https://www.santander.com.uy/tarjetas/pack-trilogy-soy-private-banking'),
  ('santander-private-debito', 'santander', 'Débito Private Banking', 'debito', 'visa', null, 'santander-private', 'https://www.santander.com.uy/tarjetas/pack-trilogy-soy-private-banking'),
  ('santander-aadvantage-visa-infinite', 'santander', 'AAdvantage Visa Infinite', 'credito', 'visa', 'infinite', 'santander-aadvantage-trilogy', 'https://www.santander.com.uy/select/pack-trilogy-aadvantage'),
  ('santander-aadvantage-mastercard-black', 'santander', 'AAdvantage Mastercard Black', 'credito', 'mastercard', 'black', 'santander-aadvantage-trilogy', 'https://www.santander.com.uy/select/pack-trilogy-aadvantage'),
  ('santander-aadvantage-debito', 'santander', 'Débito Select AAdvantage', 'debito', 'visa', null, 'santander-aadvantage-trilogy', 'https://www.santander.com.uy/select/pack-trilogy-aadvantage')
on conflict (id) do update
  set nombre = excluded.nombre, instrumento = excluded.instrumento, red = excluded.red,
      tier = excluded.tier, familia = excluded.familia, url_oficial = excluded.url_oficial,
      activo = true;

-- Equivalencias viejo → nuevo (misma tabla que EQUIVALENCIAS_PRODUCTO en @tarjetazo/core).
update beneficio
   set productos_elegibles = (
     select array_agg(distinct x order by x)
       from unnest(productos_elegibles || array['santander-select-mastercard-black', 'santander-select-debito']) x)
 where 'santander-select' = any (productos_elegibles);

update beneficio
   set productos_elegibles = (
     select array_agg(distinct x order by x)
       from unnest(productos_elegibles || array['santander-private-mastercard-black', 'santander-private-debito']) x)
 where 'santander-private' = any (productos_elegibles);
