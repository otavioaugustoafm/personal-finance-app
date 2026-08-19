import { useState, useEffect } from "react";
import axios from "axios";
import ModalAporte from "./ModalAporte";
import ModalDetalhesAtivo from "./ModalDetalhesAtivo"; // <-- Importamos o novo modal
import { Plus, Wallet, TrendingDown, TrendingUp, Briefcase } from "lucide-react";

interface Ativo {
  carteira_id: string;
  ativo_id: string;
  ticker: string;
  categoria: string;
  quantidade: string;
  preco_medio: string;
  cotacao_atual: string;
  percentual_alvo: string;
  saldo_atual: number;
  lucro_prejuizo: number;
  rentabilidade_percentual: number;
  peso_atual_percentual: number;
}

interface DadosCarteira {
  patrimonio_total: number;
  ativos: Ativo[];
}

export default function Investimentos() {
  const [dadosCarteira, setDadosCarteira] = useState<DadosCarteira | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalAporteAberto, setModalAporteAberto] = useState(false);
  
  // ESTADOS NOVOS: Filtro e Modal de Detalhes
  const [filtroCategoria, setFiltroCategoria] = useState("TODOS");
  const [ativoSelecionado, setAtivoSelecionado] = useState<{ id: string, ticker: string, meta: number } | null>(null);

  const carregarCarteira = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      // ⚠️ ATENÇÃO: COLOQUE A SUA URL DA AWS AQUI
      const res = await axios.get("https://fqdj9kncvf.execute-api.us-east-2.amazonaws.com/api/v1/investimentos", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDadosCarteira(res.data);
    } catch (error) {
      console.error("Erro ao carregar carteira:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarCarteira();
  }, []);

  // LÓGICA DO FILTRO: Roda antes de desenhar a tabela
  const ativosFiltrados = dadosCarteira?.ativos.filter(ativo => 
    filtroCategoria === "TODOS" || ativo.categoria === filtroCategoria
  ) || [];

  const lucroTotal = dadosCarteira?.ativos.reduce((acc, ativo) => acc + ativo.lucro_prejuizo, 0) || 0;
  const rentabilidadeGeral = dadosCarteira?.patrimonio_total 
    ? (lucroTotal / (dadosCarteira.patrimonio_total - lucroTotal)) * 100 
    : 0;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Gestão de Investimentos</h1>
          <p className="text-zinc-400 mt-1">Acompanhe sua carteira e cotações em tempo real</p>
        </div>
        <button 
          onClick={() => setModalAporteAberto(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
        >
          <Plus className="h-5 w-5" /> Novo Aporte
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-sm">
          <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
            <Wallet className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="text-zinc-400 text-sm font-medium">Patrimônio Total</p>
          <p className="text-3xl font-bold text-zinc-100 mt-1">
            R$ {dadosCarteira?.patrimonio_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-sm">
          <div className={`h-10 w-10 rounded-full flex items-center justify-center mb-4 ${lucroTotal >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
            {lucroTotal >= 0 ? <TrendingUp className="h-5 w-5 text-emerald-500" /> : <TrendingDown className="h-5 w-5 text-rose-500" />}
          </div>
          <p className="text-zinc-400 text-sm font-medium">Resultado Atual</p>
          <p className={`text-3xl font-bold mt-1 ${lucroTotal >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {lucroTotal >= 0 ? '+' : ''}R$ {lucroTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-zinc-500 text-sm mt-1">{rentabilidadeGeral.toFixed(2)}% na carteira</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-sm">
          <div className="h-10 w-10 rounded-full bg-indigo-500/10 flex items-center justify-center mb-4">
            <Briefcase className="h-5 w-5 text-indigo-500" />
          </div>
          <p className="text-zinc-400 text-sm font-medium">Ativos na Carteira</p>
          <p className="text-3xl font-bold text-zinc-100 mt-1">{dadosCarteira?.ativos.length || 0}</p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-zinc-100">Posição Consolidada</h2>
          
          {/* BARRA DE FILTROS */}
          <div className="flex gap-2 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
            {["TODOS", "FII", "ACAO", "ETF"].map(cat => (
              <button
                key={cat}
                onClick={() => setFiltroCategoria(cat)}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-colors ${
                  filtroCategoria === cat 
                    ? "bg-zinc-800 text-zinc-100" 
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-950/50 border-b border-zinc-800">
                <th className="p-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Ativo</th>
                <th className="p-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">QTD / PM</th>
                <th className="p-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Cotação Atual</th>
                <th className="p-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Saldo Atual</th>
                <th className="p-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Rentabilidade</th>
                <th className="p-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Peso (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-zinc-500">Carregando carteira...</td></tr>
              ) : ativosFiltrados.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-zinc-500">Nenhum ativo encontrado nesta categoria.</td></tr>
              ) : (
                ativosFiltrados.map((ativo) => (
                  <tr 
                    key={ativo.carteira_id} 
                    onClick={() => setAtivoSelecionado({ id: ativo.ativo_id, ticker: ativo.ticker, meta: parseFloat(ativo.percentual_alvo) })}
                    className="hover:bg-zinc-800/50 transition-colors cursor-pointer group"
                    title="Clique para ver o extrato e editar a meta"
                  >
                    <td className="p-4">
                      <p className="font-bold text-zinc-100 group-hover:text-emerald-400 transition-colors">{ativo.ticker}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{ativo.categoria}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-zinc-300">{parseFloat(ativo.quantidade)} cotas</p>
                      <p className="text-xs text-zinc-500 mt-0.5">PM: R$ {parseFloat(ativo.preco_medio).toFixed(2)}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-zinc-300">R$ {parseFloat(ativo.cotacao_atual).toFixed(2)}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-zinc-100">R$ {ativo.saldo_atual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </td>
                    <td className="p-4">
                      <p className={`font-bold ${ativo.lucro_prejuizo >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {ativo.lucro_prejuizo >= 0 ? '+' : ''}R$ {ativo.lucro_prejuizo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className={`text-xs mt-0.5 ${ativo.rentabilidade_percentual >= 0 ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>
                        {ativo.rentabilidade_percentual.toFixed(2)}%
                      </p>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500 rounded-full" 
                            style={{ width: `${Math.min(ativo.peso_atual_percentual, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-zinc-400 min-w-[40px]">{ativo.peso_atual_percentual.toFixed(1)}%</span>
                      </div>
                      <p className="text-[10px] text-zinc-600 mt-1">Alvo: {parseFloat(ativo.percentual_alvo)}%</p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ModalAporte 
        isOpen={modalAporteAberto} 
        onClose={() => setModalAporteAberto(false)} 
        onSuccess={carregarCarteira} 
      />

      {/* RENDERIZA O NOVO MODAL */}
      <ModalDetalhesAtivo
        isOpen={!!ativoSelecionado}
        onClose={() => setAtivoSelecionado(null)}
        ativoId={ativoSelecionado?.id || ""}
        ticker={ativoSelecionado?.ticker || ""}
        metaAtual={ativoSelecionado?.meta || 0}
        onSuccess={carregarCarteira}
      />
    </div>
  );
}