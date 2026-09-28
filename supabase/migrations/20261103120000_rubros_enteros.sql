-- Beneficios de rubro entero ("20% los lunes en todas las librerías"): un
-- comercio canónico por rubro, espejo de RUBROS_ENTEROS en @tarjetazo/core.
-- Salen en listados, búsqueda y comparador; no en el mapa (no tienen locales).
-- La página de cada comercio del rubro los muestra como "también aplica".
insert into comercio (key, nombre, categoria) values
  ('todo-supermercados', 'Todos los supermercados', 'supermercados'),
  ('todo-restaurantes', 'Todos los restaurantes', 'restaurantes'),
  ('todo-heladerias', 'Todas las heladerías', 'restaurantes'),
  ('todo-combustible', 'Todas las estaciones de servicio', 'combustible'),
  ('todo-farmacias', 'Todas las farmacias', 'farmacias'),
  ('todo-opticas', 'Todas las ópticas', 'salud-belleza'),
  ('todo-peluquerias', 'Todas las peluquerías', 'salud-belleza'),
  ('todo-librerias', 'Todas las librerías', 'libreria-juguetes'),
  ('todo-cines-teatros', 'Todos los cines y teatros', 'entretenimiento'),
  ('todo-hoteles', 'Todos los hoteles', 'viajes'),
  ('todo-pasajes', 'Todas las empresas de transporte', 'transporte'),
  ('todo-telepeaje', 'Telepeaje', 'transporte')
on conflict (key) do update set nombre = excluded.nombre, categoria = excluded.categoria;

-- Los "comercios" que cada fuente ya cargaba como rubro entero se fusionan en
-- el canónico: el alias hace que la próxima corrida escriba ahí. No entran las
-- cadenas (Estaciones ANCAP, Cines del Este, "Supermercados seleccionados") ni
-- "Restaurantes" de Itaú, que son restaurantes concretos con el nombre perdido.
do $$
declare
  par text[];
begin
  foreach par slice 1 in array array[
    ['cines', 'todo-cines-teatros'],
    ['farmacias', 'todo-farmacias'],
    ['farmacias-y-perfumerias', 'todo-farmacias'],
    ['opticas', 'todo-opticas'],
    ['restaurantes-adheridos', 'todo-restaurantes'],
    ['restaurantes-en-maldonado', 'todo-restaurantes'],
    ['restaurantes-y-deliverys', 'todo-restaurantes'],
    ['combustible', 'todo-combustible'],
    ['estaciones-de-servicio', 'todo-combustible'],
    ['telepeaje', 'todo-telepeaje']
  ] loop
    if exists (select 1 from comercio where key = par[1]) then
      perform fusionar_comercios(par[1], par[2]);
    end if;
  end loop;
end $$;
