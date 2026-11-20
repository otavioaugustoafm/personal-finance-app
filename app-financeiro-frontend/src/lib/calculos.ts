import type { Categoria, Conta, Direcao, Metodo, Previsao, PrevisaoCalculada, Transacao } from "./types";

export const SEM_CATEGORIA = "__sem_categoria__";
const COR_SEM_CATEGORIA = "#71717a";
export const PALETA_CATEGORIAS = ["#10b981", "#f43f5e", "#3b82f6", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#14b8a6"];

export interface InfoCategoria {
  nome: string;
  cor: string;
}

/** Cor escolhida pelo usuario; se nao houver, uma da paleta (estavel pela ordem alfabetica). */
export function mapaDeCategorias(categorias: Categoria[]): Map<string, InfoCategoria> {
  const ordenadas = [...categorias].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return new Map(ordenadas.map((c, i) => [c.id, { nome: c.nome, cor: c.cor ?? PALETA_CATEGORIAS[i % PALETA_CATEGORIAS.length] }]));
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

export function gastosPorCategoria(transacoes: Transacao[], mapa: Map<string, InfoCategoria>, direcao: Direcao = "SAIDA"): GastoPorCategoria[] {
  const acumulado = new Map<string, GastoPorCategoria>();
  for (const t of transacoes) {
    if (t.ignorar_no_fluxo || t.direcao !== direcao) continue;
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

// ------------------------- filtros -------------------------
export interface Filtros {
  direcao: "TODAS" | Direcao;
  categorias: string[]; // ids ou SEM_CATEGORIA; vazio = todas
  metodos: Metodo[]; // vazio = todos
  mostrarIgnoradas: boolean;
  busca: string;
}

export const FILTROS_VAZIOS: Filtros = { direcao: "TODAS", categorias: [], metodos: [], mostrarIgnoradas: false, busca: "" };

export function contarFiltrosAtivos(f: Filtros): number {
  return (
    (f.direcao !== "TODAS" ? 1 : 0) + (f.categorias.length > 0 ? 1 : 0) + (f.metodos.length > 0 ? 1 : 0) +
    (f.mostrarIgnoradas ? 1 : 0) + (f.busca.trim() ? 1 : 0)
  );
}

const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

interface OpcoesFiltro {
  /** Usado no grafico por categoria: ele mostra TODAS as categorias mesmo com filtro de categoria ligado. */
  ignorarCategorias?: boolean;
  ignorarDirecao?: boolean;
}

export function filtrarTransacoes(transacoes: Transacao[], f: Filtros, opcoes: OpcoesFiltro = {}): Transacao[] {
  const busca = normalizar(f.busca.trim());
  return transacoes.filter((t) => {
    if (!f.mostrarIgnoradas && t.ignorar_no_fluxo) return false;
    if (!opcoes.ignorarDirecao && f.direcao !== "TODAS" && t.direcao !== f.direcao) return false;
    if (f.metodos.length > 0 && !f.metodos.includes(t.metodo)) return false;
    if (!opcoes.ignorarCategorias && f.categorias.length > 0) {
      const chave = t.categoria_id ?? SEM_CATEGORIA;
      if (!f.categorias.includes(chave)) return false;
    }
    // a busca olha a descricao atual e tambem a original do banco (achar uma transacao editada pelo nome antigo)
    if (busca && !normalizar(`${t.descricao} ${t.original.descricao}`).includes(busca)) return false;
    return true;
  });
}

// ------------------------- somas dos cards -------------------------
const emCentavos = (v: number) => Math.round(v * 100);

/**
 * Soma das COMPRAS no cartao de credito no periodo: e daqui que sai "quanto esta a fatura".
 * Estornos (dinheiro devolvido no cartao) aparecem a parte, nao sao descontados. O que esta marcado como
 * "fora do fluxo" fica de fora, como em todas as somas do painel.
 */
export function comprasNoCredito(transacoes: Transacao[]) {
  let total = 0;
  let estornos = 0;
  let quantidade = 0;
  for (const t of transacoes) {
    if (t.metodo !== "CREDITO" || t.ignorar_no_fluxo) continue;
    if (t.direcao === "SAIDA") {
      total += emCentavos(t.valor);
      quantidade += 1;
    } else {
      estornos += emCentavos(t.valor);
    }
  }
  return { total: total / 100, estornos: estornos / 100, quantidade };
}

/** Soma de UMA categoria no periodo (por padrao, os gastos/saidas). */
export function totalDaCategoria(transacoes: Transacao[], categoriaId: string, direcao: Direcao = "SAIDA") {
  let total = 0;
  let quantidade = 0;
  for (const t of transacoes) {
    if (t.ignorar_no_fluxo || t.direcao !== direcao || t.categoria_id !== categoriaId) continue;
    total += emCentavos(t.valor);
    quantidade += 1;
  }
  return { total: total / 100, quantidade };
}

/** Acha a categoria de gasto pelo nome, ignorando acentos e maiusculas ("Gastos da Mae" = "gastos da mãe"). */
export function categoriaDeGastoPorNome(categorias: Categoria[], nome: string): Categoria | undefined {
  const alvo = normalizar(nome.trim());
  return categorias.find((c) => c.tipo === "SAIDA" && normalizar(c.nome.trim()) === alvo);
}

// ------------------------- saldo presumido -------------------------
/**
 * Saldo presumido = saldo em conta + entradas esperadas - saidas previstas - fatura atual.
 * Previsoes marcadas como concluidas (ja recebidas/pagas) ficam de fora: elas ja estao refletidas no saldo.
 */
/**
 * Resolve o valor de cada previsao. As ligadas a uma categoria valem o total dessa categoria no periodo
 * (ex.: "Estorno da mae" = tudo o que foi gasto em "Gastos da Mae"), contado no tipo da propria categoria.
 */
export function calcularPrevisoes(previsoes: Previsao[], transacoes: Transacao[], categorias: Categoria[]): PrevisaoCalculada[] {
  const tipoDe = new Map(categorias.map((c) => [c.id, c.tipo]));
  return previsoes.map((p) =>
    p.categoria_id
      ? { ...p, valor: totalDaCategoria(transacoes, p.categoria_id, tipoDe.get(p.categoria_id) ?? "SAIDA").total, automatica: true }
      : { ...p, valor: p.valor ?? 0, automatica: false },
  );
}

export function saldoPresumido(saldoEmConta: number, faturaAtual: number, previsoes: { tipo: Direcao; valor: number; concluida: boolean }[]) {
  let entradas = 0;
  let saidas = 0;
  for (const p of previsoes) {
    if (p.concluida) continue;
    if (p.tipo === "ENTRADA") entradas += emCentavos(p.valor);
    else saidas += emCentavos(p.valor);
  }
  const aReceber = entradas / 100;
  const aPagar = saidas / 100;
  return { aReceber, aPagar, presumido: (emCentavos(saldoEmConta) + entradas - saidas - emCentavos(faturaAtual)) / 100 };
}

// ------------------------- cores das categorias -------------------------
const mesmaCor = (a: string | null, b: string | null) => (a ?? "").toLowerCase() === (b ?? "").toLowerCase();

/** Primeira cor da paleta que nenhuma categoria usa (se todas estiverem em uso, volta ao comeco). */
export function corNaoUsada(categorias: { cor: string | null }[]): string {
  const livre = PALETA_CATEGORIAS.find((cor) => !categorias.some((c) => mesmaCor(c.cor, cor)));
  return livre ?? PALETA_CATEGORIAS[categorias.length % PALETA_CATEGORIAS.length];
}

/**
 * Categorias que repetem a cor de outra (ou nao tem cor) recebem cores livres da paleta.
 * A primeira de cada cor (em ordem alfabetica) a mantem, e quem ja tem cor propria e unica nao e tocado:
 * as cores mantidas sao reservadas ANTES de escolher as novas, para nunca tomar a cor de uma categoria mais adiante.
 */
export function corrigirCoresRepetidas(categorias: Categoria[]): { id: string; cor: string }[] {
  const ordenadas = [...categorias].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const mantidas = new Set<string>();
  const aMudar: Categoria[] = [];
  for (const c of ordenadas) {
    const cor = c.cor?.toLowerCase();
    if (cor && !mantidas.has(cor)) mantidas.add(cor);
    else aMudar.push(c);
  }
  const emUso: { cor: string | null }[] = [...mantidas].map((cor) => ({ cor }));
  return aMudar.map((c) => {
    const nova = corNaoUsada(emUso);
    emUso.push({ cor: nova });
    return { id: c.id, cor: nova };
  });
}

// ------------------------- contas -------------------------
export function resumoDeContas(contas: Conta[]) {
  const saldoEmConta = contas
    .filter((c) => (c.tipo === "CORRENTE" || c.tipo === "POUPANCA") && c.saldo !== null)
    .reduce((acc, c) => acc + (c.saldo as number), 0);
  return { saldoEmConta, temContas: contas.length > 0 };
}
