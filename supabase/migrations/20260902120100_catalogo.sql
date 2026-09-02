-- Catálogo base (hito 1): rubros, fuentes y productos.
-- Va como migración y no como seed porque son datos de referencia que necesita
-- cualquier entorno. Es idempotente (upsert), así que se puede reaplicar.
-- Espejo de packages/core/src/categorias.ts y fuentes.ts: si cambiás uno, cambiá el otro.

insert into categoria (slug, label, orden, en_home) values
  ('supermercados',      'Supermercados',            1,  true),
  ('restaurantes',       'Restaurantes',             2,  true),
  ('cafeterias',         'Cafeterías',               3,  true),
  ('delivery',           'Delivery',                 4,  true),
  ('combustible',        'Combustible',              5,  true),
  ('farmacias',          'Farmacias',                6,  true),
  ('indumentaria',       'Indumentaria',             7,  true),
  ('electro-tecnologia', 'Electro y tecnología',     8,  true),
  ('hogar-deco',         'Hogar y deco',             9,  false),
  ('viajes',             'Viajes',                   10, false),
  ('transporte',         'Transporte',               11, false),
  ('entretenimiento',    'Entretenimiento',          12, false),
  ('salud-belleza',      'Salud y belleza',          13, false),
  ('deportes',           'Deportes',                 14, false),
  ('mascotas',           'Mascotas',                 15, false),
  ('libreria-juguetes',  'Librerías y jugueterías',  16, false),
  ('servicios',          'Servicios',                17, false),
  ('otros',              'Otros',                    18, false)
on conflict (slug) do update
  set label = excluded.label, orden = excluded.orden, en_home = excluded.en_home;

insert into fuente (id, nombre, tipo, logo_url, url, activa) values
  ('brou',       'BROU',       'banco',     '/logos/brou.svg',       'https://www.brou.com.uy',      true),
  ('santander',  'Santander',  'banco',     '/logos/santander.svg',  'https://www.santander.com.uy', true),
  ('scotiabank', 'Scotiabank', 'banco',     '/logos/scotiabank.svg', 'https://uy.scotiabank.com',    true),
  ('itau',       'Itaú',       'banco',     '/logos/itau.svg',       'https://www.itau.com.uy',      true),
  ('oca',        'OCA',        'emisor',    '/logos/oca.svg',        'https://www.oca.com.uy',       true),
  ('prex',       'Prex',       'billetera', '/logos/prex.svg',       'https://www.prexcard.com.uy',  true)
on conflict (id) do update
  set nombre = excluded.nombre, tipo = excluded.tipo, logo_url = excluded.logo_url,
      url = excluded.url, activa = excluded.activa;

insert into producto (id, fuente_id, nombre, instrumento, red, tier) values
  ('brou-debito',              'brou',       'Débito BROU',                    'debito',  'visa',       null),
  ('brou-visa',                'brou',       'Visa BROU',                      'credito', 'visa',       null),
  ('brou-visa-gold',           'brou',       'Visa Gold BROU',                 'credito', 'visa',       'gold'),
  ('brou-mastercard',          'brou',       'Mastercard BROU',                'credito', 'mastercard', null),
  ('brou-mastercard-black',    'brou',       'Mastercard Black BROU',          'credito', 'mastercard', 'black'),
  ('santander-debito',         'santander',  'Débito Santander',               'debito',  'mastercard', null),
  ('santander-visa',           'santander',  'Visa Santander',                 'credito', 'visa',       null),
  ('santander-visa-platinum',  'santander',  'Visa Platinum Santander',        'credito', 'visa',       'platinum'),
  ('santander-mastercard',     'santander',  'Mastercard Santander',           'credito', 'mastercard', null),
  ('santander-amex',           'santander',  'American Express Santander',     'credito', 'amex',       null),
  ('scotiabank-debito',        'scotiabank', 'Débito Scotiabank',              'debito',  'visa',       null),
  ('scotiabank-visa',          'scotiabank', 'Visa Scotiabank',                'credito', 'visa',       null),
  ('scotiabank-visa-signature','scotiabank', 'Visa Signature Scotiabank',      'credito', 'visa',       'signature'),
  ('scotiabank-mastercard',    'scotiabank', 'Mastercard Scotiabank',          'credito', 'mastercard', null),
  ('itau-debito',              'itau',       'Débito Itaú',                    'debito',  'mastercard', null),
  ('itau-visa',                'itau',       'Visa Itaú',                      'credito', 'visa',       null),
  ('itau-mastercard',          'itau',       'Mastercard Itaú',                'credito', 'mastercard', null),
  ('itau-mastercard-black',    'itau',       'Mastercard Black Itaú',          'credito', 'mastercard', 'black'),
  ('oca-blue',                 'oca',        'OCA Blue',                       'credito', 'propia',     null),
  ('oca-mastercard',           'oca',        'OCA Mastercard',                 'credito', 'mastercard', null),
  ('oca-visa',                 'oca',        'OCA Visa',                       'credito', 'visa',       null),
  ('prex-saldo',               'prex',       'Saldo Prex',                     'saldo',   'propia',     null),
  ('prex-mastercard',          'prex',       'Prex Mastercard',                'prepaga', 'mastercard', null)
on conflict (id) do update
  set nombre = excluded.nombre, instrumento = excluded.instrumento,
      red = excluded.red, tier = excluded.tier;
