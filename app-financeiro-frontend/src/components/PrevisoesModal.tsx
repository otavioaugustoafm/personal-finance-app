import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import Folha from "./Folha";
import { lerValorBR, moeda } from "../lib/format";
import type { Direcao, Previsao } from "../lib/types";

interface Resumo {
  saldoEmConta: number;
  aReceber: number;
  aPagar: number;
  faturaAtual: number;
  presumido: number;
}

interface Props {
  tituloPeriodo: string;
  previsoes: Previsao[];
  resumo: Resumo;
  onClose: () => void;
  /** Todas devolvem null se deu certo, ou a mensagem de erro. */
  onCriar: (dados: { tipo: Direcao; descricao: string; valor: string }) => Promise<string | null>;
  onAtualizar: (id: string, mudancas: { descricao?: string; valor?: string; concluida?: boolean }) => Promise<string | null>;
  onExcluir: (id: string) => Promise<string | null>;
}

const CAMPO = "campo";
const BOTAO_ICONE = "rounded-full p-2 text-apagado transition-colors hover:bg-painel-2 hover:text-texto";

function Linha({ p, onAtualizar, onExcluir, onErro }: { p: Previsao; onAtualizar: Props["onAtualizar"]; onExcluir: Props["onExcluir"]; onErro: (m: string | null) => void }) {
  const [editando, setEditando] = useState(false);
  const [descricao, setDescricao] = useState(p.descricao);
  const [valor, setValor] = useState(p.valor.toFixed(2).replace(".", ","));
  const entrada = p.tipo === "ENTRADA";

  const salvar = async () => {
    const v = lerValorBR(valor);
    if (!descricao.trim()) return onErro("A descrição não pode ficar vazia.");
    if (!v) return onErro("Informe um valor maior que zero (ex.: 1.500,00).");
    const mudancas: { descricao?: string; valor?: string } = {};
    if (descricao.trim() !== p.descricao) mudancas.descricao = descricao.trim();
    if (Math.round(Number(v) * 100) !== Math.round(p.valor * 100)) mudancas.valor = v;
    if (Object.keys(mudancas).length === 0) return setEditando(false);
    const mensagem = await onAtualizar(p.id, mudancas);
    onErro(mensagem);
    if (!mensagem) setEditando(false);
  };

  return (
    <li className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-borda bg-fundo/50 px-3.5 py-2.5 ${p.concluida ? "opacity-55" : ""}`}>
      <input
        type="checkbox"
        checked={p.concluida}
        onChange={async (e) => onErro(await onAtualizar(p.id, { concluida: e.target.checked }))}
        aria-label={`Marcar ${p.descricao} como ${entrada ? "recebida" : "paga"}`}
        title={entrada ? "Já recebi (já está no saldo, então deixa de somar)" : "Já paguei (já saiu do saldo, então deixa de subtrair)"}
      />
      {editando ? (
        <>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} aria-label="Descrição" maxLength={120} className={`${CAMPO} min-w-0 flex-1 basis-40`} />
          <input value={valor} onChange={(e) => setValor(e.target.value)} aria-label="Valor" inputMode="decimal" className={`${CAMPO} w-28!`} />
          <button onClick={salvar} aria-label="Salvar alteração" className="rounded-full p-2 text-entrada hover:bg-painel-2"><Check className="h-4 w-4" /></button>
          <button onClick={() => setEditando(false)} aria-label="Cancelar edição" className={BOTAO_ICONE}><X className="h-4 w-4" /></button>
        </>
      ) : (
        <>
          <span className={`min-w-0 flex-1 truncate text-[15px] text-texto sm:text-sm ${p.concluida ? "line-through" : ""}`} title={p.descricao}>{p.descricao}</span>
          <span className={`shrink-0 text-sm font-medium tabular-nums ${entrada ? "text-entrada" : "text-saida"}`}>{entrada ? "+" : "−"} {moeda(p.valor)}</span>
          <button onClick={() => setEditando(true)} aria-label={`Editar ${p.descricao}`} className={`${BOTAO_ICONE} -mx-1`}><Pencil className="h-4 w-4" /></button>
          <button
            onClick={async () => onErro(await onExcluir(p.id))}
            aria-label={`Excluir ${p.descricao}`}
            className="-mx-1 rounded-full p-2 text-apagado transition-colors hover:bg-saida/10 hover:text-saida"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      )}
    </li>
  );
}

export default function PrevisoesModal({ tituloPeriodo, previsoes, resumo, onClose, onCriar, onAtualizar, onExcluir }: Props) {
  const [tipo, setTipo] = useState<Direcao>("ENTRADA");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const adicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = lerValorBR(valor);
    if (!descricao.trim()) return setErro("Descreva a previsão (ex.: Salário, Aluguel).");
    if (!v) return setErro("Informe um valor maior que zero (ex.: 1.500,00).");
    setOcupado(true);
    const mensagem = await onCriar({ tipo, descricao: descricao.trim(), valor: v });
    setOcupado(false);
    setErro(mensagem);
    if (!mensagem) {
      setDescricao("");
      setValor("");
    }
  };

  return (
    <Folha titulo="Previsões do período" subtitulo={tituloPeriodo} onClose={onClose} largura="lg">
      <div className="mb-4 rounded-2xl border border-borda bg-fundo/60 p-4 text-[15px] tabular-nums sm:text-sm">
        <div className="flex justify-between py-0.5 text-suave"><span>Saldo em conta</span><span>{moeda(resumo.saldoEmConta)}</span></div>
        <div className="flex justify-between py-0.5 text-entrada"><span>+ Entradas esperadas</span><span>{moeda(resumo.aReceber)}</span></div>
        <div className="flex justify-between py-0.5 text-saida"><span>− Saídas previstas</span><span>{moeda(resumo.aPagar)}</span></div>
        <div className="flex justify-between py-0.5 text-saida"><span>− Fatura atual</span><span>{moeda(resumo.faturaAtual)}</span></div>
        <div className={`mt-2 flex items-baseline justify-between border-t border-dashed border-borda-forte pt-2.5 ${resumo.presumido >= 0 ? "text-latao" : "text-saida"}`}>
          <span className="text-suave">Saldo presumido</span>
          <span className="font-display text-xl font-semibold">{moeda(resumo.presumido)}</span>
        </div>
      </div>

      {erro && <div role="alert" className="mb-3 rounded-xl border border-saida/30 bg-saida/10 px-3 py-2.5 text-sm text-saida">{erro}</div>}

      <form onSubmit={adicionar} className="mb-4 space-y-2">
        <div className="flex rounded-full bg-fundo p-0.5 text-sm" role="group" aria-label="Tipo da previsão">
          {(["ENTRADA", "SAIDA"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              aria-pressed={tipo === t}
              className={`flex-1 rounded-full px-3 py-2 transition-colors ${tipo === t ? (t === "ENTRADA" ? "bg-entrada/15 text-entrada" : "bg-saida/15 text-saida") : "text-apagado hover:text-suave"}`}
            >
              {t === "ENTRADA" ? "Vou receber" : "Vou pagar"}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={tipo === "ENTRADA" ? "Ex.: Salário" : "Ex.: Aluguel"} aria-label="Descrição da previsão" maxLength={120} className={`${CAMPO} min-w-0 flex-1`} />
          <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" aria-label="Valor da previsão" inputMode="decimal" className={`${CAMPO} w-28!`} />
          <button type="submit" disabled={ocupado} aria-label="Adicionar previsão" className="botao-acao shrink-0 px-3!"><Plus className="h-5 w-5" /></button>
        </div>
      </form>

      <ul className="space-y-2">
        {previsoes.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-borda py-8 text-center text-sm text-apagado">Nada anotado neste período. Adicione o que você espera receber ou pagar.</li>
        ) : (
          previsoes.map((p) => <Linha key={p.id} p={p} onAtualizar={onAtualizar} onExcluir={onExcluir} onErro={setErro} />)
        )}
      </ul>

      <p className="mt-4 text-xs leading-relaxed text-apagado">Quando o dinheiro entrar (ou o pagamento sair), marque a caixa: o valor já estará no saldo e deixa de entrar na conta.</p>
    </Folha>
  );
}
