"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createSupabaseBrowser } from "@/lib/supabase-auth";

type Modo = "login" | "registro";
type Campo = "nombre" | "email" | "password";
type Errores = Partial<Record<Campo, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Traduce los errores más comunes de Supabase; el resto pasa tal cual. */
function mensajeDeError(e: unknown): string {
  const texto = e instanceof Error ? e.message : String(e);
  const b = texto.toLowerCase();
  if (b.includes("invalid login credentials"))
    return "El email o la contraseña no coinciden.";
  if (b.includes("already registered") || b.includes("already been registered"))
    return "Ese email ya tiene cuenta. Probá ingresar.";
  if (b.includes("email not confirmed"))
    return "Todavía no confirmaste el email. Buscá el link que te mandamos.";
  if (b.includes("email rate limit") || b.includes("too many requests"))
    return "Probamos muchas veces seguidas. Esperá un minuto y volvé a intentar.";
  return texto;
}

function LogoGoogle() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 48 48"
      aria-hidden
      focusable="false"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9.1 3.5l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"
      />
      <path
        fill="#FBBC05"
        d="M10.5 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6.1z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.3 0 11.7-2.1 15.6-5.7l-7.5-5.8c-2.1 1.4-4.8 2.3-8.1 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}

const CLASE_INPUT =
  "h-12 rounded-md border bg-white px-3.5 text-[15px] text-tinta outline-none transition-colors placeholder:text-humo-oscuro";

function CampoForm({
  etiqueta,
  error,
  children,
  extra,
}: {
  etiqueta: string;
  error?: string;
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
      <span className="flex justify-between">
        {etiqueta}
        {extra}
      </span>
      {children}
      {error && (
        <span className="text-coral-ink text-xs font-normal">{error}</span>
      )}
    </label>
  );
}

/** Pantalla que reemplaza al formulario cuando mandamos un mail. */
function Aviso({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="font-display mt-7 text-[30px] leading-[1.1] font-bold tracking-[-0.02em]">
        {titulo}
      </h1>
      <p className="text-humo mt-3 text-sm leading-relaxed">{children}</p>
    </div>
  );
}

