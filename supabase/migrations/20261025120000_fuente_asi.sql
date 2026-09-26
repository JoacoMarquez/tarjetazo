-- Club ASI, quinta fuente de #10: ~210 descuentos con locales geolocalizados,
-- leídos de la API JSON de Mashkady (la plataforma del club). Parser propio,
-- sin modelo. La tarjeta es una membresía: el descuento se pide con un código.
insert into fuente (id, nombre, tipo, logo_url, url, activa) values
  ('asi', 'Club ASI', 'club', null, 'https://www.asi-clubdescuentos.com.uy', true)
on conflict (id) do update set nombre = excluded.nombre, url = excluded.url, activa = excluded.activa;

insert into producto (id, fuente_id, nombre, instrumento, red, tier, url_oficial) values
  ('club-asi', 'asi', 'Cliente ASI', 'membresia', 'propia', null, 'https://asi.com.uy/')
on conflict (id) do update
  set nombre = excluded.nombre, instrumento = excluded.instrumento, red = excluded.red, tier = excluded.tier,
      url_oficial = excluded.url_oficial;
