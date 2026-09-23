-- Qué corrida tocó por última vez cada beneficio y qué le hizo (#19), para la
-- pantalla "Novedades" y el resumen diario. Solo el último cambio: alcanza para
-- "qué pasó anoche" sin tabla de historial.
alter table beneficio
  add column if not exists corrida_id uuid references corrida (id) on delete set null,
  add column if not exists cambio text
    check (cambio in ('nuevo', 'actualizado', 'restaurado', 'baja'));
create index if not exists beneficio_corrida_idx on beneficio (corrida_id) where corrida_id is not null;
