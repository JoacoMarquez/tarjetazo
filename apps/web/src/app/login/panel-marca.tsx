import { Logo } from "@/components/nav";

type Tarjeta = {
  color: string;
  pie: string;
  posicion: { left: number; top: number };
  flota: string;
};

/** Las tres tarjetas del lienzo de 400×340. El rojo es solo ilustración. */
const TARJETAS: Tarjeta[] = [
  {
    color: "#0f6fd6",
    pie: "Visa · Débito",
    posicion: { left: 0, top: 70 },
    flota: "tarjeta-flota-a",
  },
  {
    color: "#d32f2f",
    pie: "Mastercard · Crédito",
    posicion: { left: 130, top: 0 },
    flota: "tarjeta-flota-b",
  },
  {
    color: "#0fae9c",
    pie: "Visa · Prepaga",
    posicion: { left: 50, top: 170 },
    flota: "tarjeta-flota-c",
  },
];

const SOMBRA =
  "0 30px 60px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.25)";

/**
 * Columna izquierda del login. En pantallas angostas se achica a una franja
 * arriba del formulario: las tarjetas se escalan y el claim se esconde.
 */
export function PanelMarca() {
  return (
    <aside className="bg-tinta relative flex h-[284px] flex-col overflow-hidden px-8 pt-8 pb-10 text-white min-[900px]:h-auto min-[900px]:min-h-screen min-[900px]:px-12">
      <Logo className="self-start text-2xl leading-none tracking-[-0.03em] text-white" />

      <div className="flex flex-1 items-center justify-center min-[900px]:min-h-80">
        {/* El envoltorio lleva la medida ya escalada para que el `scale` del
            lienzo no desborde la columna en pantallas angostas. */}
        <div
          aria-hidden
          className="relative h-[187px] w-[220px] min-[900px]:h-[340px] min-[900px]:w-[400px]"
        >
          <div className="absolute top-0 left-0 h-[340px] w-[400px] origin-top-left scale-[0.55] min-[900px]:scale-100">
            {TARJETAS.map((t) => (
              <div
                key={t.pie}
                className={`absolute h-[162px] w-[260px] rounded-lg ${t.flota}`}
                style={{
                  ...t.posicion,
                  background: t.color,
                  boxShadow: SOMBRA,
                }}
              >
                <span className="bg-sol absolute top-[62px] left-4 h-[26px] w-[34px] rounded-[5px]" />
                <span className="absolute bottom-3.5 left-4 text-[11px] font-semibold tracking-[0.08em] uppercase opacity-85">
                  {t.pie}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="font-display hidden max-w-[380px] text-[clamp(26px,2.6vw,34px)] leading-[1.1] font-bold tracking-[-0.03em] text-pretty min-[900px]:block">
        Pagá con la tarjeta que más te devuelve.
      </p>
    </aside>
  );
}
