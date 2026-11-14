import type { Categoria, Transacao } from "./types";

export const SEM_CATEGORIA = "__sem_categoria__";
const COR_SEM_CATEGORIA = "#71717a";
const PALETA = ["#10b981", "#f43f5e", "#3b82f6", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#14b8a6"];

export interface InfoCategoria {
  nome: string;
  cor: string;
}

/** Cor escolhida pelo usuario; se nao houver, uma da paleta (estavel pela ordem alfabetica). */
export function mapaDeCategorias(categorias: Categoria[]): Map<string, InfoCategoria> {
  const ordenadas = [...categorias].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return new Map(ordenadas.map((c, i) => [c.id, { nome: c.nome, cor: c.cor ?? PALETA[i % PALETA.length] }]));
}

export function totaisDoMes(transacoes: Transacao[]) {
  let entradas = 0;
  let saidas = 0;
  for (const t of transacoes) {
    if (t.ignorar_no_fluxo) continue; // ex.: pagamento de fatura, para nao contar em dobro
    if (t.direcao === "ENTRADA") entradas += t.valor;
    else saidas += t.valor;
  }
  return { entradas, saidas, resultado: entradas - saidas };
}

export interface GastoPorCategoria {
  chave: string; // id da categoria ou SEM_CATEGORIA
  nome: string;
  cor: string;
  total: number;
  quantidade: number;
}

export function gastosPorCategoria(transacoes: Transacao[], mapa: Map<string, InfoCategoria>): GastoPorCategoria[] {
  const acumulado = new Map<string, GastoPorCategoria>();
  for (const t of transacoes) {
    if (t.ignorar_no_fluxo || t.direcao !== "SAIDA") continue;
    const info = t.categoria_id ? mapa.get(t.categoria_id) : undefined;
    const chave = info ? (t.categoria_id as string) : SEM_CATEGORIA;
    const atual = acumulado.get(chave) ?? {
      chave,
      nome: info?.nome ?? "Sem categoria",
      cor: info?.cor ?? COR_SEM_CATEGORIA,
      total: 0,
      quantidade: 0,
    };
    atual.total += t.valor;
    atual.quantidade += 1;
    acumulado.set(chave, atual);
  }
  return [...acumulado.values()].sort((a, b) => b.total - a.total);
}

export interface Filtros {
  direcao: "TODAS" | "ENTRADA" | "SAIDA";
  categoria: string | null; // id, SEM_CATEGORIA ou null (todas)
  mostrarIgnoradas: boolean;
  busca: string;
}

const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function filtrarTransacoes(transacoes: Transacao[], f: Filtros): Transacao[] {
  const busca = normalizar(f.busca.trim());
  return transacoes.filter((t) => {
    if (!f.mostrarIgnoradas && t.ignorar_no_fluxo) return false;
    if (f.direcao !== "TODAS" && t.direcao !== f.direcao) return false;
    if (f.categoria && t.direcao !== "SAIDA") return false; // o grafico por categoria so conta saidas
    if (f.categoria === SEM_CATEGORIA && t.categoria_id !== null) return false;
    if (f.categoria && f.categoria !== SEM_CATEGORIA && t.categoria_id !== f.categoria) return false;
    if (busca && !normalizar(t.descricao).includes(busca)) return false;
    return true;
  });
}

export function resumoDeContas(contas: { tipo: string; saldo: number | null }[]) {
  const soma = (tipos: string[]) =>
    contas.filter((c) => tipos.includes(c.tipo) && c.saldo !== null).reduce((acc, c) => acc + (c.saldo as number), 0);
  return {
    saldoEmConta: soma(["CORRENTE", "POUPANCA"]),
    cartaoEmAberto: soma(["CARTAO_CREDITO"]),
    temContas: contas.length > 0,
  };
}
