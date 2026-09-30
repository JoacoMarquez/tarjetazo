-- PostGIS y pg_trgm se crearon en `public` (init.sql), el schema que expone la
-- API. Sus objetos no pasan por el modelo de RLS y grants de las migraciones:
--
-- * `spatial_ref_sys` no tiene RLS y hereda los grants por defecto de quien la
--   creó. Lectura sí (PostGIS la consulta al transformar coordenadas); escribir,
--   solo el dueño.
-- * Las funciones generadoras de PostGIS se pueden llamar por RPC con la anon
--   key y el que llama elige cuánto trabajo hacen. La app no las usa.
--
-- Se revoca solo si el objeto está en `public`: si las extensiones viven en
-- otro schema (no expuesto), no hay nada que hacer.

do $$
begin
  if to_regclass('public.spatial_ref_sys') is not null then
    revoke insert, update, delete, truncate on public.spatial_ref_sys from public, anon, authenticated;
  end if;
end;
$$;

do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('st_squaregrid', 'st_hexagongrid', 'st_generatepoints')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;
