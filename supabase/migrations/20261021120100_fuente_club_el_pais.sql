-- Club El País, tercera fuente de #10: ~180 comercios con descuento fijo para
-- socios (casi todos 20 %). Parser propio, sin modelo. Los "eventos" del sitio
-- (2x1 en entradas) no se cargan.
insert into fuente (id, nombre, tipo, logo_url, url, activa) values
  ('club-el-pais', 'Club El País', 'club', null, 'https://www.clubelpais.com.uy', true)
on conflict (id) do update set nombre = excluded.nombre, url = excluded.url, activa = excluded.activa;

insert into producto (id, fuente_id, nombre, instrumento, red, tier, url_oficial) values
  ('club-el-pais-socio', 'club-el-pais', 'Socio Club El País', 'membresia', 'propia', null, 'https://www.clubelpais.com.uy/suscribite/')
on conflict (id) do update
  set nombre = excluded.nombre, instrumento = excluded.instrumento, red = excluded.red, tier = excluded.tier,
      url_oficial = excluded.url_oficial;
