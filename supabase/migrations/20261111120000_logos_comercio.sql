-- Logos de comercio (#118). El scraper baja el logo que publica la fuente
-- (Santander, BROU, OCA, las landings de Itaú) una vez por comercio y lo
-- guarda acá: las URLs de los bancos cambian y algunos bloquean que otro sitio
-- las muestre. Lectura pública; escribe solo la service role.
--
-- Sin SVG: un SVG puede traer scripts, y el bucket se sirve público.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comercios', 'comercios', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- De dónde salió el logo, para saber si la fuente lo cambió. `logo_url` ya
-- existía (vacía): ahora es la URL pública del archivo en el bucket.
alter table comercio add column if not exists logo_origen text;
