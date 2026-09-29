-- Parser propio de OCA: el comercio sale de la marca de la API, salvo que no
-- aparezca en el título (entonces, del título). Dos arreglos a lo cargado:
-- - "Kentucky TC" venía con la marca "Kentchucky" y el modelo creó ese
--   comercio aparte del de "Kentucky Blue": se fusiona en `kentucky`.
-- - "Duty Free - TC" venía con la marca "12 cuotas"; el modelo lo llamó
--   "Duty Free de Fray Bentos" (lo dicen las condiciones). El parser dice
--   "Duty Free": el alias mantiene el comercio.
do $$
begin
  if exists (select 1 from comercio where key = 'kentchucky') and exists (select 1 from comercio where key = 'kentucky') then
    perform fusionar_comercios('kentchucky', 'kentucky');
  end if;
end $$;

insert into comercio_alias (alias_key, comercio_key)
select 'duty-free', 'duty-free-de-fray-bentos'
 where exists (select 1 from comercio where key = 'duty-free-de-fray-bentos')
   and not exists (select 1 from comercio where key = 'duty-free')
on conflict (alias_key) do nothing;
