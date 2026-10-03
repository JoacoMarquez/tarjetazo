-- El mismo local cargado dos veces porque cada fuente escribe la dirección a
-- su manera: "Av. Italia 4348, Montevideo" y "Avenida Italia 4348". La
-- unicidad era por texto exacto; ahora se compara una clave normalizada.
--
-- Solo cuenta como el mismo local si la dirección tiene número de puerta: sin
-- número ("Avenida General Artigas") la misma calle puede tener varios locales
-- a kilómetros. Y si los dos tienen punto, a no más de 200 m (un geocoding
-- impreciso, no otro local). La cercanía sola no alcanza: el geocoder deja en
-- el mismo punto direcciones distintas ("Ruta 101 km 25.800" y "km 22.400").

-- "Av. Italia 4348, Montevideo" → "avenida italia 4348": primer tramo antes de
-- la coma, minúsculas, sin tildes ni signos, abreviaturas comunes expandidas.
create or replace function clave_direccion (d text)
returns text language sql immutable as $$
  select btrim(
    regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
      translate(lower(split_part(coalesce(d, ''), ',', 1)), 'áéíóúüñ', 'aeiouun'),
      '[^a-z0-9 ]', ' ', 'g'),
      '\m(avda|av|ave)\M', 'avenida', 'g'),
      '\m(bvar|blvr|bv|blvd|bulevard|boulevard)\M', 'bulevar', 'g'),
      '\mgral\M', 'general', 'g'),
      '\mdr\M', 'doctor', 'g'),
      '\m(pte|pdte)\M', 'presidente', 'g'),
      '\s+', ' ', 'g'));
$$;

create or replace function misma_sucursal (
  dir_a text, geom_a geography, dir_b text, geom_b geography
)
returns boolean language sql immutable as $$
  select dir_a = dir_b
      or (clave_direccion(dir_a) = clave_direccion(dir_b)
          and clave_direccion(dir_a) ~ '\d+( bis)?$'
          and (geom_a is null or geom_b is null or st_dwithin(geom_a, geom_b, 200)));
$$;

-- Venga de donde venga (fuente, geocoding de direcciones, sugerencia de OSM),
-- un local que ya existe no se vuelve a insertar.
create or replace function sucursal_sin_duplicar ()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from sucursal s
     where s.comercio_key = new.comercio_key
       and s.departamento = new.departamento
       -- El upsert de OSM (on conflict osm_id) actualiza su propia fila: no es un duplicado.
       and (new.osm_id is null or s.osm_id is distinct from new.osm_id)
       and misma_sucursal(s.direccion, s.geom, new.direccion, new.geom)
  ) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists sucursal_sin_duplicar on sucursal;
create trigger sucursal_sin_duplicar before insert on sucursal
  for each row execute function sucursal_sin_duplicar();

-- La fusión de comercios usa la misma regla (antes, texto exacto).
create or replace function fusionar_comercios (p_origen text, p_destino text)
returns table (beneficios int, sucursales int)
language plpgsql as $$
declare
  v_beneficios int;
  v_sucursales int;
begin
  if p_origen = p_destino then raise exception 'origen y destino son el mismo comercio'; end if;
  if not exists (select 1 from comercio where key = p_destino) then raise exception 'no existe el comercio %', p_destino; end if;
  if not exists (select 1 from comercio where key = p_origen) then raise exception 'no existe el comercio %', p_origen; end if;

  -- Los alias que apuntaban al que desaparece pasan al que queda (sin cadenas).
  update comercio_alias set comercio_key = p_destino where comercio_key = p_origen;
  insert into comercio_alias (alias_key, comercio_key) values (p_origen, p_destino)
  on conflict (alias_key) do update set comercio_key = excluded.comercio_key;

  update beneficio set comercio_key = p_destino, updated_at = now() where comercio_key = p_origen;
  get diagnostics v_beneficios = row_count;

  -- Sucursales: el mismo local en los dos queda una sola vez; lo que el
  -- duplicado tenía y el que queda no (punto, teléfono, horario) se conserva.
  update sucursal d
     set geom = coalesce(d.geom, s.geom),
         geocoded_at = coalesce(d.geocoded_at, s.geocoded_at),
         telefono = coalesce(d.telefono, s.telefono),
         horario = coalesce(d.horario, s.horario)
    from sucursal s
   where s.comercio_key = p_origen
     and d.comercio_key = p_destino
     and d.departamento = s.departamento
     and misma_sucursal(d.direccion, d.geom, s.direccion, s.geom);
  delete from sucursal s
   where s.comercio_key = p_origen
     and exists (select 1 from sucursal d
                  where d.comercio_key = p_destino
                    and d.departamento = s.departamento
                    and misma_sucursal(d.direccion, d.geom, s.direccion, s.geom));
  update sucursal set comercio_key = p_destino where comercio_key = p_origen;
  get diagnostics v_sucursales = row_count;

  delete from comercio where key = p_origen;
  perform recalcular_derivados_comercio(p_destino);
  return query select v_beneficios, v_sucursales;
end;
$$;

revoke execute on function fusionar_comercios(text, text) from public, anon, authenticated;
grant execute on function fusionar_comercios(text, text) to service_role;

-- Limpieza de los duplicados que ya hay (19 al 2026-10-03). Queda el que
-- tiene punto y más datos; recibe lo que le faltaba de los otros.
do $$
declare
  k record;
  afectados text[] := '{}';
begin
  for k in
    select s.* from sucursal s
     order by s.comercio_key, (s.geom is null), (s.telefono is null), (s.horario is null), s.id
  loop
    -- Puede haber sido borrado como duplicado de uno anterior.
    continue when not exists (select 1 from sucursal where id = k.id);
    if exists (select 1 from sucursal o
                where o.comercio_key = k.comercio_key and o.departamento = k.departamento and o.id <> k.id
                  and misma_sucursal(k.direccion, k.geom, o.direccion, o.geom)) then
      update sucursal set
        geom = coalesce(k.geom, (select o.geom from sucursal o where o.comercio_key = k.comercio_key and o.departamento = k.departamento and o.id <> k.id and o.geom is not null and misma_sucursal(k.direccion, k.geom, o.direccion, o.geom) limit 1)),
        telefono = coalesce(k.telefono, (select o.telefono from sucursal o where o.comercio_key = k.comercio_key and o.departamento = k.departamento and o.id <> k.id and o.telefono is not null and misma_sucursal(k.direccion, k.geom, o.direccion, o.geom) limit 1)),
        horario = coalesce(k.horario, (select o.horario from sucursal o where o.comercio_key = k.comercio_key and o.departamento = k.departamento and o.id <> k.id and o.horario is not null and misma_sucursal(k.direccion, k.geom, o.direccion, o.geom) limit 1))
      where id = k.id;
      delete from sucursal o
       where o.comercio_key = k.comercio_key and o.departamento = k.departamento and o.id <> k.id
         and misma_sucursal(k.direccion, k.geom, o.direccion, o.geom);
      afectados := array_append(afectados, k.comercio_key);
    end if;
  end loop;
  perform recalcular_derivados_comercio(c) from unnest(array(select distinct unnest(afectados))) c;
end $$;
