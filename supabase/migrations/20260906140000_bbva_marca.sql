-- Tarjetas de marca compartida de BBVA que sus fichas nombran en las cuotas.
insert into producto (id, fuente_id, nombre, instrumento, red, tier) values
  ('bbva-comunidad-plus', 'bbva', 'Comunidad Plus BBVA (Ta-Ta)', 'credito', 'mastercard', null),
  ('bbva-sodimac',        'bbva', 'BBVA Sodimac',                 'credito', 'mastercard', null),
  ('bbva-consolid-travel','bbva', 'BBVA Consolid Travel',         'credito', 'mastercard', null)
on conflict (id) do update
  set nombre = excluded.nombre, instrumento = excluded.instrumento, red = excluded.red, tier = excluded.tier;
