-- "Restaurantes" de Itaú se excluyó de la fusión en 20261103120000_rubros_enteros
-- porque ahí caían restaurantes concretos con el nombre perdido. Desde
-- 20261105120000_itau_landings_comercio el scraper fija el comercio de cada
-- landing, y lo único que quedaba era el "15% menos en restaurantes" del feed
-- (ya movido en 20261106120000). Con la fusión queda el alias: si el modelo
-- vuelve a leer esa página, escribe en `todo-restaurantes`.
do $$
begin
  if exists (select 1 from comercio where key = 'restaurantes') then
    perform fusionar_comercios('restaurantes', 'todo-restaurantes');
  end if;
end $$;
