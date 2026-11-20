import { useState } from "react";
import { Check, Link2, Pencil, Plus, Trash2, X } from "lucide-react";
import type { InfoCategoria } from "../lib/calculos";
import { lerValorBR, moeda } from "../lib/format";
import type { Categoria, Direcao, PrevisaoCalculada } from "../lib/types";
import Folha from "./Folha";

interface Resumo {
  saldoEmConta: number;
  aReceber: number;
  aPagar: number;
  faturaAtual: number;
  presumido: number;
}

interface Props {
  tituloPeriodo: string;
  previsoes: PrevisaoCalculada[];
  categorias: Categoria[];
  mapaCategorias: Map<string, InfoCategoria>;
  resumo: Resumo;
  onClose: () => void;
  /** Todas devolvem null se deu certo, ou a mensagem de erro. */
  onCriar: (dados: { tipo: Direcao; descricao: string; valor: string | null; categoria_id: string | null }) => Promise<string | null>;
  onAtualizar: (id: string, mudancas: { descricao?: string; valor?: string; concluida?: boolean }) => Promise<string | null>;
  onExcluir: (id: string) => Promise<string | null>;
}

type ModoValor = "FIXO" | "CATEGORIA";

const CAMPO = "campo";
const BOTAO_ICONE = "rounded-full p-2 text-apagado transition-colors hover:bg-painel-2 hover:text-texto";

