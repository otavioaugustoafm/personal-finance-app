import { useEffect, useState } from "react";
import { X } from "lucide-react";
import axios from "axios";

interface Categoria {
  id: string;
  nome: string;
  tipo: string;
}

interface DespesaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dados: any) => void;
  despesaParaEditar?: any;
}

export default function DespesaModal({ isOpen, onClose, onSave, despesaParaEditar }: DespesaModalProps) {
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [tipoSaida, setTipoSaida] = useState("SAIDA");
  const [pago, setPago] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState("PIX");
  const [isReembolsavel, setIsReembolsavel] = useState(false);
  const [quantidadeParcelas, setQuantidadeParcelas] = useState("1");
  
  const [categoriasGlobais, setCategoriasGlobais] = useState<Categoria[]>([]);

  useEffect(() => {
    const carregarCategorias = async () => {
      try {
        const token = localStorage.getItem("token") || "";
        const res = await axios.get("http://127.0.0.1:8000/api/v1/categorias", {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCategoriasGlobais(res.data.categorias || []);
      } catch (error) {
        console.error("Erro ao carregar categorias", error);
      }
    };
    if (isOpen) carregarCategorias();
  }, [isOpen]);

  const categoriasFiltradas = categoriasGlobais.filter(c => c.tipo === tipoSaida);

  useEffect(() => {
    if (categoriasFiltradas.length > 0 && !categoriasFiltradas.find(c => c.nome === categoria)) {
      setCategoria(categoriasFiltradas[0].nome);
    }
  }, [tipoSaida, categoriasFiltradas, categoria]);

  useEffect(() => {
    if (despesaParaEditar) {
      setDescricao(despesaParaEditar.descricao || "");
      setValor(despesaParaEditar.valor ? String(despesaParaEditar.valor) : "");
      setCategoria(despesaParaEditar.categoria || "");
      setDataVencimento(despesaParaEditar.data_vencimento || "");
      setTipoSaida(despesaParaEditar.tipo_saida || "SAIDA");
      setPago(despesaParaEditar.pago || false);
      setFormaPagamento(despesaParaEditar.forma_pagamento || "PIX");
      setIsReembolsavel(despesaParaEditar.is_reembolsavel || false);
      setQuantidadeParcelas("1"); // Edições tratam a parcela individual
    } else {
      setDescricao("");
      setValor("");
      setDataVencimento(new Date().toISOString().split("T")[0]);
      setTipoSaida("SAIDA");
      setPago(false);
      setFormaPagamento("PIX");
      setIsReembolsavel(false);
      setQuantidadeParcelas("1");
    }
  }, [despesaParaEditar, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload: any = {
      descricao,
      valor: parseFloat(valor.replace(",", ".")),
      categoria: categoria,
      data_vencimento: dataVencimento,
      tipo_saida: tipoSaida,
      pago,
      forma_pagamento: formaPagamento,
      is_reembolsavel: isReembolsavel,
      regra_recorrencia: "DATA_EXATA",
    };

    // Só manda parcelas se for uma criação nova
    if (!despesaParaEditar) {
      payload.quantidade_parcelas = parseInt(quantidadeParcelas) || 1;
    }

    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-zinc-100">
            {despesaParaEditar ? "Editar Lançamento" : "Novo Lançamento"}
          </h2>
          <button onClick={onClose} className="rounded-full p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4">
            <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/50 py-3 text-sm font-medium text-zinc-300 transition-colors has-[:checked]:border-rose-500 has-[:checked]:bg-rose-500/10 has-[:checked]:text-rose-400">
              <input type="radio" name="tipo" value="SAIDA" checked={tipoSaida === "SAIDA"} onChange={() => setTipoSaida("SAIDA")} className="hidden" />
              Saída
            </label>
            <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/50 py-3 text-sm font-medium text-zinc-300 transition-colors has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-500/10 has-[:checked]:text-emerald-400">
              <input type="radio" name="tipo" value="ENTRADA" checked={tipoSaida === "ENTRADA"} onChange={() => setTipoSaida("ENTRADA")} className="hidden" />
              Entrada
            </label>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Descrição</label>
            <input required type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Tênis de Corrida..." className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Valor (R$)</label>
              <input required type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0.00" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Data de Vencimento</label>
              <input required type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className={tipoSaida === "ENTRADA" ? "col-span-2" : "col-span-1"}>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Categoria</label>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-emerald-500">
                {categoriasFiltradas.length > 0 ? (
                  categoriasFiltradas.map(cat => (
                    <option key={cat.id} value={cat.nome}>{cat.nome}</option>
                  ))
                ) : (
                  <option value="">Nenhuma categoria cadastrada</option>
                )}
              </select>
            </div>
            
            {tipoSaida === "SAIDA" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Pagamento</label>
                <select value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-emerald-500">
                  <option value="CREDITO">Crédito</option>
                  <option value="DEBITO">Débito</option>
                  <option value="PIX">Pix</option>
                  <option value="BOLETO">Boleto</option>
                </select>
              </div>
            )}
          </div>

          {/* Campo de Parcelas (Aparece apenas ao criar uma nova Saída) */}
          {!despesaParaEditar && tipoSaida === "SAIDA" && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Quantidade de Parcelas</label>
              <input 
                type="number" 
                min="1" 
                max="60" 
                value={quantidadeParcelas} 
                onChange={(e) => setQuantidadeParcelas(e.target.value)} 
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-emerald-500" 
              />
            </div>
          )}

          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <label className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" checked={pago} onChange={(e) => setPago(e.target.checked)} className="h-4 w-4 accent-emerald-500" />
              <span className="text-sm font-medium text-zinc-200">
                {tipoSaida === "ENTRADA" ? "Este valor já foi recebido" : "Esta conta já foi paga"}
              </span>
            </label>
            
            {tipoSaida === "SAIDA" && (
              <label className="flex cursor-pointer items-center gap-3">
                <input type="checkbox" checked={isReembolsavel} onChange={(e) => setIsReembolsavel(e.target.checked)} className="h-4 w-4 accent-amber-500" />
                <span className="text-sm font-medium text-amber-400/90">
                  Este valor será reembolsado (A receber)
                </span>
              </label>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors">Cancelar</button>
            <button type="submit" disabled={!categoria} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-md hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              Salvar Lançamento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}