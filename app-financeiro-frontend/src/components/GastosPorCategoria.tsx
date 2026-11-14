import { moeda } from "../lib/format";
import { SEM_CATEGORIA, type GastoPorCategoria } from "../lib/calculos";

interface Props {
  gastos: GastoPorCategoria[];
  selecionada: string | null;
  onSelecionar: (chave: string | null) => void;
}

export default function GastosPorCategoria({ gastos, selecionada, onSelecionar }: Props) {
  const total = gastos.reduce((acc, g) => acc + g.total, 0);
  const maior = gastos[0]?.total ?? 0;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-200">Gastos por categoria</h2>
      {gastos.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">Sem saídas neste mês.</p>
      ) : (
        <ul className="space-y-1">
          {gastos.map((g) => {
            const ativa = selecionada === g.chave;
            return (
              <li key={g.chave}>
                <button
                  onClick={() => onSelecionar(ativa ? null : g.chave)}
                  title={ativa ? "Clique para remover o filtro" : "Clique para filtrar a lista"}
                  className={`w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-zinc-800/60 ${ativa ? "bg-zinc-800" : ""}`}
                >
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className={`truncate ${g.chave === SEM_CATEGORIA ? "italic text-zinc-400" : "text-zinc-200"}`}>
                      {g.nome} <span className="text-xs text-zinc-500">({g.quantidade})</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-zinc-300">
                      {moeda(g.total)} <span className="text-xs text-zinc-500">{total > 0 ? Math.round((g.total / total) * 100) : 0}%</span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <div className="h-full rounded-full" style={{ width: `${maior > 0 ? (g.total / maior) * 100 : 0}%`, backgroundColor: g.cor }} />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
