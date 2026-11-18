import { useEffect, useRef, useState } from "react";
import { Palette, Plus, Trash2, X } from "lucide-react";
import { api, mensagemDeErro } from "../lib/api";
import { PALETA_CATEGORIAS, corNaoUsada, corrigirCoresRepetidas } from "../lib/calculos";
import type { Categoria } from "../lib/types";

interface CategoriasModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CategoriasModal({ isOpen, onClose }: CategoriasModalProps) {
  // O conteudo monta so quando abre, entao o estado (lista e campo de texto) sempre comeca limpo.
  return isOpen ? <CategoriasConteudo onClose={onClose} /> : null;
}

/** Bolinha de cor que abre uma grade de cores; um clique escolhe (e salva uma vez so). */
function SeletorDeCor({ valor, onChange, rotulo }: { valor: string | null; onChange: (cor: string) => void; rotulo: string }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const aoClicarFora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [aberto]);

  return (
    <div className="relative shrink-0" ref={caixa}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label={rotulo}
        aria-expanded={aberto}
        className="h-6 w-6 rounded-full ring-2 ring-zinc-700 transition-transform hover:scale-110"
        style={{ backgroundColor: valor ?? "#52525b" }}
      />
      {aberto && (
        <div className="absolute left-0 top-8 z-10 grid w-40 grid-cols-5 gap-2 rounded-xl border border-zinc-700 bg-zinc-900 p-3 shadow-2xl">
          {PALETA_CATEGORIAS.map((cor) => (
            <button
              key={cor}
              type="button"
              aria-label={`Cor ${cor}`}
              onClick={() => {
                onChange(cor);
                setAberto(false);
              }}
              className={`h-5 w-5 rounded-full transition-transform hover:scale-125 ${valor?.toLowerCase() === cor ? "ring-2 ring-white" : ""}`}
              style={{ backgroundColor: cor }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoriasConteudo({ onClose }: { onClose: () => void }) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [tipoNovaCategoria, setTipoNovaCategoria] = useState<"SAIDA" | "ENTRADA">("SAIDA");
  const [corEscolhida, setCorEscolhida] = useState<string | null>(null); // null = proxima cor livre
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregarCategorias = async () => {
    try {
      const res = await api.get("/api/v1/categorias");
      setCategorias(res.data.categorias || []);
    } catch (error) {
      setErro(mensagemDeErro(error, "Não foi possível carregar as categorias."));
    }
  };

  useEffect(() => {
    let ativo = true;
    api
      .get("/api/v1/categorias")
      .then((res) => ativo && setCategorias(res.data.categorias || []))
      .catch((error) => ativo && setErro(mensagemDeErro(error, "Não foi possível carregar as categorias.")));
    return () => {
      ativo = false;
    };
  }, []);

  const corDaNova = corEscolhida ?? corNaoUsada(categorias); // cada categoria nova ja nasce com uma cor diferente
  const repetidas = corrigirCoresRepetidas(categorias);

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaCategoria.trim()) return;
    setOcupado(true);
    setErro(null);
    try {
      await api.post("/api/v1/categorias", { nome: novaCategoria.trim(), tipo: tipoNovaCategoria, cor: corDaNova });
      setNovaCategoria("");
      setCorEscolhida(null);
      await carregarCategorias();
    } catch (error) {
      setErro(mensagemDeErro(error, "Não foi possível criar a categoria."));
    } finally {
      setOcupado(false);
    }
  };

  const trocarCor = async (id: string, cor: string) => {
    setCategorias((atual) => atual.map((c) => (c.id === id ? { ...c, cor } : c))); // atualiza na hora
    try {
      await api.put(`/api/v1/categorias/${id}`, { cor });
    } catch (error) {
      setErro(mensagemDeErro(error, "Não foi possível salvar a cor."));
      carregarCategorias();
    }
  };

  const corrigirRepetidas = async () => {
    setOcupado(true);
    setErro(null);
    try {
      for (const { id, cor } of repetidas) await api.put(`/api/v1/categorias/${id}`, { cor });
    } catch (error) {
      setErro(mensagemDeErro(error, "Não foi possível salvar as cores."));
    }
    await carregarCategorias();
    setOcupado(false);
  };

  const handleDeletar = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta categoria? Transações dessa categoria ficarão sem categoria.")) return;
    try {
      await api.delete(`/api/v1/categorias/${id}`);
      await carregarCategorias();
    } catch (error) {
      setErro(mensagemDeErro(error, "Não foi possível excluir a categoria."));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-label="Gerenciar categorias" className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <div className="mb-5 flex shrink-0 items-center justify-between">
          <h2 className="text-xl font-semibold text-zinc-100">Gerenciar Categorias</h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {erro && <div role="alert" className="mb-3 shrink-0 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{erro}</div>}

        <div className="mb-5 shrink-0 space-y-3">
          <div className="flex gap-3">
            {(["SAIDA", "ENTRADA"] as const).map((tipo) => (
              <label
                key={tipo}
                className={`flex flex-1 cursor-pointer items-center justify-center rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                  tipoNovaCategoria === tipo
                    ? tipo === "SAIDA" ? "border-rose-500 bg-rose-500/10 text-rose-400" : "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                    : "border-zinc-700 bg-zinc-800/50 text-zinc-300"
                }`}
              >
                <input type="radio" value={tipo} checked={tipoNovaCategoria === tipo} onChange={() => setTipoNovaCategoria(tipo)} className="hidden" />
                {tipo === "SAIDA" ? "Despesa" : "Entrada"}
              </label>
            ))}
          </div>

          <form onSubmit={handleCriar} className="flex items-center gap-2">
            <SeletorDeCor valor={corDaNova} onChange={setCorEscolhida} rotulo="Cor da nova categoria" />
            <input
              type="text"
              value={novaCategoria}
              onChange={(e) => setNovaCategoria(e.target.value)}
              placeholder="Nome da categoria..."
              aria-label="Nome da nova categoria"
              className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-emerald-500"
            />
            <button type="submit" disabled={ocupado || !novaCategoria.trim()} aria-label="Adicionar categoria" className="flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-white transition-colors hover:bg-emerald-500 disabled:opacity-50">
              <Plus className="h-5 w-5" />
            </button>
          </form>

          {repetidas.length > 0 && (
            <button onClick={corrigirRepetidas} disabled={ocupado} className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 py-2 text-sm text-amber-300 transition-colors hover:bg-amber-500/20 disabled:opacity-50">
              <Palette className="h-4 w-4" /> Dar cores diferentes às {repetidas.length} categoria(s) com cor repetida
            </button>
          )}
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {categorias.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">Nenhuma categoria encontrada.</p>
          ) : (
            categorias.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between rounded-xl border border-zinc-800/60 bg-zinc-800/30 p-3 transition-colors hover:bg-zinc-800/50">
                <div className="flex min-w-0 items-center gap-3">
                  <SeletorDeCor valor={cat.cor} onChange={(cor) => trocarCor(cat.id, cor)} rotulo={`Cor de ${cat.nome}`} />
                  <span className="truncate text-sm font-medium text-zinc-200">{cat.nome}</span>
                  <span className={`inline-flex shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cat.tipo === "SAIDA" ? "border-rose-500/20 bg-rose-500/10 text-rose-400" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"}`}>
                    {cat.tipo === "SAIDA" ? "Saída" : "Entrada"}
                  </span>
                </div>
                <button onClick={() => handleDeletar(cat.id)} className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-rose-500/10 hover:text-rose-400" title="Excluir categoria" aria-label={`Excluir ${cat.nome}`}>
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
