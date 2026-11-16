export type Direcao = "ENTRADA" | "SAIDA";
export type Metodo = "PIX" | "DEBITO" | "CREDITO" | "OUTRO";

export interface Categoria {
  id: string;
  nome: string;
  tipo: Direcao;
  cor: string | null;
}

export interface FaturaCartao {
  vencimento: string; // "AAAA-MM-DD"
  fechamento: string | null;
  total: number;
  minimo: number | null;
  pagamentos: number;
}

export interface Conta {
  id: string;
  tipo: "CORRENTE" | "POUPANCA" | "CARTAO_CREDITO";
  nome: string | null;
  saldo: number | null;
  saldo_atualizado_em: string | null;
  instituicao: string;
  limite_total: number | null;
  limite_disponivel: number | null;
  proximas_faturas: FaturaCartao[];
}

/** O que o BANCO informou (guardado a parte, para comparar e restaurar depois de uma edicao). */
export interface OriginalBanco {
  descricao: string;
  data: string;
  valor: string;
  direcao: Direcao;
  metodo: Metodo;
  parcela_atual: number | null;
  total_parcelas: number | null;
}

export interface Transacao {
  id: string;
  data: string; // "AAAA-MM-DD"
  descricao: string;
  valor: number;
  direcao: Direcao;
  metodo: Metodo;
  status: "PENDENTE" | "EFETIVADA";
  parcela_atual: number | null;
  total_parcelas: number | null;
  ignorar_no_fluxo: boolean;
  campos_editados: string[];
  original: OriginalBanco;
  categoria_id: string | null;
  conta_id: string;
  conta_nome: string | null;
  conta_tipo: Conta["tipo"];
}

export interface StatusSincronizacao {
  ultima: {
    iniciada_em: string;
    finalizada_em: string | null;
    status: "EM_ANDAMENTO" | "OK" | "PARCIAL" | "ERRO";
    novas: number;
    atualizadas: number;
    erro: string | null;
    avisos: string[];
  } | null;
  conexoes: {
    instituicao: string;
    status: string | null;
    ultima_sincronizacao_em: string | null;
    consentimento_expira_em: string | null;
    dias_para_expirar: number | null;
  }[];
}
