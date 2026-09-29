-- Parser propio de BROU: el comercio sale del nombre de la ficha (sin
-- "Beneficios en", "Semana BROU en", "PYMES"). En 8 fichas el modelo había
-- usado otro nombre ("Combustible en Estaciones ANCAP" → Estaciones ANCAP,
-- "Beneficios de Invierno" → Todos los restaurantes). Los alias mantienen los
-- comercios que ya existen. "Farmacias" ya tenía alias a todo-farmacias.
insert into comercio_alias (alias_key, comercio_key)
select v.alias_key, v.comercio_key
  from (values
    ('antel-y-mi-brou-tarjeta-joven', 'antel'),
    ('combustible-en-estaciones-ancap', 'estaciones-ancap'),
    ('supermercados-seleccionados', 'supermercados-seleccionados-ta-ta-el-dorado-macro-mercado-micro-macro-red-expres'),
    ('instituto-instituto-vinicius-de-moraes-lingua-cultura-do-brasil', 'instituto-vinicius-de-moraes-lingua-cultura-do-brasil'),
    ('beneficios-de-invierno', 'todo-restaurantes'),
    ('restaurante-la-navicella', 'restaurante-la-navicella-hotel-del-lago'),
    ('siur-viajofeliz', 'viajofeliz'),
    ('superventas-articulos-electronicos', 'superventas')
  ) as v (alias_key, comercio_key)
  join comercio c on c.key = v.comercio_key
 where not exists (select 1 from comercio x where x.key = v.alias_key)
on conflict (alias_key) do nothing;
