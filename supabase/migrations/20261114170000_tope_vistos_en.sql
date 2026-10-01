-- `beneficios_vistos_en` es SECURITY DEFINER, la llama anon y aceptaba un array
-- de cualquier largo. La web le pasa los beneficios de un comercio en una
-- fuente (hoy como mucho 8); más de 100 da vacío. Misma firma: se conservan los grants.
create or replace function beneficios_vistos_en (p_ids text[])
returns table (id text, visto_en timestamptz)
language sql stable security definer set search_path = public as $$
  select b.id, p.fetched_at
    from beneficio b
    join pagina_cruda p
      on p.fuente_id = b.fuente_id
     and starts_with(b.id, p.fuente_id || ':' || p.external_id || ':')
   where cardinality(p_ids) <= 100
     and b.id = any (p_ids)
     and b.estado_revision = 'ok';
$$;
