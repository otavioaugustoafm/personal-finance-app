import { CalendarClock, CreditCard, Heart } from "lucide-react";
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

/** Separa "R$ 1.234,56" em "R$" e "1.234,56" para o símbolo ficar menor que o número. */
function Valor({ valor, className = "", tamanhoSimbolo = "text-[0.45em]" }: { valor: number | null; className?: string; tamanhoSimbolo?: string }) {
  if (valor === null) return <span className={`${className} text-apagado`}>—</span>;
  const texto = moeda(valor);
  const negativo = valor < 0;
  const numero = texto.replace(/^-?\s*R\$\s*/, "").replace(/^-/, "");
  return (
    <span className={`inline-flex items-baseline gap-[0.15em] whitespace-nowrap ${className}`}>
      <span className={`${tamanhoSimbolo} font-medium opacity-60`}>{negativo ? "−R$" : "R$"}</span>
      <span>{numero}</span>
    </span>
  );
}

function LinhaConta({ sinal, rotulo, valor, cor }: { sinal: string; rotulo: string; valor: number; cor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-[15px] sm:text-sm">
      <span className="flex items-baseline gap-2 text-suave">
        <span className={`w-3 text-center font-semibold ${cor}`}>{sinal}</span>
        {rotulo}
      </span>
      <span className={`tabular-nums ${cor}`}>{moeda(valor)}</span>
    </div>
  );
}

function CartaoMenor({ icone, titulo, children }: { icone: React.ReactNode; titulo: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col rounded-3xl border border-borda bg-painel p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2 text-sm text-suave">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-painel-2 text-texto">{icone}</span>
        <span className="min-w-0 truncate">{titulo}</span>
      </div>
      {children}
    </div>
  );
}

export default function ResumoCards({
  carregando, saldoEmConta, temContas, rotuloPeriodo, compras, presumido, onAbrirPrevisoes, destaque, categoriasDeGasto, idDestaque, onTrocarDestaque,
}: Props) {
  const presumidoVisivel = !carregando && !presumido.indisponivel && temContas;
  const negativo = presumidoVisivel && presumido.valor < 0;

  return (
    <section className="grid gap-3 lg:grid-cols-3" aria-label="Resumo do período">
      {/* Destaque: o saldo e a conta que leva ao saldo presumido */}
      <div className="relative overflow-hidden rounded-3xl border border-borda-forte bg-painel-2 p-5 sm:p-6 lg:col-span-2">
        {/* moeda estilizada ao fundo, discreta */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border-[18px] border-latao/[0.07]"
        />
        <div className="relative grid gap-5 sm:grid-cols-[1fr_minmax(0,18rem)] sm:gap-8">
          <div className="flex flex-col">
            <p className="text-sm text-suave">Saldo em conta</p>
            <Valor
              valor={temContas ? saldoEmConta : null}
              className="mt-1 font-display text-[2.75rem] font-semibold leading-none tracking-tight text-texto sm:text-6xl"
            />
            <p className="mt-auto hidden pt-6 text-sm text-apagado sm:block">Período da fatura: {rotuloPeriodo}</p>
          </div>

          <div className="border-t border-borda pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
            {presumido.indisponivel ? (
              <p className="text-sm text-suave">As previsões não carregaram, então o saldo presumido ficou de fora. Recarregue a página para tentar de novo.</p>
            ) : (
              <>
                <LinhaConta sinal="+" rotulo="A receber" valor={presumido.aReceber} cor="text-entrada" />
                <LinhaConta sinal="−" rotulo="A pagar" valor={presumido.aPagar} cor="text-saida" />
                <LinhaConta sinal="−" rotulo="Fatura atual" valor={carregando ? 0 : compras.total} cor="text-saida" />
                <div className="mt-2 flex items-end justify-between gap-3 border-t border-dashed border-borda-forte pt-3">
                  <span className="pb-1 text-sm text-suave">Saldo presumido</span>
                  <Valor
                    valor={presumidoVisivel ? presumido.valor : null}
                    className={`font-display text-3xl font-semibold leading-none tracking-tight ${negativo ? "text-saida" : "text-latao"}`}
                  />
                </div>
              </>
            )}
            <button
              onClick={onAbrirPrevisoes}
              disabled={presumido.indisponivel}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-latao/40 bg-latao/10 px-3 py-2.5 text-sm font-medium text-latao transition-colors hover:bg-latao/20 disabled:opacity-40"
            >
              <CalendarClock className="h-4 w-4" />
              {presumido.pendentes > 0 ? `Previsões · ${presumido.pendentes} pendente${presumido.pendentes > 1 ? "s" : ""}` : "Anotar previsões"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
        <CartaoMenor icone={<CreditCard className="h-3.5 w-3.5" />} titulo="Fatura atual">
          <Valor valor={carregando ? null : compras.total} className="font-display text-2xl font-semibold leading-none tracking-tight sm:text-3xl" />
          <p className="mt-2 text-xs text-apagado sm:text-sm">
            {carregando ? "Carregando…" : `${compras.quantidade} ${compras.quantidade === 1 ? "compra" : "compras"} no crédito`}
          </p>
          {!carregando && compras.estornos > 0 && <p className="mt-1 text-xs text-aviso">Estornos de {moeda(compras.estornos)} não descontados</p>}
        </CartaoMenor>

        <CartaoMenor icone={<Heart className="h-3.5 w-3.5" />} titulo={destaque?.nome ?? "Categoria em destaque"}>
          <Valor valor={carregando || !destaque ? null : destaque.total} className="font-display text-2xl font-semibold leading-none tracking-tight sm:text-3xl" />
          <p className="mt-2 text-xs text-apagado sm:text-sm">
            {destaque ? `${destaque.quantidade} ${destaque.quantidade === 1 ? "gasto" : "gastos"} no período` : "Escolha a categoria acompanhada"}
          </p>
          <select
            value={idDestaque ?? ""}
            onChange={(e) => e.target.value && onTrocarDestaque(e.target.value)}
            aria-label="Categoria acompanhada neste cartão"
            className="pilula mt-3 w-full py-1.5! pl-3!"
          >
            <option value="">Escolher categoria…</option>
            {categoriasDeGasto.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </CartaoMenor>
      </div>
    </section>
  );
}
