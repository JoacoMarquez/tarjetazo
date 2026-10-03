-- Cinco rubros enteros más (espejo de RUBROS_ENTEROS en @tarjetazo/core):
-- Nativa publica "hasta 6 cuotas en todo el país" en zapaterías, veterinarias,
-- talleres, mutualistas y barracas/ferreterías/pinturerías, con un listado de
-- adheridos. Sin comercio canónico, esos beneficios no se publicaban.
insert into comercio (key, nombre, categoria) values
  ('todo-zapaterias', 'Todas las zapaterías', 'indumentaria'),
  ('todo-veterinarias', 'Todas las veterinarias', 'mascotas'),
  ('todo-talleres', 'Todos los talleres mecánicos y repuestos', 'servicios'),
  ('todo-mutualistas', 'Todas las mutualistas y servicios médicos', 'salud-belleza'),
  ('todo-ferreterias', 'Todas las barracas, ferreterías y pinturerías', 'hogar-deco')
on conflict (key) do update set nombre = excluded.nombre, categoria = excluded.categoria;

-- Los "comercios" que Nativa cargaba con el nombre del rubro pasan al
-- canónico; el alias deja las URLs viejas redirigiendo.
do $$
declare
  par text[];
begin
  foreach par slice 1 in array array[
    ['zapaterias', 'todo-zapaterias'],
    ['veterinarias', 'todo-veterinarias'],
    ['talleres-mecanicos', 'todo-talleres'],
    ['mutualistas-y-servicios-medicos', 'todo-mutualistas'],
    ['pinta-repara-y-renova-tu-casa', 'todo-ferreterias']
  ] loop
    if exists (select 1 from comercio where key = par[1]) then
      perform fusionar_comercios(par[1], par[2]);
    end if;
  end loop;
end $$;
