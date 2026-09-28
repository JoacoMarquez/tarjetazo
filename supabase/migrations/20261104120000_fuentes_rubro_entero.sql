-- Creditel y Passcard: publican solo promos de rubro entero ("Lunes de
-- librerías, 20%"), que van a los comercios canónicos todo-<rubro>
-- (20261103120000_rubros_enteros). Parser propio, sin modelo.
insert into fuente (id, nombre, tipo, logo_url, url, activa) values
  ('creditel', 'Creditel', 'emisor', null, 'https://www.creditel.com.uy', true),
  ('passcard', 'Passcard', 'emisor', null, 'https://www.passcard.com.uy', true)
on conflict (id) do update set nombre = excluded.nombre, url = excluded.url, activa = excluded.activa;

insert into producto (id, fuente_id, nombre, instrumento, red, tier, url_oficial) values
  ('creditel-mastercard', 'creditel', 'Creditel Mastercard', 'credito', 'mastercard', null, 'https://www.creditel.com.uy/tarjeta'),
  ('passcard-clasica', 'passcard', 'Passcard', 'credito', 'propia', null, 'https://www.passcard.com.uy/tarjeta/beneficios'),
  ('passcard-like', 'passcard', 'Passcard Like', 'credito', 'propia', null, 'https://www.passcard.com.uy/tarjeta/beneficios'),
  ('passcard-experta', 'passcard', 'Passcard Experta', 'credito', 'propia', null, 'https://www.passcard.com.uy/tarjeta/beneficios'),
  ('passcard-black', 'passcard', 'Passcard Black', 'credito', 'propia', 'black', 'https://www.passcard.com.uy/tarjeta/beneficios')
on conflict (id) do update
  set nombre = excluded.nombre, instrumento = excluded.instrumento, red = excluded.red, tier = excluded.tier,
      url_oficial = excluded.url_oficial;
