-- registrar_busqueda_vacia la llama cualquiera con la anon key, y solo acotaba
-- las repeticiones de un mismo término. Ahora también acota los términos
-- nuevos por día y borra lo de más de 90 días (la página muestra 30).
create or replace function registrar_busqueda_vacia (p_q text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_q text := lower(regexp_replace(trim(coalesce(p_q, '')), '\s+', ' ', 'g'));
  v_dia date := hoy_uy();
begin
  -- 3 a 60 caracteres y al menos dos letras: descarta ruido y pegotes.
  if length(v_q) < 3 or length(v_q) > 60 or v_q !~ '[[:alpha:]].*[[:alpha:]]' then
    return;
  end if;
  -- Tope por término y día: un bucle que repite la misma búsqueda no la infla.
  update busqueda_sin_resultado set veces = least(veces + 1, 500) where q = v_q and dia = v_dia;
  if found then
    return;
  end if;
  -- Tope de términos nuevos por día: miles de textos distintos no llenan la tabla.
  if (select count(*) from busqueda_sin_resultado where dia = v_dia) >= 1000 then
    return;
  end if;
  insert into busqueda_sin_resultado (q, dia) values (v_q, v_dia) on conflict (q, dia) do nothing;
  delete from busqueda_sin_resultado where dia < v_dia - 90;
end;
$$;
