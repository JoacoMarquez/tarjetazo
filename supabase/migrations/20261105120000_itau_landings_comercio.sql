-- Landings de Itaú: cada página es de un restaurante concreto ("Cauce
-- (restaurantes)" en la primera línea del crudo), pero el modelo tomó el rubro
-- como nombre y dejó sus beneficios en "Restaurantes" (y uno en "Restaurantes
-- Punta del Este"). Desde ahora el scraper fija el comercio de la página
-- (`Crudo.comercio`); esto corrige lo ya cargado.
--
-- La key sale del external_id (`landing-<slug del nombre>`), que el fetch arma
-- con el mismo slugificar que usa el runner. "Restaurantes" no se fusiona en
-- `todo-restaurantes`: le queda el beneficio del feed y los descartados de
-- páginas que ya no existen.
do $$
declare
  k text;
begin
  create temp table mover on commit drop as
  select b.id,
         b.comercio_key as antes,
         coalesce(a.comercio_key, substr(p.external_id, length('landing-') + 1)) as key,
         (regexp_match(split_part(p.contenido, E'\n', 1), '^(.*\S)\s*\(([^)]+)\)\s*$'))[1] as nombre,
         (regexp_match(split_part(p.contenido, E'\n', 1), '^(.*\S)\s*\(([^)]+)\)\s*$'))[2] as categoria
    from beneficio b
    join pagina_cruda p on p.fuente_id = b.fuente_id and p.external_id = split_part(b.id, ':', 2)
    left join comercio_alias a on a.alias_key = substr(p.external_id, length('landing-') + 1)
   where b.fuente_id = 'itau'
     and p.external_id like 'landing-%'
     and b.comercio_key in ('restaurantes', 'restaurantes-punta-del-este')
     and split_part(p.contenido, E'\n', 1) ~ '^.*\S\s*\([^)]+\)\s*$';

  insert into comercio (key, nombre, categoria)
  select distinct on (key) key, nombre, categoria from mover
  on conflict (key) do nothing;

  update beneficio b set comercio_key = m.key, updated_at = now()
    from mover m where b.id = m.id;

  for k in select key from mover union select antes from mover loop
    perform recalcular_derivados_comercio(k);
  end loop;

  -- "Restaurantes Punta del Este" solo existía por esa página.
  delete from comercio c
   where c.key = 'restaurantes-punta-del-este'
     and not exists (select 1 from beneficio b where b.comercio_key = c.key)
     and not exists (select 1 from sucursal s where s.comercio_key = c.key);
end $$;
