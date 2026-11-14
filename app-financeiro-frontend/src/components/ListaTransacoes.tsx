import { useMemo, useState } from "react";
import { Eye, EyeOff, Search, X } from "lucide-react";
import { SEM_CATEGORIA, filtrarTransacoes, type InfoCategoria } from "../lib/calculos";
import { diaMes, moeda } from "../lib/format";
import type { Categoria, Transacao } from "../lib/types";

interface Props {
  transacoes: Transacao[];
  categorias: Categoria[];
  mapaCategorias: Map<string, InfoCategoria>;
  categoriaFiltro: string | null;
  onLimparCategoriaFiltro: () => void;
  carregando: boolean;
  onCategorizar: (ids: string[], categoriaId: string | null) => void;
  onIgnorar: (id: string, ignorar: boolean) => void;
}

const POR_PAGINA = 100;
const ROTULO_METODO: Record<Transacao["metodo"], string> = { PIX: "PIX", DEBITO: "Débito", CREDITO: "Crédito", OUTRO: "Outro" };
const ESTILO_SELECT =
  "rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-emerald-500";

/** Select de categoria: as categorias do mesmo tipo da transacao aparecem primeiro. */
function OpcoesCategoria({ categorias, tipoPrincipal }: { categorias: Categoria[]; tipoPrincipal: "ENTRADA" | "SAIDA" }) {
  const saidas = categorias.filter((c) => c.tipo === "SAIDA");
  const entradas = categorias.filter((c) => c.tipo === "ENTRADA");
  const grupos = tipoPrincipal === "SAIDA"
    ? [["Despesas", saidas], ["Entradas", entradas]] as const
    : [["Entradas", entradas], ["Despesas", saidas]] as const;
  return (
    <>
      {grupos.map(([rotulo, lista]) =>
        lista.length > 0 ? (
          <optgroup key={rotulo} label={rotulo}>
            {lista.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </optgroup>
        ) : null,
      )}
    </>
  );
}

export default function ListaTransacoes({
  transacoes, categorias, mapaCategorias, categoriaFiltro, onLimparCategoriaFiltro, carregando, onCategorizar, onIgnorar,
}: Props) {
  const [direcao, setDirecao] = useState<"TODAS" | "ENTRADA" | "SAIDA">("TODAS");
  const [mostrarIgnoradas, setMostrarIgnoradas] = useState(false);
  const [busca, setBusca] = useState("");
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [limite, setLimite] = useState(POR_PAGINA);
  const [categoriaEmLote, setCategoriaEmLote] = useState("");

  const filtradas = useMemo(
    () => filtrarTransacoes(transacoes, { direcao, categoria: categoriaFiltro, mostrarIgnoradas, busca }),
    [transacoes, direcao, categoriaFiltro, mostrarIgnoradas, busca],
  );
  const visiveis = filtradas.slice(0, limite);
  const semCategoria = transacoes.filter((t) => !t.ignorar_no_fluxo && t.categoria_id === null).length;
  const todasMarcadas = visiveis.length > 0 && visiveis.every((t) => selecionadas.has(t.id));

  const alternar = (id: string) =>
    setSelecionadas((atual) => {
      const novo = new Set(atual);
      if (!novo.delete(id)) novo.add(id);
      return novo;
    });

  const aplicarEmLote = () => {
    if (selecionadas.size === 0 || !categoriaEmLote) return;
    onCategorizar([...selecionadas], categoriaEmLote === SEM_CATEGORIA ? null : categoriaEmLote);
    setSelecionadas(new Set());
    setCategoriaEmLote("");
  };

  const nomeFiltro = categoriaFiltro === SEM_CATEGORIA ? "Sem categoria" : categoriaFiltro ? mapaCategorias.get(categoriaFiltro)?.nome : null;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 p-3">
        <div className="flex overflow-hidden rounded-lg border border-zinc-700 text-sm">
          {(["TODAS", "SAIDA", "ENTRADA"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDirecao(d)}
              className={`px-3 py-1.5 transition-colors ${direcao === d ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800"}`}
            >
              {d === "TODAS" ? "Todas" : d === "SAIDA" ? "Saídas" : "Entradas"}
            </button>
          ))}
        </div>
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar na descrição..."
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 py-1.5 pl-8 pr-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
          />
        </div>
        <button
          onClick={() => setMostrarIgnoradas((v) => !v)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
            mostrarIgnoradas ? "border-zinc-500 text-zinc-200" : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
          }`}
          title="Mostra transações marcadas como fora do fluxo (ex.: pagamento de fatura)"
        >
          {mostrarIgnoradas ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} Fora do fluxo
        </button>
      </div>

      {(nomeFiltro || semCategoria > 0) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-3 py-2 text-sm">
          {nomeFiltro && (
            <span className="flex items-center gap-1 rounded-full bg-zinc-800 px-3 py-1 text-zinc-200">
              Categoria: {nomeFiltro}
              <button onClick={onLimparCategoriaFiltro} aria-label="Remover filtro de categoria" className="text-zinc-400 hover:text-zinc-100">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
          {categoriaFiltro !== SEM_CATEGORIA && semCategoria > 0 && (
            <span className="text-zinc-400">{semCategoria} transação(ões) sem categoria neste mês. Clique em “Sem categoria” no gráfico para listar só as saídas.</span>
          )}
        </div>
      )}

      {/* Barra de ação em lote */}
      {selecionadas.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm">
          <span className="text-emerald-300">{selecionadas.size} selecionada(s)</span>
          <select value={categoriaEmLote} onChange={(e) => setCategoriaEmLote(e.target.value)} className={ESTILO_SELECT}>
            <option value="">Escolher categoria…</option>
            <option value={SEM_CATEGORIA}>Remover categoria</option>
            <OpcoesCategoria categorias={categorias} tipoPrincipal="SAIDA" />
          </select>
          <button onClick={aplicarEmLote} disabled={!categoriaEmLote} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-white transition-colors hover:bg-emerald-500 disabled:opacity-40">
            Aplicar
          </button>
          <button onClick={() => setSelecionadas(new Set())} className="text-zinc-400 hover:text-zinc-200">
            Limpar seleção
          </button>
        </div>
      )}

      {/* Lista */}
      {carregando ? (
        <p className="py-10 text-center text-sm text-zinc-500">Carregando…</p>
      ) : visiveis.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">Nenhuma transação encontrada.</p>
      ) : (
        <>
          <div className="flex items-center gap-3 border-b border-zinc-800/60 px-3 py-2 text-xs text-zinc-500">
            <input
              type="checkbox"
              checked={todasMarcadas}
              onChange={() => setSelecionadas(todasMarcadas ? new Set() : new Set(visiveis.map((t) => t.id)))}
              aria-label="Selecionar todas as transações visíveis"
            />
            {filtradas.length} transação(ões)
          </div>
          <ul>
            {visiveis.map((t) => (
              <li key={t.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-800/60 px-3 py-3 ${t.ignorar_no_fluxo ? "opacity-50" : ""}`}>
                <input type="checkbox" checked={selecionadas.has(t.id)} onChange={() => alternar(t.id)} aria-label={`Selecionar ${t.descricao}`} />
                <span className="w-11 shrink-0 text-xs tabular-nums text-zinc-500">{diaMes(t.data)}</span>
                <div className="min-w-0 flex-1 basis-44">
                  <div className="truncate text-sm text-zinc-100" title={t.descricao}>{t.descricao}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] text-zinc-500">
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5">{ROTULO_METODO[t.metodo]}</span>
                    {t.total_parcelas && t.total_parcelas > 1 && <span className="rounded bg-zinc-800 px-1.5 py-0.5">{t.parcela_atual ?? "?"}/{t.total_parcelas}</span>}
                    {t.status === "PENDENTE" && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-400">Pendente</span>}
                    {t.ignorar_no_fluxo && <span className="rounded bg-zinc-800 px-1.5 py-0.5">Fora do fluxo</span>}
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
                <button
                  onClick={() => onIgnorar(t.id, !t.ignorar_no_fluxo)}
                  className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                  title={t.ignorar_no_fluxo ? "Voltar a contar no fluxo de caixa" : "Não contar no fluxo de caixa (ex.: pagamento de fatura)"}
                >
                  {t.ignorar_no_fluxo ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
              </li>
            ))}
          </ul>
          {filtradas.length > limite && (
            <button onClick={() => setLimite((l) => l + POR_PAGINA)} className="w-full py-3 text-sm text-emerald-400 transition-colors hover:bg-zinc-800/50">
              Mostrar mais ({filtradas.length - limite} restantes)
            </button>
          )}
        </>
      )}
    </section>
  );
}
