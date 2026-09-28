-- "15% menos en restaurantes" del feed de Itaú (benef-1082) es de rubro entero:
-- va a `todo-restaurantes`. Solo esa página: "Restaurantes" no se fusiona
-- (20261103120000_rubros_enteros), así que si la página cambia y el modelo la
-- vuelve a leer, cae de nuevo en `restaurantes`.
update beneficio set comercio_key = 'todo-restaurantes', updated_at = now()
 where id like 'itau:benef-1082:%' and comercio_key = 'restaurantes';

select recalcular_derivados_comercio('todo-restaurantes');
select recalcular_derivados_comercio('restaurantes');
