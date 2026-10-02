import type { Metadata } from "next";
import Link from "next/link";
import { PanelMarca } from "@/app/login/panel-marca";
import { confirmarLink } from "@/app/auth/acciones";
import { destinoSeguro } from "@/lib/supabase-auth";
import { BotonConfirmar } from "./boton";
import { tipoValido } from "./tipos";

export const metadata: Metadata = {
  title: "Confirmar",
  robots: { index: false, follow: false },
  // La URL lleva el token: que no salga como referrer a ningún lado.
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

const TEXTOS = {
  recovery: {
    titulo: "Cambiar la contraseña",
    texto: "Tocá el botón para seguir y elegir una contraseña nueva.",
    boton: "Seguir",
  },
  signup: {
    titulo: "Confirmá tu cuenta",
    texto: "Tocá el botón para confirmar tu mail y entrar a Tarjetazo.",
    boton: "Confirmar mi cuenta",
  },
  email: {
    titulo: "Confirmá tu mail",
    texto: "Tocá el botón para confirmar tu mail y entrar a Tarjetazo.",
    boton: "Confirmar",
  },
  email_change: {
    titulo: "Confirmá el mail nuevo",
    texto: "Tocá el botón para que tu cuenta pase a usar este mail.",
    boton: "Confirmar el cambio",
  },
} as const;

/**
 * Adonde llevan los links de los mails de Auth (confirmar la cuenta, recuperar
 * la contraseña, cambiar el mail). El token es de un solo uso y se canjea
 * recién al tocar el botón (un POST): algunos servicios de mail abren los links
 * por su cuenta para revisarlos, y si el GET lo canjeara, la persona llegaría a
 * un link ya usado.
 */
export default async function Confirmar({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const tokenHash = uno(params.token_hash);
  const tipo = uno(params.type);

  return (
    <main className="bg-hueso grid min-h-screen grid-cols-1 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <PanelMarca />
      <div className="flex flex-col justify-center px-7 py-10 min-[900px]:px-[clamp(28px,6vw,88px)]">
        <div className="w-full max-w-[400px]">
          {tokenHash && tipoValido(tipo) ? (
            <form action={confirmarLink}>
              <input type="hidden" name="token_hash" value={tokenHash} />
              <input type="hidden" name="type" value={tipo} />
              <input type="hidden" name="next" value={destinoSeguro(uno(params.next))} />
              <h1 className="font-display mt-7 text-[30px] leading-[1.1] font-bold tracking-[-0.02em]">
                {TEXTOS[tipo].titulo}
              </h1>
              <p className="text-humo mt-3 text-sm leading-relaxed">{TEXTOS[tipo].texto}</p>
              <BotonConfirmar>{TEXTOS[tipo].boton}</BotonConfirmar>
            </form>
          ) : (
            <>
              <h1 className="font-display mt-7 text-[30px] leading-[1.1] font-bold tracking-[-0.02em]">
                El link no sirve
              </h1>
              <p className="text-humo mt-3 text-sm leading-relaxed">
                Le falta una parte. Abrilo de nuevo desde el mail o pedí uno nuevo.
              </p>
              <Link href="/login" className="text-cielo mt-5 inline-block text-sm font-medium">
                Ir a ingresar
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
