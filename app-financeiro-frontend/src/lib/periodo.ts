import { diaMes } from "./format";

/**
 * "Mes" do painel = periodo que comeca no dia DIA_INICIO_PERIODO do mes anterior.
 * Com o dia 27: novembro = 27/10 a 26/11; dezembro = 27/11 a 26/12. O dia 27 ja pertence ao periodo seguinte.
 * Para mudar, defina VITE_DIA_INICIO_PERIODO (1 a 28) no Amplify e faca um novo deploy. Com 1, volta ao mes do calendario.
 */
function lerDiaInicio(): number {
  const bruto = Number(import.meta.env.VITE_DIA_INICIO_PERIODO ?? 27);
  return Number.isInteger(bruto) && bruto >= 1 && bruto <= 28 ? bruto : 27;
}

export const DIA_INICIO_PERIODO = lerDiaInicio();

export interface Periodo {
  ano: number;
  mes: number; // 1 a 12: o mes que da nome ao periodo (em qual mes ele TERMINA)
}

const dois = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;

export function intervaloDoPeriodo({ ano, mes }: Periodo, diaInicio = DIA_INICIO_PERIODO): { de: string; ate: string } {
  if (diaInicio === 1) return { de: iso(new Date(ano, mes - 1, 1)), ate: iso(new Date(ano, mes, 0)) };
  return { de: iso(new Date(ano, mes - 2, diaInicio)), ate: iso(new Date(ano, mes - 1, diaInicio - 1)) };
}

export function somarMeses({ ano, mes }: Periodo, delta: number): Periodo {
  const d = new Date(ano, mes - 1 + delta, 1);
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}

/** Periodo em que "hoje" cai: a partir do dia de inicio, ja estamos no periodo do mes seguinte. */
export function periodoDeHoje(hoje: Date, diaInicio = DIA_INICIO_PERIODO): Periodo {
  const atual = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
  return diaInicio > 1 && hoje.getDate() >= diaInicio ? somarMeses(atual, 1) : atual;
}

/** "27/10 a 26/11" */
export function rotuloDoIntervalo(de: string, ate: string): string {
  return `${diaMes(de)} a ${diaMes(ate)}`;
}
