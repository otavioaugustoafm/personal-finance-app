import { ArrowDownCircle, ArrowUpCircle, CreditCard, Landmark } from "lucide-react";
import { moeda } from "../lib/format";

interface Props {
  saldoEmConta: number;
  cartaoEmAberto: number;
  temContas: boolean;
  entradas: number;
  saidas: number;
}

function Card({ titulo, valor, detalhe, icone, cor }: { titulo: string; valor: string; detalhe?: string; icone: React.ReactNode; cor: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
        {icone} {titulo}
      </div>
      <div className={`text-xl font-semibold tabular-nums sm:text-2xl ${cor}`}>{valor}</div>
      {detalhe && <div className="mt-1 text-xs text-zinc-500">{detalhe}</div>}
    </div>
  );
}

export default function ResumoCards({ saldoEmConta, cartaoEmAberto, temContas, entradas, saidas }: Props) {
  const resultado = entradas - saidas;
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card titulo="Saldo em conta" valor={temContas ? moeda(saldoEmConta) : "—"} icone={<Landmark className="h-4 w-4" />} cor="text-zinc-100" />
      <Card
        titulo="Cartão em aberto"
        valor={temContas ? moeda(cartaoEmAberto) : "—"}
        detalhe="valor informado pelo banco"
        icone={<CreditCard className="h-4 w-4" />}
        cor="text-zinc-100"
      />
      <Card titulo="Entradas do mês" valor={moeda(entradas)} icone={<ArrowUpCircle className="h-4 w-4 text-emerald-500" />} cor="text-emerald-400" />
      <Card
        titulo="Saídas do mês"
        valor={moeda(saidas)}
        detalhe={`Resultado: ${resultado >= 0 ? "+" : "−"}${moeda(Math.abs(resultado))}`}
        icone={<ArrowDownCircle className="h-4 w-4 text-rose-500" />}
        cor="text-rose-400"
      />
    </section>
  );
}
