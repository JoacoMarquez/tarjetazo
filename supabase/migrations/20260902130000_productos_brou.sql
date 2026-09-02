-- Los productos de BROU del catálogo inicial eran genéricos ("Visa Gold BROU").
-- Los reales, según beneficios.brou.com.uy, son la línea Recompensa Mastercard y
-- Visa con tiers Platinum/Black, más MI BROU y TuApp.

delete from producto where fuente_id = 'brou';

insert into producto (id, fuente_id, nombre, instrumento, red, tier) values
  ('brou-visa-debito',          'brou', 'BROU Visa Débito',                   'debito',  'visa',       null),
  ('brou-visa',                 'brou', 'BROU Visa',                          'credito', 'visa',       null),
  ('brou-visa-platinum',        'brou', 'BROU Visa Platinum',                 'credito', 'visa',       'platinum'),
  ('brou-visa-black',           'brou', 'BROU Visa Black',                    'credito', 'visa',       'black'),
  ('brou-recompensa-debito',    'brou', 'BROU Recompensa Mastercard Débito',  'debito',  'mastercard', null),
  ('brou-recompensa',           'brou', 'BROU Recompensa Mastercard',         'credito', 'mastercard', null),
  ('brou-recompensa-platinum',  'brou', 'BROU Recompensa Mastercard Platinum','credito', 'mastercard', 'platinum'),
  ('brou-recompensa-black',     'brou', 'BROU Recompensa Mastercard Black',   'credito', 'mastercard', 'black'),
  ('brou-mi-brou',              'brou', 'MI BROU Tarjeta Joven',              'prepaga', 'propia',     null),
  ('brou-tuapp',                'brou', 'TuApp',                              'saldo',   'propia',     null)
on conflict (id) do update
  set nombre = excluded.nombre, instrumento = excluded.instrumento,
      red = excluded.red, tier = excluded.tier;
