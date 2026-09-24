-- La ficha de cada tarjeta se muestra en /tarjeta/[id] (#11). Son datos que el
-- banco publica: lectura pública como `producto`. Escribe solo el backoffice
-- con la service role (sin policy de escritura).
create policy "lectura publica" on producto_ficha for select using (true);
