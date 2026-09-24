-- Fotos de las tarjetas (#26). Al aceptar una sugerencia de imagen, el
-- backoffice la baja del banco y la guarda acá: las URLs de los bancos
-- cambian. Lectura pública (la página /tarjeta/[id] de #11 las muestra);
-- escribe solo la service role, que saltea las policies de Storage.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tarjetas', 'tarjetas', true, 4194304, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
