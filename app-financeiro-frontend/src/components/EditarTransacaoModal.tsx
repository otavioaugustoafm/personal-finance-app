import { useEffect, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { dataCompleta, moeda } from "../lib/format";
import type { Categoria, Direcao, Metodo, Transacao } from "../lib/types";

interface Props {
  transacao: Transacao;
  categorias: Categoria[];
  onClose: () => void;
  /** Devolve null se deu certo, ou a mensagem de erro para mostrar no formulario. */
  onSalvar: (id: string, alteracoes: Record<string, unknown>) => Promise<string | null>;
  onRestaurar: (id: string) => Promise<string | null>;
}

const ROTULO_METODO: Record<Metodo, string> = { PIX: "PIX", DEBITO: "Débito", CREDITO: "Crédito", OUTRO: "Outro" };
const CAMPO = "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500";

/** Aceita "55,90", "55.90" e "1.234,56". Devolve "1234.56" ou null se invalido. */
function lerValor(texto: string): string | null {
  const t = texto.trim().replace(/^R\$\s*/, "");
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  return /^\d+(\.\d{1,2})?$/.test(normal) && Number(normal) > 0 ? normal : null;
}

function lerParcela(texto: string): number | null | "invalido" {
  if (texto.trim() === "") return null;
  const n = Number(texto);
  return Number.isInteger(n) && n >= 1 && n <= 999 ? n : "invalido";
}

function Campo({ rotulo, id, dica, children }: { rotulo: string; id: string; dica?: string | null; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-zinc-400">{rotulo}</label>
      {children}
      {dica && <p className="mt-1 text-xs text-amber-400/90">Banco informou: {dica}</p>}
    </div>
  );
}

export default function EditarTransacaoModal({ transacao: t, categorias, onClose, onSalvar, onRestaurar }: Props) {
  const [descricao, setDescricao] = useState(t.descricao);
  const [valor, setValor] = useState(t.valor.toFixed(2).replace(".", ","));
  const [data, setData] = useState(t.data);
  const [direcao, setDirecao] = useState<Direcao>(t.direcao);
  const [metodo, setMetodo] = useState<Metodo>(t.metodo);
  const [categoriaId, setCategoriaId] = useState(t.categoria_id ?? "");
  const [parcelaAtual, setParcelaAtual] = useState(t.parcela_atual?.toString() ?? "");
  const [totalParcelas, setTotalParcelas] = useState(t.total_parcelas?.toString() ?? "");
  const [ignorar, setIgnorar] = useState(t.ignorar_no_fluxo);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmandoRestauracao, setConfirmandoRestauracao] = useState(false);

  useEffect(() => {
    const aoApertar = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", aoApertar);
    return () => document.removeEventListener("keydown", aoApertar);
  }, [onClose]);

  const o = t.original;
  const editado = (campo: string) => t.campos_editados.includes(campo);
  const tiposDeCategoria: Direcao[] = direcao === "SAIDA" ? ["SAIDA", "ENTRADA"] : ["ENTRADA", "SAIDA"];

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const desc = descricao.trim();
    const v = lerValor(valor);
    const pa = lerParcela(parcelaAtual);
    const tp = lerParcela(totalParcelas);
    if (!desc) return setErro("A descrição não pode ficar vazia.");
    if (!v) return setErro("Informe um valor maior que zero, com até 2 casas decimais (ex.: 55,90).");
    if (!data) return setErro("Informe a data.");
    if (pa === "invalido" || tp === "invalido") return setErro("Parcelas devem ser números inteiros de 1 a 999 (ou vazias).");
    if (pa && tp && pa > tp) return setErro("A parcela atual não pode ser maior que o total.");

    const alteracoes: Record<string, unknown> = {};
    if (desc !== t.descricao) alteracoes.descricao = desc;
    if (Math.round(Number(v) * 100) !== Math.round(t.valor * 100)) alteracoes.valor = v;
    if (data !== t.data) alteracoes.data = data;
    if (direcao !== t.direcao) alteracoes.direcao = direcao;
    if (metodo !== t.metodo) alteracoes.metodo = metodo;
    if ((categoriaId || null) !== t.categoria_id) alteracoes.categoria_id = categoriaId || null;
    if (pa !== t.parcela_atual) alteracoes.parcela_atual = pa;
    if (tp !== t.total_parcelas) alteracoes.total_parcelas = tp;
    if (ignorar !== t.ignorar_no_fluxo) alteracoes.ignorar_no_fluxo = ignorar;

    if (Object.keys(alteracoes).length === 0) return onClose();
    setOcupado(true);
    const mensagem = await onSalvar(t.id, alteracoes);
    setOcupado(false);
    if (mensagem) setErro(mensagem);
    else onClose();
  };

  const restaurar = async () => {
    setOcupado(true);
    const mensagem = await onRestaurar(t.id);
    setOcupado(false);
    if (mensagem) setErro(mensagem);
    else onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-edicao" className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="titulo-edicao" className="text-base font-semibold text-zinc-100">Editar transação</h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={salvar} className="space-y-3">
          {erro && <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{erro}</div>}

          <Campo rotulo="Descrição" id="ed-descricao" dica={editado("descricao") ? o.descricao : null}>
            <input id="ed-descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={200} autoFocus className={CAMPO} />
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Valor (R$)" id="ed-valor" dica={editado("valor") ? moeda(Number(o.valor)) : null}>
              <input id="ed-valor" value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" className={CAMPO} />
            </Campo>
            <Campo rotulo="Data" id="ed-data" dica={editado("data") ? dataCompleta(o.data) : null}>
              <input id="ed-data" type="date" value={data} onChange={(e) => setData(e.target.value)} className={CAMPO} />
            </Campo>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Tipo" id="ed-direcao" dica={editado("direcao") ? (o.direcao === "SAIDA" ? "Saída" : "Entrada") : null}>
              <select id="ed-direcao" value={direcao} onChange={(e) => setDirecao(e.target.value as Direcao)} className={CAMPO}>
                <option value="SAIDA">Saída</option>
                <option value="ENTRADA">Entrada</option>
              </select>
            </Campo>
            <Campo rotulo="Forma" id="ed-metodo" dica={editado("metodo") ? ROTULO_METODO[o.metodo] : null}>
              <select id="ed-metodo" value={metodo} onChange={(e) => setMetodo(e.target.value as Metodo)} className={CAMPO}>
                {(Object.keys(ROTULO_METODO) as Metodo[]).map((m) => (
                  <option key={m} value={m}>{ROTULO_METODO[m]}</option>
                ))}
              </select>
            </Campo>
          </div>

          <Campo rotulo="Categoria" id="ed-categoria">
            <select id="ed-categoria" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className={CAMPO}>
              <option value="">Sem categoria</option>
              {tiposDeCategoria.map((tipo) => {
                const lista = categorias.filter((c) => c.tipo === tipo);
                return lista.length ? (
                  <optgroup key={tipo} label={tipo === "SAIDA" ? "Despesas" : "Entradas"}>
                    {lista.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </optgroup>
                ) : null;
              })}
            </select>
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Parcela atual" id="ed-parcela" dica={editado("parcela_atual") ? String(o.parcela_atual ?? "—") : null}>
              <input id="ed-parcela" value={parcelaAtual} onChange={(e) => setParcelaAtual(e.target.value)} inputMode="numeric" placeholder="—" className={CAMPO} />
            </Campo>
            <Campo rotulo="Total de parcelas" id="ed-total" dica={editado("total_parcelas") ? String(o.total_parcelas ?? "—") : null}>
              <input id="ed-total" value={totalParcelas} onChange={(e) => setTotalParcelas(e.target.value)} inputMode="numeric" placeholder="—" className={CAMPO} />
            </Campo>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={ignorar} onChange={(e) => setIgnorar(e.target.checked)} />
            Não contar no fluxo de caixa (ex.: pagamento de fatura)
          </label>

          <p className="text-xs text-zinc-500">O que você editar não é desfeito pela sincronização diária. Campos que você não mexer continuam acompanhando o banco.</p>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {t.campos_editados.length > 0 ? (
              confirmandoRestauracao ? (
                <span className="flex items-center gap-2 text-sm">
                  <button type="button" onClick={restaurar} disabled={ocupado} className="rounded-lg bg-amber-600 px-3 py-1.5 text-white hover:bg-amber-500 disabled:opacity-50">Confirmar</button>
                  <button type="button" onClick={() => setConfirmandoRestauracao(false)} className="text-zinc-400 hover:text-zinc-200">Voltar</button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmandoRestauracao(true)} className="flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300">
                  <RotateCcw className="h-4 w-4" /> Restaurar valores do banco
                </button>
              )
            ) : <span />}
            <span className="flex gap-2">
              <button type="button" onClick={onClose} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800">Cancelar</button>
              <button type="submit" disabled={ocupado} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
                {ocupado ? "Salvando..." : "Salvar"}
              </button>
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
