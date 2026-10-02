-- registrar_busqueda_vacia tenía EXECUTE para anon: cualquiera podía anotar
-- términos sin pasar por el chequeo de /api/buscar ("tampoco aparece sin
-- filtros") y gastar el tope diario de 1000 términos, que es uno solo para
-- todos. Ahora la llama solo el servidor (service role) desde /api/buscar.

revoke execute on function registrar_busqueda_vacia(text) from public, anon, authenticated;
grant execute on function registrar_busqueda_vacia(text) to service_role;

-- Y sale de las RPC permitidas con la anon key (20261114150000).
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
      'comparar_fuentes', 'sucursales_de_comercio', 'sucursales_en_bbox'
    ) then
      raise exception 'recurso no disponible' using errcode = '42501';
    end if;
  end if;
end;
$$;