function Linha({ p, categoria, onAtualizar, onExcluir, onErro }: {
  p: PrevisaoCalculada;
  categoria: InfoCategoria | undefined;
  onAtualizar: Props["onAtualizar"];
  onExcluir: Props["onExcluir"];
  onErro: (m: string | null) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [descricao, setDescricao] = useState(p.descricao);
  const [valor, setValor] = useState(p.valor.toFixed(2).replace(".", ","));
  const entrada = p.tipo === "ENTRADA";

  const salvar = async () => {
    if (!descricao.trim()) return onErro("A descrição não pode ficar vazia.");
    const mudancas: { descricao?: string; valor?: string } = {};
    if (descricao.trim() !== p.descricao) mudancas.descricao = descricao.trim();
    if (!p.automatica) {
      // o valor da previsão ligada a categoria é automático: só a descrição muda
      const v = lerValorBR(valor);
      if (!v) return onErro("Informe um valor maior que zero (ex.: 1.500,00).");
      if (Math.round(Number(v) * 100) !== Math.round(p.valor * 100)) mudancas.valor = v;
    }
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
          {!p.automatica && <input value={valor} onChange={(e) => setValor(e.target.value)} aria-label="Valor" inputMode="decimal" className={`${CAMPO} w-28!`} />}
          <button onClick={salvar} aria-label="Salvar alteração" className="rounded-full p-2 text-entrada hover:bg-painel-2"><Check className="h-4 w-4" /></button>
          <button onClick={() => setEditando(false)} aria-label="Cancelar edição" className={BOTAO_ICONE}><X className="h-4 w-4" /></button>
        </>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <div className={`line-clamp-2 break-words text-[15px] leading-snug text-texto sm:text-sm ${p.concluida ? "line-through" : ""}`} title={p.descricao}>{p.descricao}</div>
            {p.automatica && (
              <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-apagado" title="O valor acompanha o total desta categoria no período">
                <Link2 className="h-3 w-3 shrink-0" />
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: categoria?.cor ?? "#6f8f91" }} />
                <span className="truncate">{categoria?.nome ?? "Categoria"} · automático</span>
              </div>
            )}
          </div>
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

export default function PrevisoesModal({ tituloPeriodo, previsoes, categorias, mapaCategorias, resumo, onClose, onCriar, onAtualizar, onExcluir }: Props) {
  const [tipo, setTipo] = useState<Direcao>("ENTRADA");
  const [modo, setModo] = useState<ModoValor>("FIXO");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const categoriaEscolhida = categorias.find((c) => c.id === categoriaId);

  const adicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    let dados: { tipo: Direcao; descricao: string; valor: string | null; categoria_id: string | null };
    if (modo === "CATEGORIA") {
      if (!categoriaEscolhida) return setErro("Escolha a categoria que esta previsão acompanha.");
      // sem descrição, usa um nome que explica a previsão sozinho
      const padrao = `${tipo === "ENTRADA" ? "Reembolso" : "Pagamento"} de ${categoriaEscolhida.nome}`;
      dados = { tipo, descricao: descricao.trim() || padrao, valor: null, categoria_id: categoriaEscolhida.id };
    } else {
      const v = lerValorBR(valor);
      if (!descricao.trim()) return setErro("Descreva a previsão (ex.: Salário, Aluguel).");
      if (!v) return setErro("Informe um valor maior que zero (ex.: 1.500,00).");
      dados = { tipo, descricao: descricao.trim(), valor: v, categoria_id: null };
    }
    setOcupado(true);
    const mensagem = await onCriar(dados);
    setOcupado(false);
    setErro(mensagem);
    if (!mensagem) {
      setDescricao("");
      setValor("");
      setCategoriaId("");
    }
  };

  const grupos: [string, Categoria[]][] = [
    ["Despesas", categorias.filter((c) => c.tipo === "SAIDA")],
    ["Entradas", categorias.filter((c) => c.tipo === "ENTRADA")],
  ];

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

      <form onSubmit={adicionar} className="mb-4 space-y-2.5 rounded-2xl border border-borda bg-fundo/40 p-3">
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

        <div className="flex items-center gap-2 text-sm" role="group" aria-label="Como definir o valor">
          <span className="text-apagado">Valor</span>
          {(["FIXO", "CATEGORIA"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              aria-pressed={modo === m}
              className={`rounded-full border px-3 py-1.5 transition-colors ${modo === m ? "border-latao/50 bg-latao/12 text-latao" : "border-borda text-suave hover:bg-painel-2"}`}
            >
              {m === "FIXO" ? "Fixo" : "Total de uma categoria"}
            </button>
          ))}
        </div>

        {modo === "CATEGORIA" && (
          <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} aria-label="Categoria acompanhada" className={CAMPO}>
            <option value="">Escolher categoria…</option>
            {grupos.map(([rotulo, lista]) =>
              lista.length ? (
                <optgroup key={rotulo} label={rotulo}>
                  {lista.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </optgroup>
              ) : null,
            )}
          </select>
        )}

        <div className="flex gap-2">
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={
              modo === "CATEGORIA"
                ? categoriaEscolhida ? `${tipo === "ENTRADA" ? "Reembolso" : "Pagamento"} de ${categoriaEscolhida.nome}` : "Descrição (opcional)"
                : tipo === "ENTRADA" ? "Ex.: Salário" : "Ex.: Aluguel"
            }
            aria-label="Descrição da previsão"
            maxLength={120}
            className={`${CAMPO} min-w-0 flex-1`}
          />
          {modo === "FIXO" && (
            <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" aria-label="Valor da previsão" inputMode="decimal" className={`${CAMPO} w-28!`} />
          )}
          <button type="submit" disabled={ocupado} aria-label="Adicionar previsão" className="botao-acao shrink-0 px-3!"><Plus className="h-5 w-5" /></button>
        </div>

        {modo === "CATEGORIA" && (
          <p className="px-1 text-xs leading-relaxed text-apagado">
            O valor acompanha sozinho o total da categoria neste período e sobe a cada novo lançamento.
          </p>
        )}
      </form>

      <ul className="space-y-2">
        {previsoes.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-borda py-8 text-center text-sm text-apagado">Nada anotado neste período. Adicione o que você espera receber ou pagar.</li>
        ) : (
          previsoes.map((p) => (
            <Linha
              key={p.id}
              p={p}
              categoria={p.categoria_id ? mapaCategorias.get(p.categoria_id) : undefined}
              onAtualizar={onAtualizar}
              onExcluir={onExcluir}
              onErro={setErro}
            />
          ))
        )}
      </ul>

      <p className="mt-4 text-xs leading-relaxed text-apagado">Quando o dinheiro entrar (ou o pagamento sair), marque a caixa: o valor já estará no saldo e deixa de entrar na conta.</p>
    </Folha>
  );
}
