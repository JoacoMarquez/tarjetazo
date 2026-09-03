import type { Metadata } from "next";
import { PaginaTexto } from "@/components/pagina-texto";

export const metadata: Metadata = {
  title: "Privacidad",
  description:
    "Qué datos guarda Tarjetazo: ninguno personal. Tus tarjetas quedan en tu navegador.",
};

export default function Privacidad() {
  return (
    <PaginaTexto
      titulo="Privacidad"
      bajada="Última actualización: 3 de setiembre de 2026."
    >
      <section>
        <h2>No te pedimos datos personales</h2>
        <p className="mt-2">
          Tarjetazo no tiene cuentas, no pide tu nombre ni tu correo y no se conecta con tu
          banco. Nunca vamos a pedirte el número de una tarjeta, su vencimiento ni su código de
          seguridad. Si algún sitio dice ser Tarjetazo y te los pide, no es nuestro.
        </p>
      </section>
      <section>
        <h2>Qué guardamos y dónde</h2>
        <p className="mt-2">
          Qué bancos y tarjetas elegiste se guarda en el almacenamiento local de tu navegador, en
          tu dispositivo. No llega a nuestros servidores. Si borrás los datos del sitio,
          desaparece; si entrás desde otro dispositivo, hay que elegirlos de nuevo.
        </p>
        <p className="mt-2">
          Cuando compartís un link con tus filtros, esos filtros viajan en la dirección: es la
          única forma en que tus tarjetas salen de tu navegador, y sos vos quien decide hacerlo.
        </p>
      </section>
      <section>
        <h2>Métricas de uso</h2>
        <p className="mt-2">
          Medimos de forma agregada qué se usa —cuántas visitas tiene una página, qué filtros se
          aplican— para saber qué mejorar. No creamos perfiles de personas ni vendemos datos a
          nadie. Si tu navegador pide no ser rastreado, lo respetamos.
        </p>
      </section>
      <section>
        <h2>Datos personales y URCDP</h2>
        <p className="mt-2">
          Hoy no tratamos datos personales, así que no corresponde inscribir ninguna base ante la
          Unidad Reguladora y de Control de Datos Personales. El día que haya cuentas, lo
          haremos antes de lanzarlas y actualizaremos esta página.
        </p>
      </section>
      <section>
        <h2>Contacto</h2>
        <p className="mt-2">
          Cualquier duda, a{" "}
          <a className="text-cielo underline underline-offset-4" href="mailto:hola@tarjetazo.uy">
            hola@tarjetazo.uy
          </a>
          .
        </p>
      </section>
    </PaginaTexto>
  );
}
