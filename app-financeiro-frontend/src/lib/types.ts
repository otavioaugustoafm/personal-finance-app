export type Direcao = "ENTRADA" | "SAIDA";

export interface Categoria {
  id: string;
  nome: string;
  tipo: Direcao;
  cor: string | null;
}

export interface Conta {
  id: string;
  tipo: "CORRENTE" | "POUPANCA" | "CARTAO_CREDITO";
  nome: string | null;
  saldo: number | null;
  saldo_atualizado_em: string | null;
  instituicao: string;
}

export interface Transacao {
  id: string;
  data: string; // "AAAA-MM-DD"
  descricao: string;
  valor: number;
  direcao: Direcao;
  metodo: "PIX" | "DEBITO" | "CREDITO" | "OUTRO";
  status: "PENDENTE" | "EFETIVADA";
  parcela_atual: number | null;
  total_parcelas: number | null;
  ignorar_no_fluxo: boolean;
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
