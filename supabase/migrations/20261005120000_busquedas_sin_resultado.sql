-- Búsquedas que no encontraron nada (#24): la mejor señal de un comercio que
-- falta. Sin datos personales: solo el texto normalizado y cuántas veces por
-- día. La API pública la llama con la anon key, así que va por una función que
-- normaliza y acota, no por un insert directo.
create table busqueda_sin_resultado (
  q     text not null,
  dia   date not null,
  veces int not null default 1,
  primary key (q, dia)
);
alter table busqueda_sin_resultado enable row level security;  -- sin policies

create or replace function registrar_busqueda_vacia (p_q text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_q text := lower(regexp_replace(trim(coalesce(p_q, '')), '\s+', ' ', 'g'));
begin
  -- 3 a 60 caracteres y al menos dos letras: descarta ruido y pegotes.
  if length(v_q) < 3 or length(v_q) > 60 or v_q !~ '[[:alpha:]].*[[:alpha:]]' then
    return;
  end if;
  insert into busqueda_sin_resultado (q, dia) values (v_q, hoy_uy())
  on conflict (q, dia) do update
    -- Tope por término y día: un bucle que repite la misma búsqueda no la infla.
    set veces = least(busqueda_sin_resultado.veces + 1, 500);
end;
$$;

revoke execute on function registrar_busqueda_vacia(text) from public;
grant execute on function registrar_busqueda_vacia(text) to anon, authenticated, service_role;
