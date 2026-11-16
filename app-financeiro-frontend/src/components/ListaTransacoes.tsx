import { useState } from "react";
import { Eye, EyeOff, Pencil } from "lucide-react";
import { SEM_CATEGORIA, type InfoCategoria } from "../lib/calculos";
import { diaMes, moeda } from "../lib/format";
import type { Categoria, Transacao } from "../lib/types";

interface Props {
  transacoes: Transacao[]; // ja filtradas
  categorias: Categoria[];
  mapaCategorias: Map<string, InfoCategoria>;
  carregando: boolean;
  filtrosAtivos: number;
  resumoFiltro: { entradas: number; saidas: number };
  semCategoria: number; // no mes todo, sem considerar filtros
  onVerSemCategoria: () => void;
  onCategorizar: (ids: string[], categoriaId: string | null) => void;
  onIgnorar: (id: string, ignorar: boolean) => void;
  onEditar: (transacao: Transacao) => void;
}

const POR_PAGINA = 100;
const ROTULO_METODO: Record<Transacao["metodo"], string> = { PIX: "PIX", DEBITO: "Débito", CREDITO: "Crédito", OUTRO: "Outro" };
const ESTILO_SELECT = "rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-emerald-500";
const BOTAO_ICONE = "rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200";

/** Select de categoria: as categorias do mesmo tipo da transacao aparecem primeiro. */
function OpcoesCategoria({ categorias, tipoPrincipal }: { categorias: Categoria[]; tipoPrincipal: "ENTRADA" | "SAIDA" }) {
  const saidas = categorias.filter((c) => c.tipo === "SAIDA");
  const entradas = categorias.filter((c) => c.tipo === "ENTRADA");
  const grupos = tipoPrincipal === "SAIDA"
    ? ([["Despesas", saidas], ["Entradas", entradas]] as const)
    : ([["Entradas", entradas], ["Despesas", saidas]] as const);
  return (
    <>
      {grupos.map(([rotulo, lista]) =>
        lista.length > 0 ? (
          <optgroup key={rotulo} label={rotulo}>
            {lista.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </optgroup>
        ) : null,
      )}
    </>
  );
}

export default function ListaTransacoes({
  transacoes, categorias, mapaCategorias, carregando, filtrosAtivos, resumoFiltro, semCategoria,
  onVerSemCategoria, onCategorizar, onIgnorar, onEditar,
}: Props) {
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [limite, setLimite] = useState(POR_PAGINA);
  const [categoriaEmLote, setCategoriaEmLote] = useState("");

  const visiveis = transacoes.slice(0, limite);
  // so vale para o que esta na tela: um filtro novo nunca faz o "Aplicar" atingir linhas escondidas
  const idsSelecionados = visiveis.filter((t) => selecionadas.has(t.id)).map((t) => t.id);
  const todasMarcadas = visiveis.length > 0 && idsSelecionados.length === visiveis.length;

  const alternar = (id: string) =>
    setSelecionadas((atual) => {
      const novo = new Set(atual);
      if (!novo.delete(id)) novo.add(id);
      return novo;
    });

  const aplicarEmLote = () => {
    if (idsSelecionados.length === 0 || !categoriaEmLote) return;
    onCategorizar(idsSelecionados, categoriaEmLote === SEM_CATEGORIA ? null : categoriaEmLote);
    setSelecionadas(new Set());
    setCategoriaEmLote("");
  };

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900">
      {semCategoria > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-3 py-2 text-sm text-zinc-400">
          {semCategoria} transação(ões) sem categoria neste mês.
          <button onClick={onVerSemCategoria} className="text-emerald-400 hover:text-emerald-300">Ver só essas</button>
        </div>
      )}

      {idsSelecionados.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm">
          <span className="text-emerald-300">{idsSelecionados.length} selecionada(s)</span>
          <select value={categoriaEmLote} onChange={(e) => setCategoriaEmLote(e.target.value)} className={ESTILO_SELECT} aria-label="Categoria para as selecionadas">
            <option value="">Escolher categoria…</option>
            <option value={SEM_CATEGORIA}>Remover categoria</option>
            <OpcoesCategoria categorias={categorias} tipoPrincipal="SAIDA" />
          </select>
          <button onClick={aplicarEmLote} disabled={!categoriaEmLote} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-white transition-colors hover:bg-emerald-500 disabled:opacity-40">Aplicar</button>
          <button onClick={() => setSelecionadas(new Set())} className="text-zinc-400 hover:text-zinc-200">Limpar seleção</button>
        </div>
      )}

      {carregando ? (
        <p className="py-10 text-center text-sm text-zinc-500">Carregando…</p>
      ) : visiveis.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">Nenhuma transação encontrada com os filtros atuais.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-zinc-800/60 px-3 py-2 text-xs text-zinc-500">
            <input type="checkbox" checked={todasMarcadas} onChange={() => setSelecionadas(todasMarcadas ? new Set() : new Set(visiveis.map((t) => t.id)))} aria-label="Selecionar todas as transações visíveis" />
            <span>{transacoes.length} transação(ões)</span>
            {filtrosAtivos > 0 && (
              <span className="text-zinc-400">
                no filtro: entradas {moeda(resumoFiltro.entradas)} · saídas {moeda(resumoFiltro.saidas)}
              </span>
            )}
          </div>
          <ul>
            {visiveis.map((t) => {
              const descricaoEditada = t.campos_editados.includes("descricao");
              return (
                <li key={t.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-800/60 px-3 py-3 ${t.ignorar_no_fluxo ? "opacity-50" : ""}`}>
                  <input type="checkbox" checked={selecionadas.has(t.id)} onChange={() => alternar(t.id)} aria-label={`Selecionar ${t.descricao}`} />
                  <span className="w-11 shrink-0 text-xs tabular-nums text-zinc-500">{diaMes(t.data)}</span>
                  <div className="min-w-0 flex-1 basis-44">
                    <div className="truncate text-sm text-zinc-100" title={t.descricao}>{t.descricao}</div>
                    {descricaoEditada && <div className="truncate text-[11px] text-zinc-500" title={t.original.descricao}>Banco: {t.original.descricao}</div>}
                    <div className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] text-zinc-500">
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5">{ROTULO_METODO[t.metodo]}</span>
                      {t.total_parcelas && t.total_parcelas > 1 && <span className="rounded bg-zinc-800 px-1.5 py-0.5">{t.parcela_atual ?? "?"}/{t.total_parcelas}</span>}
                      {t.status === "PENDENTE" && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-400">Pendente</span>}
                      {t.ignorar_no_fluxo && <span className="rounded bg-zinc-800 px-1.5 py-0.5">Fora do fluxo</span>}
                      {t.campos_editados.length > 0 && <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-sky-400" title={`Editado por você: ${t.campos_editados.join(", ")}`}>Editada</span>}
                    </div>
                  </div>
                  <span className={`w-28 shrink-0 text-right text-sm font-medium tabular-nums ${t.direcao === "ENTRADA" ? "text-emerald-400" : "text-rose-400"}`}>
                    {t.direcao === "ENTRADA" ? "+" : "−"} {moeda(t.valor)}
                  </span>
                  <select
                    value={t.categoria_id ?? ""}
                    onChange={(e) => onCategorizar([t.id], e.target.value || null)}
                    className={`${ESTILO_SELECT} w-44 max-w-full`}
                    aria-label={`Categoria de ${t.descricao}`}
                    style={t.categoria_id ? { borderLeft: `4px solid ${mapaCategorias.get(t.categoria_id)?.cor ?? "#71717a"}` } : undefined}
                  >
                    <option value="">Sem categoria</option>
                    <OpcoesCategoria categorias={categorias} tipoPrincipal={t.direcao} />
                  </select>
                  <button onClick={() => onEditar(t)} className={BOTAO_ICONE} title="Editar transação" aria-label={`Editar ${t.descricao}`}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onIgnorar(t.id, !t.ignorar_no_fluxo)}
                    className={BOTAO_ICONE}
                    title={t.ignorar_no_fluxo ? "Voltar a contar no fluxo de caixa" : "Não contar no fluxo de caixa (ex.: pagamento de fatura)"}
                  >
                    {t.ignorar_no_fluxo ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                </li>
              );
            })}
          </ul>
          {transacoes.length > limite && (
            <button onClick={() => setLimite((l) => l + POR_PAGINA)} className="w-full py-3 text-sm text-emerald-400 transition-colors hover:bg-zinc-800/50">
              Mostrar mais ({transacoes.length - limite} restantes)
            </button>
          )}
        </>
      )}
    </section>
  );
}
