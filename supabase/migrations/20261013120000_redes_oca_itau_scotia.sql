-- Redes y niveles que no coincidían con lo que publican los bancos (relevado al
-- cargar las fichas de OCA, Itaú y Scotiabank, #26). Solo cambian etiquetas:
-- los beneficios apuntan a los mismos ids.
update producto set red = 'visa'
 where id in ('itau-debito-volar', 'itau-debito-junior', 'itau-debito-sueldo', 'itau-pocket',
              'itau-alimentacion', 'itau-personal-bank', 'itau-debito', 'oca-blue-debito');
update producto set tier = 'infinite' where id in ('scotiabank-visa-infinite', 'scotiabank-debito-premium');
