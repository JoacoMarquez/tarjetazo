-- La tarjeta de socio de un club (Club El País, #10): tiene beneficios y se
-- elige en "mis tarjetas", pero no es un medio de pago ni va al catálogo
-- público. Va sola en su migración: un valor nuevo de enum no se puede usar en
-- la misma transacción que lo agrega.
alter type instrumento add value if not exists 'membresia';
