-- BBVA: la fuente que faltaba entre los bancos grandes. Sus beneficios
-- distinguen tres grupos de tarjetas: débito; crédito Internacional, Oro,
-- Pymes y Corporativas; y crédito Platinum, Black e Infinite.
insert into fuente (id, nombre, tipo, logo_url, url, activa) values
  ('bbva', 'BBVA', 'banco', '/logos/bbva.svg', 'https://www.bbva.com.uy', true)
on conflict (id) do update set nombre = excluded.nombre, url = excluded.url, activa = excluded.activa;

insert into producto (id, fuente_id, nombre, instrumento, red, tier) values
  ('bbva-debito',             'bbva', 'Débito BBVA',                      'debito',  'visa',       null),
  ('bbva-credito',            'bbva', 'Crédito Internacional BBVA',       'credito', 'visa',       null),
  ('bbva-oro',                'bbva', 'Crédito Oro BBVA',                 'credito', 'visa',       'gold'),
  ('bbva-platinum',           'bbva', 'Crédito Platinum BBVA',            'credito', 'visa',       'platinum'),
  ('bbva-black',              'bbva', 'Mastercard Black BBVA',            'credito', 'mastercard', 'black'),
  ('bbva-infinite',           'bbva', 'Visa Infinite BBVA',               'credito', 'visa',       'black')
on conflict (id) do update
  set nombre = excluded.nombre, instrumento = excluded.instrumento,
      red = excluded.red, tier = excluded.tier;
