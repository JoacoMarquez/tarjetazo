-- Parser propio de Santander: el comercio sale del título de la ficha, no del
-- modelo. En 7 fichas el modelo había acortado el nombre ("Crepas (Montevideo)"
-- → Crepas, "Bravo Resto" → Bravo) o tomado el del local ("El Berretin", cuyo
-- único local es Dilema Carrasco). Los alias mantienen los comercios que ya
-- existen, con sus locales y beneficios de otras fuentes.
insert into comercio_alias (alias_key, comercio_key)
select v.alias_key, v.comercio_key
  from (values
    ('crepas-montevideo', 'crepas'),
    ('walnut-home-deco', 'walnut'),
    ('oh-jacinta-the-kul-store', 'the-kul-store'),
    ('bravo-resto', 'bravo'),
    ('cafeteria-ferran', 'ferran'),
    ('el-berretin', 'dilema-carrasco'),
    ('caramora-restaurante', 'caramora')
  ) as v (alias_key, comercio_key)
  join comercio c on c.key = v.comercio_key
 where not exists (select 1 from comercio x where x.key = v.alias_key)
on conflict (alias_key) do nothing;
