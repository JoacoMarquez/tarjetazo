-- Santander tiene tarjetas de marca compartida (Farmacard, Hipermás) que sus
-- beneficios nombran y no estaban en el catálogo.
insert into producto (id, fuente_id, nombre, instrumento, red, tier) values
  ('santander-farmacard', 'santander', 'Farmacard Santander', 'credito', 'mastercard', null),
  ('santander-hipermas',  'santander', 'Hipermás Santander',  'credito', 'mastercard', null)
on conflict (id) do update
  set nombre = excluded.nombre, instrumento = excluded.instrumento,
      red = excluded.red, tier = excluded.tier;
