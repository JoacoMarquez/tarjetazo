-- BROU también tiene el tier Oro ("Visa y Mastercard Oro"), que faltaba: la
-- primera corrida lo mandó a beneficio_revision.
insert into producto (id, fuente_id, nombre, instrumento, red, tier) values
  ('brou-visa-gold',        'brou', 'BROU Visa Oro',                   'credito', 'visa',       'gold'),
  ('brou-recompensa-gold',  'brou', 'BROU Recompensa Mastercard Oro',  'credito', 'mastercard', 'gold')
on conflict (id) do update
  set nombre = excluded.nombre, instrumento = excluded.instrumento,
      red = excluded.red, tier = excluded.tier;
