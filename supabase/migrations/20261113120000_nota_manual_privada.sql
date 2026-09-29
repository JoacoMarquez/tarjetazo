-- La nota interna de los beneficios manuales ("Solo se ve en el backoffice")
-- estaba en `beneficio`, que anon lee entera en las filas publicadas: la
-- policy filtra filas, no columnas. Pasa a una tabla propia sin policies, que
-- solo lee y escribe el service role.
create table beneficio_nota (
  beneficio_id text primary key references beneficio (id) on delete cascade,
  nota text not null,
  updated_at timestamptz not null default now()
);

alter table beneficio_nota enable row level security;

insert into beneficio_nota (beneficio_id, nota)
  select id, nota_manual from beneficio where nota_manual is not null and nota_manual <> '';

alter table beneficio drop column nota_manual;
