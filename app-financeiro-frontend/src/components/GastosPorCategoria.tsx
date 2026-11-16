import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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

export default function GastosPorCategoria({ gastos, tipo, onTipo, selecionadas, onAlternar }: Props) {
  const total = gastos.reduce((acc, g) => acc + g.total, 0);
  const altura = Math.max(120, gastos.length * 38 + 16);
  const apagada = (chave: string) => selecionadas.length > 0 && !selecionadas.includes(chave);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-200">{tipo === "SAIDA" ? "Gastos" : "Entradas"} por categoria</h2>
        <div className="flex overflow-hidden rounded-lg border border-zinc-700 text-xs" role="group" aria-label="Tipo do gráfico">
          {(["SAIDA", "ENTRADA"] as const).map((t) => (
            <button key={t} onClick={() => onTipo(t)} aria-pressed={tipo === t} className={`px-2.5 py-1 transition-colors ${tipo === t ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800"}`}>
              {t === "SAIDA" ? "Saídas" : "Entradas"}
            </button>
          ))}
        </div>
      </div>

      {gastos.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">Nada para mostrar com os filtros atuais.</p>
      ) : (
        <>
          <div style={{ height: altura }} role="img" aria-label={`Gráfico de barras: ${tipo === "SAIDA" ? "gastos" : "entradas"} por categoria`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gastos} layout="vertical" margin={{ top: 0, right: 72, bottom: 0, left: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="nome" width={104} tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} interval={0} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  formatter={(valor) => moeda(Number(valor))}
                  contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, color: "#e4e4e7", fontSize: 12 }}
                  itemStyle={{ color: "#e4e4e7" }}
                  labelStyle={{ color: "#a1a1aa" }}
                />
                <Bar dataKey="total" radius={[0, 6, 6, 0]} barSize={20} cursor="pointer" onClick={(_dados, indice) => onAlternar(gastos[indice].chave)}>
                  {gastos.map((g) => (
                    <Cell key={g.chave} fill={g.cor} fillOpacity={apagada(g.chave) ? 0.3 : 1} />
                  ))}
                  <LabelList dataKey="total" position="right" formatter={(valor) => moeda(Number(valor))} fill="#d4d4d8" fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Legenda em texto: valores exatos e atalho para filtrar (tambem acessivel por teclado) */}
          <ul className="mt-3 space-y-0.5 border-t border-zinc-800 pt-2">
            {gastos.map((g) => (
              <li key={g.chave}>
                <button
                  onClick={() => onAlternar(g.chave)}
                  aria-pressed={selecionadas.includes(g.chave)}
                  title={selecionadas.includes(g.chave) ? "Clique para remover do filtro" : "Clique para filtrar a lista"}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-zinc-800/60 ${selecionadas.includes(g.chave) ? "bg-zinc-800" : ""}`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: g.cor }} />
                    <span className={`truncate ${g.chave === SEM_CATEGORIA ? "italic text-zinc-400" : "text-zinc-200"}`}>
                      {g.nome} <span className="text-xs text-zinc-500">({g.quantidade})</span>
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-zinc-300">
                    {moeda(g.total)} <span className="text-xs text-zinc-500">{total > 0 ? Math.round((g.total / total) * 100) : 0}%</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
