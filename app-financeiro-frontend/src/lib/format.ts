const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const moeda = (valor: number) => brl.format(valor);

/** "2026-11-05" -> "05/11". Nao usa Date para nao deslocar o dia por fuso horario. */
export function diaMes(data: string): string {
  const [, mes, dia] = data.split("-");
  return `${dia}/${mes}`;
}

export function nomeDoMes(ano: number, mes: number): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(ano, mes - 1, 1));
}

export function dataHora(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

/** "2026-11-05" -> "05/11/2026" */
export function dataCompleta(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Aceita "55,90", "55.90", "R$ 1.234,56". Devolve "1234.56" (texto, sem erro de ponto flutuante) ou null se invalido ou <= 0. */
export function lerValorBR(texto: string): string | null {
  const t = texto.trim().replace(/^R\$\s*/, "");
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  return /^\d+(\.\d{1,2})?$/.test(normal) && Number(normal) > 0 ? normal : null;
}
