-- Midinero (Redpagos), primera fuente de #10: prepaga Mastercard con ~35
-- beneficios, casi todos de comercios de Rocha que no cubre ningún banco. Se
-- lee con un parser propio (plantilla fija), sin modelo.
insert into fuente (id, nombre, tipo, logo_url, url, activa) values
  ('midinero', 'Midinero', 'billetera', null, 'https://www.midinero.com.uy', true)
on conflict (id) do update set nombre = excluded.nombre, url = excluded.url, activa = excluded.activa;

insert into producto (id, fuente_id, nombre, instrumento, red, tier) values
  ('midinero-mastercard', 'midinero', 'Midinero Mastercard', 'prepaga', 'mastercard', null)
on conflict (id) do update
  set nombre = excluded.nombre, instrumento = excluded.instrumento, red = excluded.red, tier = excluded.tier;
