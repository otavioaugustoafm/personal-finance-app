import { useEffect, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
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

const CAMPO = "rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500";

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
    <li className={`flex items-center gap-3 rounded-xl border border-zinc-800/60 bg-zinc-800/30 px-3 py-2.5 ${p.concluida ? "opacity-60" : ""}`}>
      <input
        type="checkbox"
        checked={p.concluida}
        onChange={async (e) => onErro(await onAtualizar(p.id, { concluida: e.target.checked }))}
        aria-label={`Marcar ${p.descricao} como ${entrada ? "recebida" : "paga"}`}
        title={entrada ? "Já recebi (já está no saldo, então deixa de somar)" : "Já paguei (já saiu do saldo, então deixa de subtrair)"}
      />
      {editando ? (
        <>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} aria-label="Descrição" maxLength={120} className={`${CAMPO} min-w-0 flex-1 py-1.5`} />
          <input value={valor} onChange={(e) => setValor(e.target.value)} aria-label="Valor" inputMode="decimal" className={`${CAMPO} w-28 py-1.5`} />
          <button onClick={salvar} aria-label="Salvar alteração" className="rounded-lg p-1.5 text-emerald-400 hover:bg-zinc-800"><Check className="h-4 w-4" /></button>
          <button onClick={() => setEditando(false)} aria-label="Cancelar edição" className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800"><X className="h-4 w-4" /></button>
        </>
      ) : (
        <>
          <span className={`min-w-0 flex-1 truncate text-sm text-zinc-200 ${p.concluida ? "line-through" : ""}`} title={p.descricao}>{p.descricao}</span>
          <span className={`shrink-0 text-sm font-medium tabular-nums ${entrada ? "text-emerald-400" : "text-rose-400"}`}>{entrada ? "+" : "−"} {moeda(p.valor)}</span>
          <button onClick={() => setEditando(true)} aria-label={`Editar ${p.descricao}`} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"><Pencil className="h-4 w-4" /></button>
          <button
            onClick={async () => onErro(await onExcluir(p.id))}
            aria-label={`Excluir ${p.descricao}`}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400"
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

  useEffect(() => {
    const aoApertar = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", aoApertar);
    return () => document.removeEventListener("keydown", aoApertar);
  }, [onClose]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-previsoes" className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
        <div className="mb-3 flex shrink-0 items-start justify-between">
          <div>
            <h2 id="titulo-previsoes" className="text-lg font-semibold text-zinc-100">Previsões do período</h2>
            <p className="text-xs text-zinc-500">{tituloPeriodo}</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="rounded-full p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="mb-3 shrink-0 space-y-1 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm tabular-nums">
          <div className="flex justify-between text-zinc-400"><span>Saldo em conta</span><span>{moeda(resumo.saldoEmConta)}</span></div>
          <div className="flex justify-between text-emerald-400"><span>+ Entradas esperadas</span><span>{moeda(resumo.aReceber)}</span></div>
          <div className="flex justify-between text-rose-400"><span>− Saídas previstas</span><span>{moeda(resumo.aPagar)}</span></div>
          <div className="flex justify-between text-rose-400"><span>− Fatura atual</span><span>{moeda(resumo.faturaAtual)}</span></div>
          <div className={`flex justify-between border-t border-zinc-800 pt-1.5 font-semibold ${resumo.presumido >= 0 ? "text-zinc-100" : "text-rose-400"}`}>
            <span>= Saldo presumido</span><span>{moeda(resumo.presumido)}</span>
          </div>
        </div>

        {erro && <div role="alert" className="mb-3 shrink-0 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{erro}</div>}

        <form onSubmit={adicionar} className="mb-3 flex shrink-0 flex-wrap gap-2">
          <select value={tipo} onChange={(e) => setTipo(e.target.value as Direcao)} aria-label="Tipo da previsão" className={CAMPO}>
            <option value="ENTRADA">Entrada esperada</option>
            <option value="SAIDA">Saída prevista</option>
          </select>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição (ex.: Salário)" aria-label="Descrição da previsão" maxLength={120} className={`${CAMPO} min-w-40 flex-1`} />
          <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Valor" aria-label="Valor da previsão" inputMode="decimal" className={`${CAMPO} w-28`} />
          <button type="submit" disabled={ocupado} aria-label="Adicionar previsão" className="flex items-center rounded-xl bg-emerald-600 px-3 text-white hover:bg-emerald-500 disabled:opacity-50"><Plus className="h-5 w-5" /></button>
        </form>

        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {previsoes.length === 0 ? (
            <li className="py-6 text-center text-sm text-zinc-500">Nenhuma previsão neste período. Adicione o que você espera receber ou pagar.</li>
          ) : (
            previsoes.map((p) => <Linha key={p.id} p={p} onAtualizar={onAtualizar} onExcluir={onExcluir} onErro={setErro} />)
          )}
        </ul>

        <p className="mt-3 shrink-0 text-xs text-zinc-500">Quando o dinheiro chegar (ou o pagamento sair), marque a caixa: o valor já estará no saldo e não deve ser somado de novo.</p>
      </div>
    </div>
  );
}
