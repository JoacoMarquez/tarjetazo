-- Pronto+, sexta fuente de #10: ~100 promos por comercio de la Visa de la
-- financiera Pronto, escritas a mano en una página cada una. Parser con reglas,
-- sin modelo.
insert into fuente (id, nombre, tipo, logo_url, url, activa) values
  ('pronto', 'Pronto+', 'emisor', null, 'https://www.pronto.com.uy', true)
on conflict (id) do update set nombre = excluded.nombre, url = excluded.url, activa = excluded.activa;

insert into producto (id, fuente_id, nombre, instrumento, red, tier, url_oficial) values
  ('pronto-visa', 'pronto', 'Visa Pronto+', 'credito', 'visa', null, 'https://www.pronto.com.uy/promos-tarjeta/'),
  ('pronto-visa-premium', 'pronto', 'Visa Pronto+ Premium', 'credito', 'visa', null, 'https://www.pronto.com.uy/tarjeta-premium/')
on conflict (id) do update
  set nombre = excluded.nombre, instrumento = excluded.instrumento, red = excluded.red, tier = excluded.tier,
      url_oficial = excluded.url_oficial;
