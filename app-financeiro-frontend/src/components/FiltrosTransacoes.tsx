import { useEffect, useRef, useState } from "react";
import { ChevronDown, Eye, EyeOff, Search, SlidersHorizontal, X } from "lucide-react";
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

const BOTAO_BASE = "rounded-full border px-3.5 py-2 text-sm whitespace-nowrap transition-colors sm:py-1.5";
const ATIVO = "border-latao/50 bg-latao/12 text-latao";
const INATIVO = "border-borda text-suave hover:bg-painel-2 hover:text-texto";

function Opcao({ id, nome, cor, marcada, onAlternar }: { id: string; nome: string; cor?: string; marcada: boolean; onAlternar: (id: string) => void }) {
  return (
    <label className="flex items-center gap-2.5 rounded-lg px-2 py-2.5 text-[15px] text-texto hover:bg-painel-2 sm:py-1.5 sm:text-sm">
      <input type="checkbox" checked={marcada} onChange={() => onAlternar(id)} />
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: cor ?? "#6f8f91" }} />
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
    <div className="sm:relative" ref={caixa}>
      <button
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className={`${BOTAO_BASE} flex items-center gap-1.5 ${selecionadas.length ? ATIVO : INATIVO}`}
      >
        Categorias{selecionadas.length > 0 && ` (${selecionadas.length})`} <ChevronDown className="h-4 w-4" />
      </button>
      {aberto && (
        <div role="listbox" className="rolagem-fina absolute inset-x-3 z-20 mt-2 max-h-[60vh] overflow-y-auto rounded-2xl border border-borda-forte bg-painel p-2 shadow-[0_16px_40px_rgba(0,0,0,0.45)] sm:inset-x-auto sm:left-0 sm:w-64 sm:max-h-80">
          <Opcao id={SEM_CATEGORIA} nome="Sem categoria" marcada={selecionadas.includes(SEM_CATEGORIA)} onAlternar={alternar} />
          {grupos.map(([titulo, lista]) =>
            lista.length > 0 ? (
              <div key={titulo} className="mt-1 border-t border-borda pt-1">
                <div className="px-2 pb-1 pt-2 text-xs font-medium text-apagado">{titulo}</div>
                {lista.map((c) => (
                  <Opcao key={c.id} id={c.id} nome={c.nome} cor={mapa.get(c.id)?.cor} marcada={selecionadas.includes(c.id)} onAlternar={alternar} />
                ))}
              </div>
            ) : null,
          )}
          {selecionadas.length > 0 && (
            <button onClick={() => onChange([])} className="mt-2 w-full rounded-lg py-2.5 text-sm text-suave hover:bg-painel-2 hover:text-texto">
              Limpar categorias
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function FiltrosTransacoes({ filtros, onChange, categorias, mapaCategorias }: Props) {
  const [abertoNoCelular, setAbertoNoCelular] = useState(false);
  const ativos = contarFiltrosAtivos(filtros);
  const ativosSemBusca = ativos - (filtros.busca.trim() ? 1 : 0);
  const alternarMetodo = (m: Metodo) =>
    onChange({ ...filtros, metodos: filtros.metodos.includes(m) ? filtros.metodos.filter((x) => x !== m) : [...filtros.metodos, m] });

  return (
    <section className="relative rounded-3xl border border-borda bg-painel p-3" aria-label="Filtros">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:w-full sm:flex-none">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-apagado" />
          <input
            value={filtros.busca}
            onChange={(e) => onChange({ ...filtros, busca: e.target.value })}
            placeholder="Buscar transação"
            aria-label="Buscar na descrição"
            type="search"
            enterKeyHint="search"
            className="campo rounded-full! pl-10!"
          />
        </div>

        {/* No celular os filtros ficam recolhidos atrás deste botão */}
        <button
          onClick={() => setAbertoNoCelular((v) => !v)}
          aria-expanded={abertoNoCelular}
          aria-controls="painel-filtros"
          className={`${BOTAO_BASE} flex items-center gap-1.5 py-2.5! sm:hidden ${ativosSemBusca > 0 ? ATIVO : INATIVO}`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtros{ativosSemBusca > 0 && ` (${ativosSemBusca})`}
        </button>

        <div id="painel-filtros" className={`${abertoNoCelular ? "flex" : "hidden"} w-full flex-col gap-3 pt-1 sm:flex sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 sm:pt-0`}>
          <div className="flex self-start rounded-full bg-fundo p-0.5 text-sm" role="group" aria-label="Entradas e saídas">
            {(["TODAS", "SAIDA", "ENTRADA"] as const).map((d) => (
              <button
                key={d}
                onClick={() => onChange({ ...filtros, direcao: d })}
                aria-pressed={filtros.direcao === d}
                className={`rounded-full px-3.5 py-2 transition-colors sm:py-1.5 ${filtros.direcao === d ? "bg-painel-2 text-texto shadow-sm" : "text-apagado hover:text-suave"}`}
              >
                {d === "TODAS" ? "Todas" : d === "SAIDA" ? "Saídas" : "Entradas"}
              </button>
            ))}
          </div>

          <div className="sem-barra -mx-3 flex gap-1.5 overflow-x-auto px-3 sm:mx-0 sm:overflow-visible sm:px-0" role="group" aria-label="Forma de pagamento">
            {METODOS.map((m) => (
              <button key={m.valor} onClick={() => alternarMetodo(m.valor)} aria-pressed={filtros.metodos.includes(m.valor)} className={`${BOTAO_BASE} ${filtros.metodos.includes(m.valor) ? ATIVO : INATIVO}`}>
                {m.rotulo}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SeletorCategorias selecionadas={filtros.categorias} categorias={categorias} mapa={mapaCategorias} onChange={(ids) => onChange({ ...filtros, categorias: ids })} />

            <button
              onClick={() => onChange({ ...filtros, mostrarIgnoradas: !filtros.mostrarIgnoradas })}
              aria-pressed={filtros.mostrarIgnoradas}
              title="Mostra transações marcadas como fora do fluxo (ex.: pagamento de fatura)"
              className={`${BOTAO_BASE} flex items-center gap-1.5 ${filtros.mostrarIgnoradas ? ATIVO : INATIVO}`}
            >
              {filtros.mostrarIgnoradas ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} Fora do fluxo
            </button>

            {/* Sempre ocupa o mesmo espaço (só fica invisível sem filtros): assim a barra nunca muda de tamanho */}
            <button
              onClick={() => onChange(FILTROS_VAZIOS)}
              disabled={ativos === 0}
              tabIndex={ativos === 0 ? -1 : 0}
              aria-hidden={ativos === 0}
              title="Limpar todos os filtros"
              className={`flex h-9 w-[88px] shrink-0 items-center justify-center gap-1 rounded-full text-sm text-suave transition-colors hover:bg-painel-2 hover:text-texto sm:h-8 sm:text-xs ${ativos === 0 ? "invisible" : ""}`}
            >
              <X className="h-3.5 w-3.5" /> Limpar ({ativos})
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
