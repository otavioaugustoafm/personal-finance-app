import { useEffect, useState } from "react";
import { X, Trash2, Plus } from "lucide-react";
import axios from "axios";

interface Categoria {
  id: string;
  nome: string;
  tipo: string;
}

interface CategoriasModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CategoriasModal({ isOpen, onClose }: CategoriasModalProps) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [tipoNovaCategoria, setTipoNovaCategoria] = useState("SAIDA");
  const [isLoading, setIsLoading] = useState(false);

  const carregarCategorias = async () => {
    try {
      const token = localStorage.getItem("token") || "";
      const res = await axios.get("https://fqdj9kncvf.execute-api.us-east-2.amazonaws.com/api/v1/categorias", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCategorias(res.data.categorias || []);
    } catch (error) {
      console.error("Erro ao carregar categorias", error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      carregarCategorias();
      setNovaCategoria("");
    }
  }, [isOpen]);

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaCategoria.trim()) return;

    setIsLoading(true);
    try {
      const token = localStorage.getItem("token") || "";
      await axios.post(
        "https://fqdj9kncvf.execute-api.us-east-2.amazonaws.com/api/v1/categorias",
        { nome: novaCategoria.trim(), tipo: tipoNovaCategoria },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNovaCategoria("");
      carregarCategorias();
    } catch (error) {
      console.error("Erro ao criar categoria", error);
      alert("Erro ao criar categoria.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletar = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta categoria? Lançamentos atrelados a ela podem perder a referência.")) {
      try {
        const token = localStorage.getItem("token") || "";
        await axios.delete(`https://fqdj9kncvf.execute-api.us-east-2.amazonaws.com/api/v1/categorias/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        carregarCategorias();
      } catch (error) {
        console.error("Erro ao deletar categoria", error);
        alert("Erro ao deletar categoria.");
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Cabeçalho */}
        <div className="mb-6 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-semibold text-zinc-100">Gerenciar Categorias</h2>
          <button onClick={onClose} className="rounded-full p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Formulário de Criação */}
        <div className="mb-6 shrink-0 space-y-4">
          <div className="flex gap-4">
            <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/50 py-2.5 text-sm font-medium text-zinc-300 transition-colors has-[:checked]:border-rose-500 has-[:checked]:bg-rose-500/10 has-[:checked]:text-rose-400">
              <input type="radio" value="SAIDA" checked={tipoNovaCategoria === "SAIDA"} onChange={() => setTipoNovaCategoria("SAIDA")} className="hidden" />
              Despesa
            </label>
            <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/50 py-2.5 text-sm font-medium text-zinc-300 transition-colors has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-500/10 has-[:checked]:text-emerald-400">
              <input type="radio" value="ENTRADA" checked={tipoNovaCategoria === "ENTRADA"} onChange={() => setTipoNovaCategoria("ENTRADA")} className="hidden" />
              Entrada
            </label>
          </div>

          <form onSubmit={handleCriar} className="flex gap-2">
            <input 
              type="text" 
              value={novaCategoria} 
              onChange={(e) => setNovaCategoria(e.target.value)} 
              placeholder="Nome da categoria..." 
              className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-emerald-500" 
            />
            <button 
              type="submit" 
              disabled={isLoading || !novaCategoria.trim()} 
              className="flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              <Plus className="h-5 w-5" />
            </button>
          </form>
        </div>

        {/* Lista de Categorias com Scroll */}
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
          {categorias.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">Nenhuma categoria encontrada.</p>
          ) : (
            categorias.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between rounded-xl border border-zinc-800/60 bg-zinc-800/30 p-3 hover:bg-zinc-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-zinc-200">{cat.nome}</span>
                  <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    cat.tipo === "SAIDA" 
                      ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" 
                      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  }`}>
                    {cat.tipo === "SAIDA" ? "Saída" : "Entrada"}
                  </span>
                </div>
                <button 
                  onClick={() => handleDeletar(cat.id)}
                  className="rounded-lg p-1.5 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                  title="Excluir categoria"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
        
      </div>
    </div>
  );
}