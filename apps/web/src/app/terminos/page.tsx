import type { Metadata } from "next";
import { PaginaTexto } from "@/components/pagina-texto";

export const metadata: Metadata = {
  title: "Términos",
  description: "Condiciones de uso de Tarjetazo.",
};

export default function Terminos() {
  return (
    <PaginaTexto titulo="Términos de uso" bajada="Última actualización: 3 de setiembre de 2026.">
      <section>
        <h2>Qué es Tarjetazo</h2>
        <p className="mt-2">
          Tarjetazo es un sitio que reúne y ordena beneficios de tarjetas publicados por bancos,
          emisores y billeteras uruguayas. Es un proyecto independiente: no tenemos vínculo
          comercial con ninguna de esas entidades ni actuamos en su nombre.
        </p>
      </section>
      <section>
        <h2>Los beneficios son de sus fuentes</h2>
        <p className="mt-2">
          Cada beneficio pertenece a la entidad que lo publica y se rige por sus condiciones. En
          cada ficha enlazamos a la publicación oficial: ante cualquier diferencia con lo que
          mostramos acá, vale la de la fuente. Reproducimos su texto original justamente para que
          puedas leerlo sin intermediarios.
        </p>
      </section>
      <section>
        <h2>No garantizamos exactitud</h2>
        <p className="mt-2">
          Leemos las páginas de las fuentes una vez por día y las interpretamos automáticamente.
          Puede haber errores, beneficios vencidos que todavía figuran o condiciones que no
          alcanzamos a reflejar. Verificá siempre en la fuente antes de una compra. No nos
          hacemos responsables por decisiones tomadas a partir de la información del sitio.
        </p>
      </section>
      <section>
        <h2>No es asesoramiento financiero</h2>
        <p className="mt-2">
          Lo que mostramos es información pública ordenada. No es una recomendación financiera
          personalizada ni una sugerencia de contratar ningún producto.
        </p>
      </section>
      <section>
        <h2>Marcas y logos</h2>
        <p className="mt-2">
          Los nombres y logos de bancos, emisores y comercios pertenecen a sus titulares y se
          usan solo para identificar a qué corresponde cada beneficio. Si sos titular de una
          marca y querés que dejemos de mostrarla, escribinos a{" "}
          <a className="text-cielo underline underline-offset-4" href="mailto:hola@tarjetazo.uy">
            hola@tarjetazo.uy
          </a>{" "}
          y la sacamos.
        </p>
      </section>
      <section>
        <h2>Uso del sitio</h2>
        <p className="mt-2">
          Podés usar Tarjetazo libremente para uso personal. No hace falta registrarse. Si querés
          reutilizar los datos a escala, hablemos antes.
        </p>
      </section>
    </PaginaTexto>
  );
}
