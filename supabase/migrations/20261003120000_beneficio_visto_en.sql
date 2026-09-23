-- Cuándo se vio por última vez en la fuente cada beneficio publicado (#12),
-- para mostrar "Actualizado: …" en la web. Sale de `pagina_cruda.fetched_at`,
-- que el runner actualiza cada vez que baja la página (cambie o no). La tabla
-- no es pública, así que va por una función que solo devuelve la fecha y solo
-- para beneficios publicados.
create or replace function beneficios_vistos_en (p_ids text[])
returns table (id text, visto_en timestamptz)
language sql stable security definer set search_path = public as $$
  select b.id, p.fetched_at
    from beneficio b
    join pagina_cruda p
      on p.fuente_id = b.fuente_id
     and starts_with(b.id, p.fuente_id || ':' || p.external_id || ':')
   where b.id = any (p_ids)
     and b.estado_revision = 'ok';
$$;

revoke execute on function beneficios_vistos_en(text[]) from public;
grant execute on function beneficios_vistos_en(text[]) to anon, authenticated, service_role;
