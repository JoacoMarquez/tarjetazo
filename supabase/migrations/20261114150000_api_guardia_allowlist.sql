-- `api_guardia.antes_de_pedido` (20261114140000) cortaba spatial_ref_sys y tres
-- funciones de PostGIS por nombre. El resto de PostGIS y pg_trgm sigue en
-- `public` con EXECUTE para todos (son de supabase_admin: no se pueden revocar
-- desde acá), y varias dejan que el que llama elija cuánto trabajo hacen
-- (st_buffer, st_segmentize…). En vez de una lista de prohibidas, una de
-- permitidas: con la anon key (o una sesión de usuario) solo se pueden llamar
-- las RPC que usa la web. Service role (backoffice y scrapers) no cambia.
--
-- Al agregar una RPC pública nueva, sumarla acá.

create or replace function api_guardia.antes_de_pedido ()
returns void language plpgsql stable as $$
declare
  -- La ruta que ve PostgREST, sin `/rest/v1`: `/spatial_ref_sys`, `/rpc/<función>`.
  ruta text := lower(coalesce(current_setting('request.path', true), ''));
  hex text;
  funcion text;
begin
  -- Por si llega sin decodificar (`/%73patial_ref_sys`): se decodifica acá.
  for i in 1..200 loop
    hex := substring(ruta from '%([0-9a-f]{2})');
    exit when hex is null;
    ruta := regexp_replace(ruta, '%[0-9a-f]{2}', lower(chr(('x' || hex)::bit(8)::int)));
  end loop;
  ruta := rtrim(ruta, '/');

  if ruta ~ '(^|[/.])spatial_ref_sys$' then
    raise exception 'recurso no disponible' using errcode = '42501';
  end if;

  if current_user in ('anon', 'authenticated') and ruta ~ '^/+rpc(/|$)' then
    funcion := regexp_replace(ruta, '^/+rpc/+', '');
    if funcion not in (
      'beneficios_filtrados', 'beneficios_por_familia', 'beneficios_vistos_en', 'buscar_comercios',
      'comparar_fuentes', 'registrar_busqueda_vacia', 'sucursales_de_comercio', 'sucursales_en_bbox'
    ) then
      raise exception 'recurso no disponible' using errcode = '42501';
    end if;
  end if;
end;
$$;