export function FormularioLogin({
  modoInicial,
  destino,
  errorInicial,
  conGoogle,
}: {
  modoInicial: Modo;
  destino: string;
  errorInicial?: string;
  /** Solo si el proveedor está habilitado en Supabase (#36). */
  conGoogle: boolean;
}) {
  const router = useRouter();
  const idError = useId();

  const [modo, setModo] = useState<Modo>(modoInicial);
  // `null` en la carga inicial: la primera pintada no se anima.
  const [dir, setDir] = useState<"L" | "R" | null>(null);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [errores, setErrores] = useState<Errores>({});
  const [error, setError] = useState<string | null>(errorInicial ?? null);
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState<{
    tipo: "reset" | "confirmar";
    email: string;
  } | null>(null);

  const esLogin = modo === "login";

  function cambiarModo(nuevo: Modo) {
    if (nuevo === modo) return;
    setDir(nuevo === "registro" ? "R" : "L");
    setModo(nuevo);
    setErrores({});
    setError(null);
  }

  function validar(): Errores {
    const errs: Errores = {};
    if (!esLogin && nombre.trim() === "")
      errs.nombre = "Decinos cómo te llamamos.";
    if (!EMAIL_RE.test(email.trim()))
      errs.email = "Revisá el email: no parece una dirección válida.";
    if (password === "") errs.password = "Escribí tu contraseña.";
    else if (!esLogin && password.length < 8)
      errs.password = "Mínimo 8 caracteres.";
    return errs;
  }

  function irAlDestino() {
    router.push(destino as Route);
    router.refresh();
  }

  async function entrarConGoogle() {
    setError(null);
    setCargando(true);
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destino)}`,
        },
      });
      if (error) throw error;
      // Si no hubo error el browser se va a Google; no apagamos el spinner.
    } catch (e) {
      setError(mensajeDeError(e));
      setCargando(false);
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const errs = validar();
    setErrores(errs);
    if (Object.keys(errs).length > 0) return;

    setError(null);
    setCargando(true);
    try {
      const supabase = createSupabaseBrowser();
      if (esLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        irAlDestino();
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { nombre: nombre.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destino)}`,
        },
      });
      if (error) throw error;
      // Sin sesión = el proyecto pide confirmar el mail antes de entrar.
      if (!data.session) setAviso({ tipo: "confirmar", email: email.trim() });
      else irAlDestino();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  }

  async function recuperar(e: React.MouseEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setErrores({
        email: "Escribí tu email acá arriba y te mandamos el link.",
      });
      return;
    }
    setError(null);
    setErrores({});
    setCargando(true);
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destino)}`,
        },
      );
      if (error) throw error;
      setAviso({ tipo: "reset", email: email.trim() });
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  }

  const animacion =
    dir === "R" ? "form-entra-r" : dir === "L" ? "form-entra-l" : undefined;

  return (
    <div className="w-full max-w-[400px]">
      <div
        role="tablist"
        aria-label="Ingresar o crear cuenta"
        className="bg-papel-2 flex w-max gap-1 rounded-md p-1"
      >
        {(["login", "registro"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={modo === m}
            onClick={() => cambiarModo(m)}
            className={cn(
              "h-9 cursor-pointer rounded-[9px] px-[18px] text-sm font-semibold transition-[background-color,color] duration-200",
              modo === m ? "bg-tinta text-white" : "text-tinta bg-transparent",
            )}
          >
            {m === "login" ? "Ingresar" : "Crear cuenta"}
          </button>
        ))}
      </div>

      {aviso ? (
        <Aviso
          titulo={
            aviso.tipo === "reset" ? "Revisá tu correo" : "Confirmá tu email"
          }
        >
          {aviso.tipo === "reset" ? (
            <>
              Te mandamos un link a{" "}
              <strong className="text-tinta font-semibold">
                {aviso.email}
              </strong>{" "}
              para que elijas una contraseña nueva.
            </>
          ) : (
            <>
              Te mandamos un link a{" "}
              <strong className="text-tinta font-semibold">
                {aviso.email}
              </strong>{" "}
              para terminar de crear la cuenta.
            </>
          )}
        </Aviso>
      ) : (
        <div key={modo} className={animacion}>
          <h1 className="font-display mt-7 text-[30px] leading-[1.1] font-bold tracking-[-0.02em]">
            {esLogin ? "Hola de nuevo" : "Creá tu cuenta"}
          </h1>

          {conGoogle ? (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={entrarConGoogle}
                disabled={cargando}
                /* `secondary` y no `outline`: outline trae utilidades `dark:` que en
               este proyecto (sin tema oscuro) se activan igual por el sistema. */
                className="border-linea hover:bg-papel-1 text-tinta mt-6 h-12 w-full gap-2.5 border bg-white text-[15px] font-semibold disabled:opacity-60"
              >
                <LogoGoogle />
                {esLogin ? "Continuar con Google" : "Registrarme con Google"}
              </Button>

              <div className="text-humo-oscuro my-5 flex items-center gap-3 text-xs">
                <span className="bg-linea h-px flex-1" />
                o con tu email
                <span className="bg-linea h-px flex-1" />
              </div>
            </>
          ) : (
            <div className="mt-6" />
          )}

          <form onSubmit={enviar} noValidate>
            <div className="flex flex-col gap-3">
              {!esLogin && (
                <CampoForm etiqueta="Nombre" error={errores.nombre}>
                  <input
                    name="nombre"
                    autoComplete="name"
                    placeholder="Cómo te llamamos"
                    value={nombre}
                    onChange={(ev) => setNombre(ev.target.value)}
                    aria-invalid={Boolean(errores.nombre)}
                    className={cn(
                      CLASE_INPUT,
                      errores.nombre
                        ? "border-coral"
                        : "border-linea focus:border-tinta",
                    )}
                  />
                </CampoForm>
              )}

              <CampoForm etiqueta="Email" error={errores.email}>
                <input
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="vos@correo.com"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  aria-invalid={Boolean(errores.email)}
                  className={cn(
                    CLASE_INPUT,
                    errores.email
                      ? "border-coral"
                      : "border-linea focus:border-tinta",
                  )}
                />
              </CampoForm>

              <CampoForm
                etiqueta="Contraseña"
                error={errores.password}
                extra={
                  esLogin ? (
                    <a
                      href="#"
                      onClick={recuperar}
                      className="text-cielo text-[13px] font-medium"
                    >
                      ¿La olvidaste?
                    </a>
                  ) : undefined
                }
              >
                <input
                  name="password"
                  type="password"
                  autoComplete={esLogin ? "current-password" : "new-password"}
                  placeholder={esLogin ? "••••••••" : "Mínimo 8 caracteres"}
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                  aria-invalid={Boolean(errores.password)}
                  className={cn(
                    CLASE_INPUT,
                    errores.password
                      ? "border-coral"
                      : "border-linea focus:border-tinta",
                  )}
                />
              </CampoForm>
            </div>

            {error && (
              <p
                id={idError}
                role="alert"
                className="bg-coral-s text-coral-ink mt-5 rounded-[10px] px-3.5 py-2.5 text-[13px]"
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={cargando}
              aria-describedby={error ? idError : undefined}
              className="bg-tinta hover:bg-pizarra mt-5 h-[50px] w-full text-[15px] font-semibold text-white disabled:opacity-60"
            >
              {cargando
                ? esLogin
                  ? "Ingresando…"
                  : "Creando cuenta…"
                : esLogin
                  ? "Ingresar"
                  : "Crear cuenta"}
            </Button>
          </form>

          {!esLogin && (
            <p className="text-humo-oscuro mt-3.5 text-center text-xs leading-[1.5]">
              Al crear la cuenta aceptás los{" "}
              <Link href="/terminos" className="text-cielo">
                términos
              </Link>{" "}
              y la{" "}
              <Link href="/privacidad" className="text-cielo">
                política de privacidad
              </Link>
              .
            </p>
          )}

          <p className="text-humo mt-6 text-center text-[13px]">
            {esLogin ? "¿Primera vez?" : "¿Ya tenés cuenta?"}{" "}
            <button
              type="button"
              onClick={() => cambiarModo(esLogin ? "registro" : "login")}
              className="text-cielo cursor-pointer font-semibold"
            >
              {esLogin ? "Creá tu cuenta" : "Ingresá"}
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
