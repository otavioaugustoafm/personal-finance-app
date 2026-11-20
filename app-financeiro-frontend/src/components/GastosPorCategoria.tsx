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

/** Barras horizontais em HTML/CSS: nomes inteiros, valor e % ao lado, e uma faixa com a proporção de cada categoria. */
export default function GastosPorCategoria({ gastos, tipo, onTipo, selecionadas, onAlternar }: Props) {
  const total = gastos.reduce((acc, g) => acc + g.total, 0);
  const maior = gastos[0]?.total ?? 0;
  const filtrando = selecionadas.length > 0;
  const nomeDoTipo = tipo === "SAIDA" ? "Gastos" : "Entradas";

  return (
    <section className="rounded-3xl border border-borda bg-painel p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="whitespace-nowrap font-display text-lg font-semibold tracking-tight text-texto">{nomeDoTipo} por categoria</h2>
        <div className="flex rounded-full bg-fundo p-0.5 text-sm" role="group" aria-label="Tipo do gráfico">
          {(["SAIDA", "ENTRADA"] as const).map((t) => (
            <button
              key={t}
              onClick={() => onTipo(t)}
              aria-pressed={tipo === t}
              className={`rounded-full px-3 py-1.5 transition-colors ${tipo === t ? "bg-painel-2 text-texto shadow-sm" : "text-apagado hover:text-suave"}`}
            >
              {t === "SAIDA" ? "Saídas" : "Entradas"}
            </button>
          ))}
        </div>
      </div>

      {gastos.length === 0 ? (
        <p className="py-8 text-center text-sm text-apagado">Nada para mostrar com os filtros atuais.</p>
      ) : (
        <>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <div className={`font-display text-3xl font-semibold tracking-tight ${tipo === "SAIDA" ? "text-saida" : "text-entrada"}`}>{moeda(total)}</div>
            <div className="text-sm text-apagado">{gastos.length} {gastos.length === 1 ? "categoria" : "categorias"}</div>
          </div>

          {/* faixa de proporção: todas as categorias lado a lado */}
          <div className="mb-4 flex h-3 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`Proporção de ${nomeDoTipo.toLowerCase()} por categoria`}>
            {gastos.map((g) => (
              <div
                key={g.chave}
                title={`${g.nome}: ${moeda(g.total)}`}
                className="h-full transition-opacity first:rounded-l-full last:rounded-r-full"
                style={{ width: `${(g.total / total) * 100}%`, backgroundColor: g.cor, opacity: filtrando && !selecionadas.includes(g.chave) ? 0.25 : 1 }}
              />
            ))}
          </div>

          <ul className="-mx-1.5 space-y-0.5">
            {gastos.map((g) => {
              const ativa = selecionadas.includes(g.chave);
              return (
                <li key={g.chave}>
                  <button
                    onClick={() => onAlternar(g.chave)}
                    aria-pressed={ativa}
                    title={ativa ? "Toque para tirar do filtro" : "Toque para filtrar a lista por esta categoria"}
                    className={`block w-full rounded-xl px-2.5 py-2 text-left transition-[background-color,opacity] hover:bg-painel-2/60 ${ativa ? "bg-painel-2 ring-1 ring-borda-forte" : ""} ${filtrando && !ativa ? "opacity-45" : ""}`}
                  >
                    <div className="flex items-baseline justify-between gap-3 text-[15px] sm:text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: g.cor }} />
                        <span className={`truncate ${g.chave === SEM_CATEGORIA ? "italic text-suave" : "text-texto"}`}>{g.nome}</span>
                        <span className="shrink-0 text-xs text-apagado">{g.quantidade}×</span>
                      </span>
                      <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                        <span className="text-texto">{moeda(g.total)}</span>
                        <span className="w-9 text-right text-xs text-apagado">{total > 0 ? Math.round((g.total / total) * 100) : 0}%</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-fundo">
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{ width: `${maior > 0 ? Math.max((g.total / maior) * 100, 2) : 0}%`, backgroundColor: g.cor }}
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
