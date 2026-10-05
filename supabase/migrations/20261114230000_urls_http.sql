-- Las URLs que se muestran como links o imágenes solo pueden ser http(s).
-- Hoy lo garantizan los que escriben (schema de core, acciones del admin) y
-- React al renderizar; esto lo hace independiente de ambos (una edición a
-- mano, un export o un mail futuro). Todas las filas actuales ya cumplen.
alter table beneficio
  add constraint beneficio_url_fuente_http check (url_fuente ~* '^https?://');
alter table pagina_cruda
  add constraint pagina_cruda_url_fuente_http check (url_fuente ~* '^https?://');
alter table comercio
  add constraint comercio_sitio_web_http check (sitio_web is null or sitio_web ~* '^https?://'),
  add constraint comercio_logo_url_http check (logo_url is null or logo_url ~* '^https?://');
alter table producto_ficha
  add constraint producto_ficha_url_oficial_http check (url_oficial is null or url_oficial ~* '^https?://'),
  add constraint producto_ficha_link_solicitud_http check (link_solicitud is null or link_solicitud ~* '^https?://');
