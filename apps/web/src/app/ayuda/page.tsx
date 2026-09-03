import type { Metadata } from "next";
import Link from "next/link";
import { PaginaTexto } from "@/components/pagina-texto";

export const metadata: Metadata = {
  title: "Ayuda",
  description:
    "Cómo funciona Tarjetazo: de dónde salen los beneficios, cada cuánto se actualizan y por qué no pedimos el número de tu tarjeta.",
};

const PREGUNTAS = [
  {
    q: "¿De dónde salen los beneficios?",
    a: "De las páginas públicas de cada banco, emisor o billetera. Todos los días las leemos, las interpretamos y guardamos también el texto original, que podés ver en cada beneficio. En la ficha siempre está el link a la publicación oficial, que es la que vale.",
  },
  {
    q: "¿Cada cuánto se actualiza?",
    a: "Una vez por día. Si una fuente deja de publicar un beneficio, dejamos de mostrarlo. Aun así, un beneficio puede cambiar entre nuestra lectura y tu compra: antes de pagar conviene mirar el link oficial.",
  },
  {
    q: "¿Tengo que crear una cuenta?",
    a: "No. Elegís tus bancos y queda guardado en tu navegador. Si borrás los datos del sitio o entrás desde otro dispositivo, hay que elegirlos de nuevo.",
  },
  {
    q: "¿Por qué no me piden el número de la tarjeta?",
    a: "Porque no hace falta. Para saber qué descuentos te sirven alcanza con saber de qué banco es tu tarjeta y, si querés afinar, qué tipo es. Nunca vamos a pedirte el número, el vencimiento ni el código de seguridad.",
  },
  {
    q: "¿Por qué hay comercios que no aparecen en el mapa?",
    a: "Porque los bancos casi nunca publican las direcciones de los locales adheridos. Para las cadenas usamos OpenStreetMap; para el resto mostramos el beneficio en la lista, sin mapa.",
  },
  {
    q: "Encontré un beneficio mal cargado.",
    a: "Escribinos y lo corregimos. Nos pasa: interpretamos texto que escribió otro y a veces el texto es ambiguo. Si sos el comercio o la fuente y querés que saquemos algo, también lo hacemos.",
  },
];

export default function Ayuda() {
  return (
    <PaginaTexto
      titulo="Ayuda"
      bajada="Lo que más nos preguntan sobre cómo funciona esto."
    >
      {PREGUNTAS.map((p) => (
        <section key={p.q}>
          <h2>{p.q}</h2>
          <p className="mt-2">{p.a}</p>
        </section>
      ))}
      <section>
        <h2>¿Algo más?</h2>
        <p className="mt-2">
          Escribinos a{" "}
          <a className="text-cielo underline underline-offset-4" href="mailto:hola@tarjetazo.uy">
            hola@tarjetazo.uy
          </a>
          . Mirá también los{" "}
          <Link className="text-cielo underline underline-offset-4" href="/terminos">
            términos
          </Link>{" "}
          y la{" "}
          <Link className="text-cielo underline underline-offset-4" href="/privacidad">
            privacidad
          </Link>
          .
        </p>
      </section>
    </PaginaTexto>
  );
}
