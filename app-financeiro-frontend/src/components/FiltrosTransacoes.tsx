import { useEffect, useRef, useState } from "react";
import { ChevronDown, Eye, EyeOff, Search, X } from "lucide-react";
import { SEM_CATEGORIA, contarFiltrosAtivos, FILTROS_VAZIOS, type Filtros, type InfoCategoria } from "../lib/calculos";
import type { Categoria, Metodo } from "../lib/types";

interface Props {
  filtros: Filtros;
  onChange: (novo: Filtros) => void;
  categorias: Categoria[];
  mapaCategorias: Map<string, InfoCategoria>;
}

const METODOS: { valor: Metodo; rotulo: string }[] = [
  { valor: "PIX", rotulo: "PIX" },
  { valor: "DEBITO", rotulo: "Débito" },
  { valor: "CREDITO", rotulo: "Crédito" },
  { valor: "OUTRO", rotulo: "Outro" },
];

const BOTAO_BASE = "rounded-lg border px-3 py-1.5 text-sm transition-colors";
const ATIVO = "border-emerald-500/60 bg-emerald-500/10 text-emerald-300";
const INATIVO = "border-zinc-700 text-zinc-400 hover:bg-zinc-800";

function Opcao({ id, nome, cor, marcada, onAlternar }: { id: string; nome: string; cor?: string; marcada: boolean; onAlternar: (id: string) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800">
      <input type="checkbox" checked={marcada} onChange={() => onAlternar(id)} />
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: cor ?? "#71717a" }} />
      <span className="truncate">{nome}</span>
    </label>
  );
}

function SeletorCategorias({ selecionadas, categorias, mapa, onChange }: { selecionadas: string[]; categorias: Categoria[]; mapa: Map<string, InfoCategoria>; onChange: (ids: string[]) => void }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const aoClicarFora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const aoApertarTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoApertarTecla);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoApertarTecla);
    };
  }, [aberto]);

  const alternar = (id: string) => onChange(selecionadas.includes(id) ? selecionadas.filter((c) => c !== id) : [...selecionadas, id]);
  const grupos: [string, Categoria[]][] = [
    ["Despesas", categorias.filter((c) => c.tipo === "SAIDA")],
    ["Entradas", categorias.filter((c) => c.tipo === "ENTRADA")],
  ];

  return (
    <div className="relative" ref={caixa}>
      <button
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className={`${BOTAO_BASE} flex items-center gap-1.5 ${selecionadas.length ? ATIVO : INATIVO}`}
      >
        Categorias{selecionadas.length > 0 && ` (${selecionadas.length})`} <ChevronDown className="h-4 w-4" />
      </button>
      {aberto && (
        <div role="listbox" className="absolute left-0 z-20 mt-1 max-h-80 w-60 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-2 shadow-2xl">
          <Opcao id={SEM_CATEGORIA} nome="Sem categoria" marcada={selecionadas.includes(SEM_CATEGORIA)} onAlternar={alternar} />
          {grupos.map(([titulo, lista]) =>
            lista.length > 0 ? (
              <div key={titulo} className="mt-1 border-t border-zinc-800 pt-1">
                <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-zinc-500">{titulo}</div>
                {lista.map((c) => (
                  <Opcao key={c.id} id={c.id} nome={c.nome} cor={mapa.get(c.id)?.cor} marcada={selecionadas.includes(c.id)} onAlternar={alternar} />
                ))}
              </div>
            ) : null,
          )}
          {selecionadas.length > 0 && (
            <button onClick={() => onChange([])} className="mt-2 w-full rounded-md py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">
              Limpar categorias
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function FiltrosTransacoes({ filtros, onChange, categorias, mapaCategorias }: Props) {
  const ativos = contarFiltrosAtivos(filtros);
  const alternarMetodo = (m: Metodo) =>
    onChange({ ...filtros, metodos: filtros.metodos.includes(m) ? filtros.metodos.filter((x) => x !== m) : [...filtros.metodos, m] });

  return (
    <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-3" aria-label="Filtros">
      <div className="relative min-w-48 flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
        <input
          value={filtros.busca}
          onChange={(e) => onChange({ ...filtros, busca: e.target.value })}
          placeholder="Buscar na descrição..."
          aria-label="Buscar na descrição"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 py-1.5 pl-8 pr-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
        />
      </div>

      <div className="flex overflow-hidden rounded-lg border border-zinc-700 text-sm" role="group" aria-label="Entradas e saídas">
        {(["TODAS", "SAIDA", "ENTRADA"] as const).map((d) => (
          <button
            key={d}
            onClick={() => onChange({ ...filtros, direcao: d })}
            aria-pressed={filtros.direcao === d}
            className={`px-3 py-1.5 transition-colors ${filtros.direcao === d ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800"}`}
          >
            {d === "TODAS" ? "Todas" : d === "SAIDA" ? "Saídas" : "Entradas"}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Forma de pagamento">
        {METODOS.map((m) => (
          <button key={m.valor} onClick={() => alternarMetodo(m.valor)} aria-pressed={filtros.metodos.includes(m.valor)} className={`${BOTAO_BASE} ${filtros.metodos.includes(m.valor) ? ATIVO : INATIVO}`}>
            {m.rotulo}
          </button>
        ))}
      </div>

      <SeletorCategorias selecionadas={filtros.categorias} categorias={categorias} mapa={mapaCategorias} onChange={(ids) => onChange({ ...filtros, categorias: ids })} />

      <button
        onClick={() => onChange({ ...filtros, mostrarIgnoradas: !filtros.mostrarIgnoradas })}
        aria-pressed={filtros.mostrarIgnoradas}
        title="Mostra transações marcadas como fora do fluxo (ex.: pagamento de fatura)"
        className={`${BOTAO_BASE} flex items-center gap-1.5 ${filtros.mostrarIgnoradas ? ATIVO : INATIVO}`}
      >
        {filtros.mostrarIgnoradas ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} Fora do fluxo
      </button>

      {ativos > 0 && (
        <button onClick={() => onChange(FILTROS_VAZIOS)} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-100">
          <X className="h-4 w-4" /> Limpar filtros ({ativos})
        </button>
      )}
    </section>
  );
}
