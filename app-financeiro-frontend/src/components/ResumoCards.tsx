import { ArrowDownCircle, ArrowUpCircle, CreditCard, Landmark, Users } from "lucide-react";
import { moeda } from "../lib/format";
import type { Categoria } from "../lib/types";

interface Props {
  saldoEmConta: number;
  temContas: boolean;
  rotuloPeriodo: string;
  compras: { total: number; estornos: number; quantidade: number };
  destaque: { nome: string; total: number; quantidade: number } | null;
  categoriasDeGasto: Categoria[];
  idDestaque: string | null;
  onTrocarDestaque: (id: string) => void;
  entradas: number;
  saidas: number;
}

function Card({ titulo, valor, detalhes, icone, cor, children }: { titulo: string; valor: string; detalhes?: string[]; icone: React.ReactNode; cor: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
        {icone} <span className="truncate">{titulo}</span>
      </div>
      <div className={`text-xl font-semibold tabular-nums sm:text-2xl ${cor}`}>{valor}</div>
      {detalhes?.map((d) => (
        <div key={d} className="mt-1 text-xs text-zinc-500">
          {d}
        </div>
      ))}
      {children}
    </div>
  );
}

export default function ResumoCards({
  saldoEmConta, temContas, rotuloPeriodo, compras, destaque, categoriasDeGasto, idDestaque, onTrocarDestaque, entradas, saidas,
}: Props) {
  const resultado = entradas - saidas;
  const detalhesCredito = [`${compras.quantidade} compra(s) · ${rotuloPeriodo}`];
  if (compras.estornos > 0) detalhesCredito.push(`Estornos de ${moeda(compras.estornos)} não descontados`);

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Card titulo="Saldo em conta" valor={temContas ? moeda(saldoEmConta) : "—"} icone={<Landmark className="h-4 w-4" />} cor="text-zinc-100" />
      <Card titulo="Compras no crédito" valor={moeda(compras.total)} detalhes={detalhesCredito} icone={<CreditCard className="h-4 w-4" />} cor="text-zinc-100" />
      <Card
        titulo={destaque?.nome ?? "Categoria em destaque"}
        valor={destaque ? moeda(destaque.total) : "—"}
        detalhes={[destaque ? `${destaque.quantidade} gasto(s) no período` : "Crie a categoria “Gastos da Mãe” ou escolha uma:"]}
        icone={<Users className="h-4 w-4" />}
        cor="text-zinc-100"
      >
        <select
          value={idDestaque ?? ""}
          onChange={(e) => e.target.value && onTrocarDestaque(e.target.value)}
          aria-label="Categoria acompanhada neste card"
          className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-300 outline-none focus:border-emerald-500"
        >
          <option value="">Escolher categoria…</option>
          {categoriasDeGasto.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </Card>
      <Card titulo="Entradas do período" valor={moeda(entradas)} icone={<ArrowUpCircle className="h-4 w-4 text-emerald-500" />} cor="text-emerald-400" />
      <Card
        titulo="Saídas do período"
        valor={moeda(saidas)}
        detalhes={[`Resultado: ${resultado >= 0 ? "+" : "−"}${moeda(Math.abs(resultado))}`]}
        icone={<ArrowDownCircle className="h-4 w-4 text-rose-500" />}
        cor="text-rose-400"
      />
    </section>
  );
}
