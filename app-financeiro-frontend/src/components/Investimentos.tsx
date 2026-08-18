import { useEffect, useState } from "react";
import ModalAporte from "./ModalAporte";
import { 
  Briefcase, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Wallet,
  Activity
} from "lucide-react";
import axios from "axios";

const formatarMoeda = (valor: number): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);

interface Ativo {
  carteira_id: string;
  ticker: string;
  categoria: string;
  quantidade: number;
  preco_medio: number;
  percentual_alvo: number;
  cotacao_atual: number;
  valor_investido: number;
  saldo_atual: number;
  lucro_prejuizo: number;
  rentabilidade_percentual: number;
  peso_atual_percentual: number;
}

interface ResumoCarteira {
  patrimonio_total: number;
  ativos: Ativo[];
}

function CardResumo({ titulo, valor, subtitulo, icone, esquemaCor }: any) {
  const cores = {
    verde: "bg-emerald-950/60 text-emerald-400",
    vermelho: "bg-rose-950/60 text-rose-400",
    azul: "bg-blue-950/60 text-blue-400",
    ambar: "bg-amber-950/60 text-amber-400",
  }[esquemaCor as string] || "bg-zinc-800 text-zinc-400";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-lg transition-all hover:border-zinc-700">
      <div className="flex items-start justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${cores}`}>
          {icone}
        </div>
      </div>
      <p className="mt-4 text-sm font-medium text-zinc-400">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-100">{valor}</p>
      {subtitulo && <p className="mt-1 text-xs text-zinc-500">{subtitulo}</p>}
    </div>
  );
}

export default function Investimentos() {
  const [carteira, setCarteira] = useState<ResumoCarteira>({ patrimonio_total: 0, ativos: [] });
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false); // NOVO: Controle do Modal

  const carregarCarteira = async () => {
    try {
      const token = localStorage.getItem("token") || "";
      // Lembre-se de verificar se sua URL da AWS está correta aqui
      const resposta = await axios.get("https://fqdj9kncvf.execute-api.us-east-2.amazonaws.com/api/v1/investimentos", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCarteira(resposta.data);
    } catch (error) {
      console.error("Erro ao buscar investimentos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarCarteira();
  }, []);

  const lucroTotal = carteira.ativos.reduce((acc, ativo) => acc + ativo.lucro_prejuizo, 0);
  const rentabilidadeGeral = carteira.patrimonio_total > 0 
    ? (lucroTotal / (carteira.patrimonio_total - lucroTotal)) * 100 
    : 0;

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Gestão de Investimentos</h1>
            <p className="mt-1 text-sm text-zinc-400 font-medium">Acompanhe sua carteira e cotações em tempo real</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => alert("Modal de IA será construído na Fase 3!")}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-sm font-medium text-blue-400 shadow-sm transition-colors hover:bg-blue-500/20"
            >
              <Activity className="h-4 w-4" /> Consultar IA
            </button>

            <button
              onClick={() => setModalAberto(true)} // ATUALIZADO: Abre o modal
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-500"
            >
              <Plus className="h-4 w-4" /> Novo Aporte
            </button>
          </div>
        </header>

        {/* CARDS DE RESUMO */}
        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CardResumo 
            titulo="Patrimônio Total" 
            valor={formatarMoeda(carteira.patrimonio_total)} 
            icone={<Wallet className="h-5 w-5" />} 
            esquemaCor="ambar" 
          />
          <CardResumo 
            titulo="Resultado Atual" 
            valor={formatarMoeda(lucroTotal)} 
            icone={lucroTotal >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />} 
            esquemaCor={lucroTotal >= 0 ? "verde" : "vermelho"} 
            subtitulo={`${lucroTotal >= 0 ? "+" : ""}${rentabilidadeGeral.toFixed(2)}% na carteira`}
          />
          <CardResumo 
            titulo="Ativos na Carteira" 
            valor={carteira.ativos.length.toString()} 
            icone={<Briefcase className="h-5 w-5" />} 
            esquemaCor="azul" 
          />
        </section>

        {/* TABELA DE ATIVOS */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 shadow-lg overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-200">Posição Consolidada</h2>
          </div>
          
          <div className="hidden grid-cols-12 gap-4 px-5 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 sm:grid">
            <span className="col-span-2">Ativo</span>
            <span className="col-span-2 text-right">Qtd / PM</span>
            <span className="col-span-2 text-right">Cotação Atual</span>
            <span className="col-span-2 text-right">Saldo Atual</span>
            <span className="col-span-2 text-right">Rentabilidade</span>
            <span className="col-span-2 text-center">Peso (%)</span>
          </div>

          <ul className="divide-y divide-zinc-800/60">
            {loading ? (
              <li className="px-5 py-10 text-center text-sm text-zinc-500">Buscando cotações na B3...</li>
            ) : carteira.ativos.length === 0 ? (
              <li className="px-5 py-10 text-center text-sm text-zinc-500">Nenhum ativo cadastrado.</li>
            ) : (
              carteira.ativos.map((ativo) => {
                const isPositivo = ativo.lucro_prejuizo >= 0;
                
                return (
                  <li key={ativo.carteira_id} className="grid grid-cols-2 items-center gap-2 px-5 py-4 sm:grid-cols-12 sm:gap-4 hover:bg-zinc-800/30 transition-colors">
                    
                    {/* Ticker e Categoria */}
                    <div className="col-span-2 flex flex-col">
                      <span className="text-sm font-bold text-zinc-200">{ativo.ticker}</span>
                      <span className="text-xs text-zinc-500">{ativo.categoria}</span>
                    </div>
                    
                    {/* Qtd e Preço Médio */}
                    <div className="col-span-2 flex flex-col text-right">
                      <span className="text-sm text-zinc-300">{ativo.quantidade} cotas</span>
                      <span className="text-xs text-zinc-500">PM: {formatarMoeda(ativo.preco_medio)}</span>
                    </div>

                    {/* Cotação Atual */}
                    <div className="col-span-2 text-right text-sm font-medium text-zinc-300">
                      {formatarMoeda(ativo.cotacao_atual)}
                    </div>

                    {/* Saldo Atual */}
                    <div className="col-span-2 flex flex-col text-right">
                      <span className="text-sm font-semibold text-zinc-200">{formatarMoeda(ativo.saldo_atual)}</span>
                    </div>

                    {/* Rentabilidade (Variação R$ e %) */}
                    <div className={`col-span-2 flex flex-col text-right ${isPositivo ? 'text-emerald-400' : 'text-rose-400'}`}>
                      <span className="text-sm font-semibold">
                        {isPositivo ? "+" : ""}{formatarMoeda(ativo.lucro_prejuizo)}
                      </span>
                      <span className="text-xs">
                        {isPositivo ? "+" : ""}{ativo.rentabilidade_percentual}%
                      </span>
                    </div>

                    {/* Peso na Carteira */}
                    <div className="col-span-2 flex justify-center items-center">
                      <span className="inline-flex items-center rounded-md bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-300 ring-1 ring-inset ring-zinc-700">
                        {ativo.peso_atual_percentual}%
                      </span>
                    </div>

                  </li>
                );
              })
            )}
          </ul>
        </section>
      </div>

      {/* RENDERIZAÇÃO DO MODAL ADICIONADA AQUI */}
      <ModalAporte 
        isOpen={modalAberto} 
        onClose={() => setModalAberto(false)} 
        onSuccess={carregarCarteira} 
      />
      
    </div>
  );
}