import { useState, useEffect } from "react";
import { X, Loader2, Trash2 } from "lucide-react";
import axios from "axios";

interface Transacao {
  id: string;
  tipo: string;
  quantidade: string;
  preco_unitario: string;
  data_transacao: string;
}

interface ModalDetalhesProps {
  isOpen: boolean;
  onClose: () => void;
  ativoId: string;
  ticker: string;
  metaAtual: number;
  onSuccess: () => void;
}

export default function ModalDetalhesAtivo({ isOpen, onClose, ativoId, ticker, metaAtual, onSuccess }: ModalDetalhesProps) {
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [novaMeta, setNovaMeta] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);

  useEffect(() => {
    if (isOpen && ativoId) {
      setNovaMeta(metaAtual.toString());
      carregarTransacoes();
    }
  }, [isOpen, ativoId]);

  const carregarTransacoes = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      // ⚠️ ATENÇÃO: COLOQUE A SUA URL DA AWS AQUI
      const res = await axios.get(`https://fqdj9kncvf.execute-api.us-east-2.amazonaws.com/api/v1/investimentos/${ativoId}/transacoes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTransacoes(res.data);
    } catch (error) {
      console.error("Erro ao carregar transações", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSalvarMeta = async () => {
    setLoadingMeta(true);
    try {
      const token = localStorage.getItem("token");
      // ⚠️ ATENÇÃO: COLOQUE A SUA URL DA AWS AQUI
      await axios.put(`https://fqdj9kncvf.execute-api.us-east-2.amazonaws.com/api/v1/investimentos/${ativoId}/meta`, {
        percentual_alvo: parseFloat(novaMeta.replace(",", "."))
      }, { headers: { Authorization: `Bearer ${token}` } });
      onSuccess();
    } catch (error) {
      console.error("Erro ao salvar meta", error);
    } finally {
      setLoadingMeta(false);
    }
  };

  const handleDelete = async (transacaoId: string) => {
    if (!confirm("Tem certeza que deseja apagar esta transação? O Preço Médio será recalculado.")) return;
    try {
      const token = localStorage.getItem("token");
      // ⚠️ ATENÇÃO: COLOQUE A SUA URL DA AWS AQUI
      await axios.delete(`https://fqdj9kncvf.execute-api.us-east-2.amazonaws.com/api/v1/investimentos/transacoes/${transacaoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      carregarTransacoes();
      onSuccess(); // Atualiza a tabela principal no fundo
    } catch (error) {
      console.error("Erro ao deletar", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* CABEÇALHO */}
        <div className="flex items-center justify-between border-b border-zinc-800 p-5 shrink-0">
          <h2 className="text-xl font-bold text-zinc-100">{ticker}</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* CORPO ROLÁVEL */}
        <div className="p-5 overflow-y-auto space-y-6">
          
          {/* EDIÇÃO DE META */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-800/30 p-4">
            <label className="text-xs font-medium text-zinc-400 block mb-2">Meta na Carteira (%)</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                value={novaMeta}
                onChange={(e) => setNovaMeta(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2.5 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
              />
              <button
                onClick={handleSalvarMeta}
                disabled={loadingMeta}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
              >
                {loadingMeta ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </button>
            </div>
          </div>

          {/* EXTRATO */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-300 mb-3">Extrato de Transações</h3>
            {loading ? (
              <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>
            ) : transacoes.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-4">Nenhuma transação encontrada.</p>
            ) : (
              <div className="space-y-2">
                {transacoes.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-xl border border-zinc-800/50 bg-zinc-800/20 p-3 hover:bg-zinc-800/50 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${t.tipo === 'COMPRA' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          {t.tipo}
                        </span>
                        <span className="text-xs text-zinc-400">
                          {new Date(t.data_transacao).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-200 mt-1 font-medium">
                        {parseFloat(t.quantidade)} cotas a R$ {parseFloat(t.preco_unitario).toFixed(2)}
                      </p>
                    </div>
                    <button 
                      onClick={() => handleDelete(t.id)}
                      className="p-2 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Apagar boleta"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}