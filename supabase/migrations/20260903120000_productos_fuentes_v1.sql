-- Productos que nombran las fuentes nuevas y no estaban en el catálogo inicial,
-- que era una aproximación. Lo que igual no mapee sigue cayendo en
-- beneficio_revision, que es donde queremos verlo.

-- Itaú: la línea de débito tiene nombre propio (Volar) y hay una tarjeta de
-- alimentación, que en el feed es una lista aparte.
insert into producto (id, fuente_id, nombre, instrumento, red, tier) values
  ('itau-debito-volar',   'itau', 'Itaú Débito Volar',        'debito',  'mastercard', null),
  ('itau-debito-junior',  'itau', 'Itaú Débito Junior',       'debito',  'mastercard', null),
  ('itau-debito-sueldo',  'itau', 'Itaú Débito Sueldos',      'debito',  'mastercard', null),
  ('itau-pocket',         'itau', 'Itaú Cuenta Pocket',       'debito',  'mastercard', null),
  ('itau-alimentacion',   'itau', 'Itaú Tarjeta Alimentación','prepaga', 'mastercard', null),
  ('itau-personal-bank',  'itau', 'Itaú Personal Bank',       'debito',  'mastercard', null),
  ('itau-visa-platinum',  'itau', 'Itaú Visa Platinum',       'credito', 'visa',       'platinum'),
  ('itau-visa-signature', 'itau', 'Itaú Visa Signature',      'credito', 'visa',       'signature'),

  -- Santander segmenta por paquete además de por tarjeta.
  ('santander-select',    'santander', 'Santander Select',          'credito', 'visa', 'platinum'),
  ('santander-private',   'santander', 'Santander Private Banking', 'credito', 'visa', 'black'),
  ('santander-mastercard-platinum', 'santander', 'Mastercard Platinum Santander', 'credito', 'mastercard', 'platinum'),

  -- OCA tiene su cuenta Blue como medio de pago propio, además de las tarjetas.
  ('oca-blue-debito',     'oca', 'OCA Blue Débito', 'debito', 'mastercard', null)
on conflict (id) do update
  set nombre = excluded.nombre, instrumento = excluded.instrumento,
      red = excluded.red, tier = excluded.tier;
