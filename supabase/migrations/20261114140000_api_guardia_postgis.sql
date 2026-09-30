-- 20261114130000_extensiones_public.sql no alcanzó: en Supabase, `spatial_ref_sys`
-- y las funciones de PostGIS son de `supabase_admin`, y las migraciones corren
-- como `postgres`, que no puede revocarles permisos. Anon sigue pudiendo
-- escribir `spatial_ref_sys` (sin RLS) y llamar las funciones generadoras.
--
-- Lo que sí está a nuestro alcance es la API: PostgREST corre una función antes
-- de cada pedido (`db-pre-request`), con el rol del pedido. Esta corta los que
-- van a esos objetos. Vive en un schema que la API no expone.
--
-- Para sacarla, si algún día hiciera falta:
--   alter role authenticator reset pgrst.db_pre_request;
--   notify pgrst, 'reload config';

create schema if not exists api_guardia;
grant usage on schema api_guardia to anon, authenticated, service_role;

create or replace function api_guardia.antes_de_pedido ()
returns void language plpgsql stable as $$
declare
  -- La ruta que ve PostgREST, sin `/rest/v1`: `/spatial_ref_sys`, `/rpc/<función>`.
  ruta text := lower(coalesce(current_setting('request.path', true), ''));
  hex text;
begin
  -- Por si llega sin decodificar (`/%73patial_ref_sys`): se decodifica acá.
  for i in 1..200 loop
    hex := substring(ruta from '%([0-9a-f]{2})');
    exit when hex is null;
    ruta := regexp_replace(ruta, '%[0-9a-f]{2}', lower(chr(('x' || hex)::bit(8)::int)));
  end loop;
  ruta := rtrim(ruta, '/');
  if ruta ~ '(^|[/.])spatial_ref_sys$'
     or ruta ~ '/rpc/+([a-z_]+\.)?st_(squaregrid|hexagongrid|generatepoints)$' then
    raise exception 'recurso no disponible' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function api_guardia.antes_de_pedido () from public;
grant execute on function api_guardia.antes_de_pedido () to anon, authenticated, service_role;

alter role authenticator set pgrst.db_pre_request = 'api_guardia.antes_de_pedido';
notify pgrst, 'reload config';
