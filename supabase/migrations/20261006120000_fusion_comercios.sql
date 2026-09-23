-- Fusión de comercios duplicados (#25): "Farma Shop" y "Farmashop" son el mismo.
-- Se elige cuál queda, se mueven beneficios y sucursales, y el alias queda como
-- regla: el runner lo aplica antes de escribir, así la corrida siguiente no
-- vuelve a crear el duplicado. La web redirige la URL del que desaparece.

create table comercio_alias (
  alias_key    text primary key,
  comercio_key text not null references comercio (key) on delete cascade,
  created_at   timestamptz not null default now(),
  check (alias_key <> comercio_key)
);
alter table comercio_alias enable row level security;
-- Público: la web lo necesita para redirigir, y no tiene nada sensible.
create policy "lectura publica" on comercio_alias for select using (true);

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

  -- Sucursales: la misma dirección en los dos queda una sola vez.
  delete from sucursal s
   where s.comercio_key = p_origen
     and exists (select 1 from sucursal d
                  where d.comercio_key = p_destino and d.direccion = s.direccion
                    and d.departamento = s.departamento);
  update sucursal set comercio_key = p_destino where comercio_key = p_origen;
  get diagnostics v_sucursales = row_count;

  delete from comercio where key = p_origen;
  perform recalcular_derivados_comercio(p_destino);
  return query select v_beneficios, v_sucursales;
end;
$$;

revoke execute on function fusionar_comercios(text, text) from public, anon, authenticated;
grant execute on function fusionar_comercios(text, text) to service_role;
