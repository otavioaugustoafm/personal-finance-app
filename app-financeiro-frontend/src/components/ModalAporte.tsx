import { useState } from "react";
import { X, Loader2, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import axios from "axios";

interface ModalAporteProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ModalAporte({ isOpen, onClose, onSuccess }: ModalAporteProps) {
  const [ticker, setTicker] = useState("");
  const [categoria, setCategoria] = useState("FII");
  const [tipo, setTipo] = useState<"COMPRA" | "VENDA">("COMPRA");
  const [quantidade, setQuantidade] = useState("");
  const [precoUnitario, setPrecoUnitario] = useState("");
  const [percentualAlvo, setPercentualAlvo] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro("");

    try {
      const token = localStorage.getItem("token");
      
      // ATENÇÃO: Cole a sua URL correta do AWS API Gateway aqui de novo!
      await axios.post("https://fqdj9kncvf.execute-api.us-east-2.amazonaws.com/api/v1/investimentos", {
        ticker: ticker.toUpperCase(),
        categoria,
        tipo, // Agora enviamos se é COMPRA ou VENDA
        quantidade: parseFloat(quantidade.replace(",", ".")),
        preco_unitario: parseFloat(precoUnitario.replace(",", ".")), // Agora é unitário, o PM é calculado lá no Python
        percentual_alvo: parseFloat(percentualAlvo.replace(",", ".") || "0")
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Limpa tudo
      setTicker("");
      setQuantidade("");
      setPrecoUnitario("");
      setPercentualAlvo("");
      setTipo("COMPRA");
      
      onSuccess();
      onClose();
    } catch (error: any) {
      const erroReal = error.response?.data 
        ? JSON.stringify(error.response.data) 
        : error.message;
        
      setErro(`ERRO TÉCNICO: ${erroReal}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 p-5">
          <h2 className="text-lg font-semibold text-zinc-100">Registrar Transação</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {erro && (
            <div className="rounded-lg bg-rose-500/10 p-3 text-sm font-medium text-rose-400 border border-rose-500/20">
              {erro}
            </div>
          )}

          {/* SELETOR DE COMPRA / VENDA */}
          <div className="grid grid-cols-2 gap-3 mb-2">
            <button
              type="button"
              onClick={() => setTipo("COMPRA")}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-all ${
                tipo === "COMPRA" 
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400" 
                  : "border-zinc-800 bg-zinc-800/30 text-zinc-500 hover:bg-zinc-800"
              }`}
            >
              <ArrowDownCircle className="h-4 w-4" /> Compra
            </button>
            <button
              type="button"
              onClick={() => setTipo("VENDA")}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-all ${
                tipo === "VENDA" 
                  ? "border-rose-500/50 bg-rose-500/10 text-rose-400" 
                  : "border-zinc-800 bg-zinc-800/30 text-zinc-500 hover:bg-zinc-800"
              }`}
            >
              <ArrowUpCircle className="h-4 w-4" /> Venda
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Ticker do Ativo</label>
              <input
                type="text"
                required
                placeholder="Ex: TRXF11"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 p-3 text-sm text-zinc-100 uppercase focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Categoria</label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 p-3 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="FII">Fundo Imobiliário</option>
                <option value="ACAO">Ação</option>
                <option value="ETF">ETF (Ex: IVVB11)</option>
                <option value="OUTRO">Outro</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Qtd da Boleta</label>
              <input
                type="number"
                step="0.0001"
                required
                placeholder="Ex: 10"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 p-3 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Preço Unitário (R$)</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="Ex: 105.50"
                value={precoUnitario}
                onChange={(e) => setPrecoUnitario(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 p-3 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Oculta a meta se for uma Venda, afinal meta se faz comprando! */}
          {tipo === "COMPRA" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Percentual Alvo (%) na Carteira</label>
              <input
                type="number"
                step="0.1"
                placeholder="Ex: 15"
                value={percentualAlvo}
                onChange={(e) => setPercentualAlvo(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 p-3 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3 border-t border-zinc-800 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-700 bg-transparent px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
                tipo === "COMPRA" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-rose-600 hover:bg-rose-500"
              }`}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : `Salvar ${tipo}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}