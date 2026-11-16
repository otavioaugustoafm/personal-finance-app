import { ArrowDownCircle, ArrowUpCircle, CreditCard, Landmark } from "lucide-react";
import { diaMes, moeda } from "../lib/format";
import type { FaturaCartao } from "../lib/types";

interface Props {
  saldoEmConta: number;
  limiteUsado: number;
  faturas: FaturaCartao[];
  temContas: boolean;
  entradas: number;
  saidas: number;
}

function Card({ titulo, valor, detalhes, icone, cor }: { titulo: string; valor: string; detalhes?: string[]; icone: React.ReactNode; cor: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
        {icone} {titulo}
      </div>
      <div className={`text-xl font-semibold tabular-nums sm:text-2xl ${cor}`}>{valor}</div>
      {detalhes?.map((d) => (
        <div key={d} className="mt-1 text-xs text-zinc-500">
          {d}
        </div>
      ))}
    </div>
  );
}

export default function ResumoCards({ saldoEmConta, limiteUsado, faturas, temContas, entradas, saidas }: Props) {
  const resultado = entradas - saidas;
  const [proxima, seguinte] = faturas;

  const detalhesFatura: string[] = [];
  if (proxima) detalhesFatura.push(`Vence em ${diaMes(proxima.vencimento)}`);
  if (seguinte) detalhesFatura.push(`Depois: ${diaMes(seguinte.vencimento)} · ${moeda(seguinte.total)}`);
  if (!proxima && temContas) detalhesFatura.push("O banco não informou fatura");
  if (temContas) detalhesFatura.push(`Limite usado: ${moeda(limiteUsado)} (inclui parcelas futuras)`);

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card titulo="Saldo em conta" valor={temContas ? moeda(saldoEmConta) : "—"} icone={<Landmark className="h-4 w-4" />} cor="text-zinc-100" />
      <Card
        titulo="Próxima fatura"
        valor={proxima ? moeda(proxima.total) : "—"}
        detalhes={detalhesFatura}
        icone={<CreditCard className="h-4 w-4" />}
        cor="text-zinc-100"
      />
      <Card titulo="Entradas do mês" valor={moeda(entradas)} icone={<ArrowUpCircle className="h-4 w-4 text-emerald-500" />} cor="text-emerald-400" />
      <Card
        titulo="Saídas do mês"
        valor={moeda(saidas)}
        detalhes={[`Resultado: ${resultado >= 0 ? "+" : "−"}${moeda(Math.abs(resultado))}`]}
        icone={<ArrowDownCircle className="h-4 w-4 text-rose-500" />}
        cor="text-rose-400"
      />
    </section>
  );
}
