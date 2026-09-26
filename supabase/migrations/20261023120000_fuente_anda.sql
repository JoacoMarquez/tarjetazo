-- ANDA, cuarta fuente de #10: ~540 beneficios (casi todos 20 % los jueves en
-- comercios del interior), leídos del admin-ajax de su WordPress por
-- departamento. Parser propio, sin modelo.
insert into fuente (id, nombre, tipo, logo_url, url, activa) values
  ('anda', 'ANDA', 'emisor', null, 'https://anda.com.uy', true)
on conflict (id) do update set nombre = excluded.nombre, url = excluded.url, activa = excluded.activa;

insert into producto (id, fuente_id, nombre, instrumento, red, tier, url_oficial) values
  ('anda-credito', 'anda', 'Tarjeta ANDA', 'credito', 'propia', null, 'https://anda.com.uy/tarjeta-de-credito/'),
  ('anda-visa', 'anda', 'ANDA VISA', 'credito', 'visa', null, 'https://anda.com.uy/tarjeta-de-credito/'),
  ('anda-deanda', 'anda', 'DEANDA Visa Prepaga', 'prepaga', 'visa', null, 'https://anda.com.uy/tarjeta-prepaga/')
on conflict (id) do update
  set nombre = excluded.nombre, instrumento = excluded.instrumento, red = excluded.red, tier = excluded.tier,
      url_oficial = excluded.url_oficial;
