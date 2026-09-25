-- Nativa (red Cabal), segunda fuente de #10: ~100 comercios con cuotas sin
-- recargo, "última cuota gratis" (guardada como reintegro equivalente, 1/N) y
-- descuentos. Parser propio, sin modelo.
insert into fuente (id, nombre, tipo, logo_url, url, activa) values
  ('nativa', 'Nativa', 'emisor', null, 'https://www.nativacabal.com.uy', true)
on conflict (id) do update set nombre = excluded.nombre, url = excluded.url, activa = excluded.activa;

insert into producto (id, fuente_id, nombre, instrumento, red, tier) values
  ('nativa-cabal', 'nativa', 'Nativa Cabal', 'credito', 'cabal', null)
on conflict (id) do update
  set nombre = excluded.nombre, instrumento = excluded.instrumento, red = excluded.red, tier = excluded.tier;
