import { SEM_CATEGORIA, type GastoPorCategoria } from "../lib/calculos";
import { moeda } from "../lib/format";
import type { Direcao } from "../lib/types";

interface Props {
  gastos: GastoPorCategoria[];
  tipo: Direcao;
  onTipo: (tipo: Direcao) => void;
  selecionadas: string[]; // categorias filtradas (vazio = nenhuma)
  onAlternar: (chave: string) => void;
}

/** Barras horizontais em HTML/CSS: nomes inteiros, valor e % ao lado, e uma faixa com a proporcao de cada categoria. */
export default function GastosPorCategoria({ gastos, tipo, onTipo, selecionadas, onAlternar }: Props) {
  const total = gastos.reduce((acc, g) => acc + g.total, 0);
  const maior = gastos[0]?.total ?? 0;
  const filtrando = selecionadas.length > 0;
  const nomeDoTipo = tipo === "SAIDA" ? "Gastos" : "Entradas";

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-200">{nomeDoTipo} por categoria</h2>
        <div className="flex overflow-hidden rounded-lg border border-zinc-700 text-xs" role="group" aria-label="Tipo do gráfico">
          {(["SAIDA", "ENTRADA"] as const).map((t) => (
            <button key={t} onClick={() => onTipo(t)} aria-pressed={tipo === t} className={`px-2.5 py-1 transition-colors ${tipo === t ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800"}`}>
              {t === "SAIDA" ? "Saídas" : "Entradas"}
            </button>
          ))}
        </div>
      </div>

      {gastos.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">Nada para mostrar com os filtros atuais.</p>
      ) : (
        <>
          <div className="mb-3">
            <div className="text-2xl font-semibold tabular-nums text-zinc-100">{moeda(total)}</div>
            <div className="text-xs text-zinc-500">{gastos.length} categoria(s) no período</div>
          </div>

          {/* faixa de proporcao: todas as categorias lado a lado */}
          <div className="mb-4 flex h-2.5 w-full overflow-hidden rounded-full bg-zinc-800" role="img" aria-label={`Proporção de ${nomeDoTipo.toLowerCase()} por categoria`}>
            {gastos.map((g) => (
              <div
                key={g.chave}
                title={`${g.nome}: ${moeda(g.total)}`}
                className="h-full transition-opacity"
                style={{ width: `${(g.total / total) * 100}%`, backgroundColor: g.cor, opacity: filtrando && !selecionadas.includes(g.chave) ? 0.25 : 1 }}
              />
            ))}
          </div>

          <ul className="space-y-1">
            {gastos.map((g) => {
              const ativa = selecionadas.includes(g.chave);
              return (
                <li key={g.chave}>
                  <button
                    onClick={() => onAlternar(g.chave)}
                    aria-pressed={ativa}
                    title={ativa ? "Clique para remover do filtro" : "Clique para filtrar a lista"}
                    className={`block w-full rounded-lg px-2 py-1.5 text-left transition-all hover:bg-zinc-800/60 ${ativa ? "bg-zinc-800 ring-1 ring-zinc-600" : ""} ${filtrando && !ativa ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: g.cor }} />
                        <span className={`truncate ${g.chave === SEM_CATEGORIA ? "italic text-zinc-400" : "text-zinc-200"}`}>{g.nome}</span>
                        <span className="shrink-0 text-xs text-zinc-500">({g.quantidade})</span>
                      </span>
                      <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                        <span className="text-zinc-200">{moeda(g.total)}</span>
                        <span className="w-9 text-right text-xs text-zinc-500">{total > 0 ? Math.round((g.total / total) * 100) : 0}%</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{ width: `${maior > 0 ? Math.max((g.total / maior) * 100, 2) : 0}%`, background: `linear-gradient(90deg, ${g.cor}99, ${g.cor})` }}
                      />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
