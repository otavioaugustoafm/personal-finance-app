import { useEffect, useRef, useState } from "react";
import { Palette, Plus, Trash2 } from "lucide-react";
import Folha from "./Folha";
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
        className="h-8 w-8 rounded-full ring-2 ring-borda-forte ring-offset-2 ring-offset-painel transition-transform hover:scale-105"
        style={{ backgroundColor: valor ?? "#6f8f91" }}
      />
      {aberto && (
        <div className="absolute left-0 top-10 z-10 grid w-52 grid-cols-5 gap-2.5 rounded-2xl border border-borda-forte bg-painel-2 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
          {PALETA_CATEGORIAS.map((cor) => (
            <button
              key={cor}
              type="button"
              aria-label={`Cor ${cor}`}
              onClick={() => {
                onChange(cor);
                setAberto(false);
              }}
              className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${valor?.toLowerCase() === cor ? "ring-2 ring-texto ring-offset-2 ring-offset-painel-2" : ""}`}
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

  const grupos: [string, Categoria[]][] = [
    ["Despesas", categorias.filter((c) => c.tipo === "SAIDA")],
    ["Entradas", categorias.filter((c) => c.tipo === "ENTRADA")],
  ];

  return (
    <Folha titulo="Categorias" subtitulo="Toque na bolinha para trocar a cor" onClose={onClose}>
      {erro && <div role="alert" className="mb-3 rounded-xl border border-saida/30 bg-saida/10 px-3 py-2.5 text-sm text-saida">{erro}</div>}

      <form onSubmit={handleCriar} className="mb-5 space-y-2.5 rounded-2xl border border-borda bg-fundo/60 p-3">
        <div className="flex rounded-full bg-fundo p-0.5 text-sm" role="group" aria-label="Tipo da nova categoria">
          {(["SAIDA", "ENTRADA"] as const).map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => setTipoNovaCategoria(tipo)}
              aria-pressed={tipoNovaCategoria === tipo}
              className={`flex-1 rounded-full px-3 py-2 transition-colors ${
                tipoNovaCategoria === tipo ? (tipo === "SAIDA" ? "bg-saida/15 text-saida" : "bg-entrada/15 text-entrada") : "text-apagado hover:text-suave"
              }`}
            >
              {tipo === "SAIDA" ? "Despesa" : "Entrada"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2.5">
          <SeletorDeCor valor={corDaNova} onChange={setCorEscolhida} rotulo="Cor da nova categoria" />
          <input
            type="text"
            value={novaCategoria}
            onChange={(e) => setNovaCategoria(e.target.value)}
            placeholder="Nome da nova categoria"
            aria-label="Nome da nova categoria"
            className="campo min-w-0 flex-1"
          />
          <button type="submit" disabled={ocupado || !novaCategoria.trim()} aria-label="Criar categoria" className="botao-acao shrink-0 px-3!">
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </form>

      {repetidas.length > 0 && (
        <button onClick={corrigirRepetidas} disabled={ocupado} className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-aviso/30 bg-aviso/10 px-3 py-2.5 text-sm text-aviso transition-colors hover:bg-aviso/20 disabled:opacity-50">
          <Palette className="h-4 w-4 shrink-0" /> Dar cores diferentes às {repetidas.length} categorias com cor repetida
        </button>
      )}

      {categorias.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-borda py-8 text-center text-sm text-apagado">Nenhuma categoria ainda. Crie a primeira acima.</p>
      ) : (
        grupos.map(([titulo, lista]) =>
          lista.length > 0 ? (
            <div key={titulo} className="mb-4 last:mb-0">
              <h3 className="mb-1.5 px-1 text-sm font-medium text-suave">{titulo} <span className="font-normal text-apagado">{lista.length}</span></h3>
              <ul className="divide-y divide-borda/70 rounded-2xl border border-borda">
                {lista.map((cat) => (
                  <li key={cat.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <SeletorDeCor valor={cat.cor} onChange={(cor) => trocarCor(cat.id, cor)} rotulo={`Cor de ${cat.nome}`} />
                      <span className="truncate text-[15px] text-texto sm:text-sm">{cat.nome}</span>
                    </div>
                    <button onClick={() => handleDeletar(cat.id)} className="rounded-full p-2 text-apagado transition-colors hover:bg-saida/10 hover:text-saida" title="Excluir categoria" aria-label={`Excluir ${cat.nome}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null,
        )
      )}
    </Folha>
  );
}
