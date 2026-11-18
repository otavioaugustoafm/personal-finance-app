import { CreditCard, Landmark, ListChecks, Users } from "lucide-react";
import { moeda } from "../lib/format";
import type { Categoria } from "../lib/types";

interface Props {
  carregando: boolean;
  saldoEmConta: number;
  temContas: boolean;
  rotuloPeriodo: string;
  compras: { total: number; estornos: number; quantidade: number };
  presumido: { aReceber: number; aPagar: number; valor: number; pendentes: number; indisponivel: boolean };
  onAbrirPrevisoes: () => void;
  destaque: { nome: string; total: number; quantidade: number } | null;
  categoriasDeGasto: Categoria[];
  idDestaque: string | null;
  onTrocarDestaque: (id: string) => void;
}

function Card({ titulo, valor, detalhes, icone, cor = "text-zinc-100", children }: { titulo: string; valor: string; detalhes?: string[]; icone: React.ReactNode; cor?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
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
  carregando, saldoEmConta, temContas, rotuloPeriodo, compras, presumido, onAbrirPrevisoes, destaque, categoriasDeGasto, idDestaque, onTrocarDestaque,
}: Props) {
  const detalhesFatura = [`${compras.quantidade} compra(s) no crédito · ${rotuloPeriodo}`];
  if (compras.estornos > 0) detalhesFatura.push(`Estornos de ${moeda(compras.estornos)} não descontados`);

  const detalhesPresumido = presumido.indisponivel
    ? ["Não foi possível carregar as previsões"]
    : [
        `Saldo ${moeda(saldoEmConta)}`,
        ...(presumido.aReceber > 0 ? [`+ A receber ${moeda(presumido.aReceber)}`] : []),
        ...(presumido.aPagar > 0 ? [`− A pagar ${moeda(presumido.aPagar)}`] : []),
        `− Fatura atual ${moeda(compras.total)}`,
      ];

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card titulo="Saldo em conta" valor={temContas ? moeda(saldoEmConta) : "—"} icone={<Landmark className="h-4 w-4" />} />
      <Card titulo="Fatura atual" valor={carregando ? "—" : moeda(compras.total)} detalhes={carregando ? [] : detalhesFatura} icone={<CreditCard className="h-4 w-4" />} />
      <Card
        titulo="Saldo presumido"
        valor={carregando || presumido.indisponivel || !temContas ? "—" : moeda(presumido.valor)}
        detalhes={carregando || !temContas ? [] : detalhesPresumido}
        cor={presumido.valor < 0 && !carregando && !presumido.indisponivel ? "text-rose-400" : "text-zinc-100"}
        icone={<ListChecks className="h-4 w-4" />}
      >
        <button
          onClick={onAbrirPrevisoes}
          disabled={presumido.indisponivel}
          className="mt-2 self-start rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-emerald-400 transition-colors hover:bg-zinc-800 disabled:opacity-40"
        >
          Previsões{presumido.pendentes > 0 ? ` (${presumido.pendentes})` : ""}
        </button>
      </Card>
      <Card
        titulo={destaque?.nome ?? "Categoria em destaque"}
        valor={carregando || !destaque ? "—" : moeda(destaque.total)}
        detalhes={[destaque ? `${destaque.quantidade} gasto(s) no período` : "Crie a categoria “Gastos da Mãe” ou escolha uma:"]}
        icone={<Users className="h-4 w-4" />}
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
    </section>
  );
}
