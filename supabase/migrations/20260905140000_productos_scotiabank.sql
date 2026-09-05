-- Scotiabank nombra sus tarjetas por tier y sello: Gold, Platinum, Infinite,
-- AMEX (con usuarios "Plus") y una débito Premium. Faltaban en el catálogo.
insert into producto (id, fuente_id, nombre, instrumento, red, tier) values
  ('scotiabank-visa-gold',       'scotiabank', 'Visa Gold Scotiabank',        'credito', 'visa',       'gold'),
  ('scotiabank-visa-platinum',   'scotiabank', 'Visa Platinum Scotiabank',    'credito', 'visa',       'platinum'),
  ('scotiabank-visa-infinite',   'scotiabank', 'Visa Infinite Scotiabank',    'credito', 'visa',       'black'),
  ('scotiabank-amex',            'scotiabank', 'American Express Scotiabank', 'credito', 'amex',       null),
  ('scotiabank-debito-premium',  'scotiabank', 'Débito Premium Scotiabank',   'debito',  'visa',       'platinum')
on conflict (id) do update
  set nombre = excluded.nombre, instrumento = excluded.instrumento,
      red = excluded.red, tier = excluded.tier;
