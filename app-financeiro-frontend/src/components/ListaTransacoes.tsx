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
const BOTAO_ICONE = "rounded-full p-2 text-apagado transition-colors hover:bg-painel-2 hover:text-texto";
const ETIQUETA = "rounded-md bg-fundo px-1.5 py-0.5";

/** "2026-11-19" -> "Hoje", "Ontem" ou "seg., 17 de nov." (sem Date em UTC, para não trocar o dia pelo fuso). */
function rotuloDoDia(data: string): string {
  const [a, m, d] = data.split("-").map(Number);
  const dia = new Date(a, m - 1, d);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diferenca = Math.round((hoje.getTime() - dia.getTime()) / 86_400_000);
  if (diferenca === 0) return "Hoje";
  if (diferenca === 1) return "Ontem";
  // "segunda, 16 de nov." — o dia da semana por extenso é mais fácil de achar passando o olho
  const semana = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(dia).replace("-feira", "");
  const diaEMes = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" }).format(dia);
  return `${semana}, ${diaEMes}`;
}

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

  // agrupa as linhas por dia, na ordem em que já vêm da API
  const grupos: { data: string; itens: Transacao[] }[] = [];
  for (const t of visiveis) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.data === t.data) ultimo.itens.push(t);
    else grupos.push({ data: t.data, itens: [t] });
  }

  return (
    <section className="overflow-clip rounded-3xl border border-borda bg-painel">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-borda px-4 py-3">
        <h2 className="font-display text-lg font-semibold tracking-tight text-texto">Transações</h2>
        {!carregando && (
          <span className="text-sm text-apagado">
            {transacoes.length} {transacoes.length === 1 ? "lançamento" : "lançamentos"}
          </span>
        )}
      </div>

      {semCategoria > 0 && (
        <button
          onClick={onVerSemCategoria}
          className="flex w-full items-center justify-between gap-3 border-b border-borda bg-latao/[0.06] px-4 py-3 text-left text-sm text-suave transition-colors hover:bg-latao/10"
        >
          <span>
            <span className="font-semibold text-latao">{semCategoria}</span> {semCategoria === 1 ? "transação está" : "transações estão"} sem categoria
          </span>
          <span className="shrink-0 font-medium text-latao">Categorizar</span>
        </button>
      )}

      {idsSelecionados.length > 0 && (
        <div className="pb-seguro fixed inset-x-0 bottom-0 z-30 flex flex-wrap items-center gap-2 border-t border-borda-forte bg-painel-2 px-4 pt-3 shadow-[0_-12px_32px_rgba(0,0,0,0.4)] sm:static sm:z-auto sm:border-t-0 sm:border-b sm:border-borda sm:bg-latao/[0.06] sm:py-2.5 sm:shadow-none">
          <span className="w-full text-sm font-medium text-latao sm:w-auto">
            {idsSelecionados.length} {idsSelecionados.length === 1 ? "selecionada" : "selecionadas"}
          </span>
          <select value={categoriaEmLote} onChange={(e) => setCategoriaEmLote(e.target.value)} className="campo min-w-0 flex-1 sm:w-56 sm:flex-none" aria-label="Categoria para as selecionadas">
            <option value="">Escolher categoria…</option>
            <option value={SEM_CATEGORIA}>Remover categoria</option>
            <OpcoesCategoria categorias={categorias} tipoPrincipal="SAIDA" />
          </select>
          <button onClick={aplicarEmLote} disabled={!categoriaEmLote} className="botao-acao">Aplicar</button>
          <button onClick={() => setSelecionadas(new Set())} className="px-2 py-2 text-sm text-suave hover:text-texto">Cancelar</button>
        </div>
      )}

      {carregando ? (
        <div className="space-y-px" aria-label="Carregando transações">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-4">
              <div className="h-4 w-4 rounded bg-painel-2" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-2/3 animate-pulse rounded-full bg-painel-2" />
                <div className="h-3 w-1/3 animate-pulse rounded-full bg-painel-2/70" />
              </div>
              <div className="h-3.5 w-20 animate-pulse rounded-full bg-painel-2" />
            </div>
          ))}
        </div>
      ) : visiveis.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-apagado">Nenhuma transação com esses filtros. Tente limpar a busca ou trocar de período.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm text-apagado">
            <label className="flex items-center gap-2.5">
              <input type="checkbox" checked={todasMarcadas} onChange={() => setSelecionadas(todasMarcadas ? new Set() : new Set(visiveis.map((t) => t.id)))} aria-label="Selecionar todas as transações visíveis" />
              Selecionar todas
            </label>
            {filtrosAtivos > 0 && (
              <span className="ml-auto tabular-nums">
                <span className="text-entrada">+{moeda(resumoFiltro.entradas)}</span>
                <span className="mx-1.5 text-borda-forte">/</span>
                <span className="text-saida">−{moeda(resumoFiltro.saidas)}</span>
              </span>
            )}
          </div>

          {grupos.map((g) => (
            <div key={g.data}>
              <div className="sticky top-[calc(env(safe-area-inset-top)+4rem)] z-10 flex items-baseline gap-2 border-y border-borda bg-painel-2/95 px-4 py-2.5 backdrop-blur">
                <span className="font-display text-base font-semibold tracking-tight text-texto first-letter:uppercase">{rotuloDoDia(g.data)}</span>
                {/* "Hoje" e "Ontem" ganham a data ao lado; os outros dias já trazem o dia no rótulo */}
                {["Hoje", "Ontem"].includes(rotuloDoDia(g.data)) && <span className="text-sm text-apagado">{diaMes(g.data)}</span>}
              </div>
              <ul>
                {g.itens.map((t) => {
                  const descricaoEditada = t.campos_editados.includes("descricao");
                  const cor = t.categoria_id ? mapaCategorias.get(t.categoria_id)?.cor ?? "#6f8f91" : null;
                  const marcada = selecionadas.has(t.id);
                  return (
                    <li
                      key={t.id}
                      className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-borda/60 px-4 py-3 last:border-b-0 sm:grid-cols-[auto_minmax(0,1fr)_11rem_8rem_auto] ${marcada ? "bg-latao/[0.06]" : ""} ${t.ignorar_no_fluxo ? "opacity-50" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={marcada}
                        onChange={() => alternar(t.id)}
                        aria-label={`Selecionar ${t.descricao}`}
                        className="row-span-2 mt-0.5 self-start sm:row-span-1 sm:mt-0 sm:self-center"
                      />
                      <button onClick={() => onEditar(t)} className="min-w-0 rounded-lg text-left" title="Editar transação">
                        <div className="truncate text-[15px] text-texto sm:text-sm">{t.descricao}</div>
                        {descricaoEditada && <div className="truncate text-xs text-apagado">Banco: {t.original.descricao}</div>}
                        <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-suave">
                          <span className={ETIQUETA}>{ROTULO_METODO[t.metodo]}</span>
                          {t.total_parcelas && t.total_parcelas > 1 && <span className={ETIQUETA}>{t.parcela_atual ?? "?"}/{t.total_parcelas}</span>}
                          {t.status === "PENDENTE" && <span className="rounded-md bg-aviso/10 px-1.5 py-0.5 text-aviso">Pendente</span>}
                          {t.ignorar_no_fluxo && <span className={ETIQUETA}>Fora do fluxo</span>}
                          {t.campos_editados.length > 0 && <span className="rounded-md bg-info/10 px-1.5 py-0.5 text-info" title={`Editado por você: ${t.campos_editados.join(", ")}`}>Editada</span>}
                        </div>
                      </button>
                      <span className={`text-right font-medium tabular-nums sm:order-2 ${t.direcao === "ENTRADA" ? "text-entrada" : "text-texto"}`}>
                        {t.direcao === "ENTRADA" ? "+" : "−"}
                        {moeda(t.valor)}
                      </span>
                      <span className="relative col-start-2 min-w-0 justify-self-start sm:order-1 sm:col-start-auto sm:w-full">
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute left-2.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
                          style={cor ? { backgroundColor: cor } : { border: "1.5px dashed #6f8f91" }}
                        />
                        <select
                          value={t.categoria_id ?? ""}
                          onChange={(e) => onCategorizar([t.id], e.target.value || null)}
                          className={`pilula w-full ${t.categoria_id ? "" : "text-apagado!"}`}
                          aria-label={`Categoria de ${t.descricao}`}
                        >
                          <option value="">Sem categoria</option>
                          <OpcoesCategoria categorias={categorias} tipoPrincipal={t.direcao} />
                        </select>
                      </span>
                      <span className="-mr-2 flex items-center justify-end sm:order-3">
                        <button onClick={() => onEditar(t)} className={BOTAO_ICONE} title="Editar transação" aria-label={`Editar ${t.descricao}`}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onIgnorar(t.id, !t.ignorar_no_fluxo)}
                          className={BOTAO_ICONE}
                          aria-label={t.ignorar_no_fluxo ? `Voltar a contar ${t.descricao} no fluxo` : `Tirar ${t.descricao} do fluxo de caixa`}
                          title={t.ignorar_no_fluxo ? "Voltar a contar no fluxo de caixa" : "Não contar no fluxo de caixa (ex.: pagamento de fatura)"}
                        >
                          {t.ignorar_no_fluxo ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {transacoes.length > limite && (
            <button onClick={() => setLimite((l) => l + POR_PAGINA)} className="w-full border-t border-borda py-4 text-sm font-medium text-latao transition-colors hover:bg-painel-2/60">
              Mostrar mais {Math.min(POR_PAGINA, transacoes.length - limite)} de {transacoes.length - limite}
            </button>
          )}
        </>
      )}
    </section>
  );
}
