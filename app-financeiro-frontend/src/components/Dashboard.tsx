import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, LogOut, Tags } from "lucide-react";
import { api } from "../lib/api";
import { gastosPorCategoria, mapaDeCategorias, resumoDeContas, totaisDoMes } from "../lib/calculos";
import { intervaloDoMes, nomeDoMes } from "../lib/format";
import type { Categoria, Conta, StatusSincronizacao, Transacao } from "../lib/types";
import AvisosSincronizacao from "./AvisosSincronizacao";
import CategoriasModal from "./CategoriasModal";
import GastosPorCategoria from "./GastosPorCategoria";
import ListaTransacoes from "./ListaTransacoes";
import ResumoCards from "./ResumoCards";

interface DashboardProps {
  onLogout: () => void;
}

interface Mes {
  ano: number;
  mes: number;
}

interface Base {
  categorias: Categoria[];
  contas: Conta[];
  status: StatusSincronizacao;
  desatualizado: boolean;
}

const LOTE_MAXIMO = 500; // limite do endpoint de categorizacao em lote
const HORAS_ATE_DESATUALIZAR = 36;

function mesAtual(): Mes {
  const hoje = new Date();
  return { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const [periodo, setPeriodo] = useState<Mes>(mesAtual);
  const [versaoBase, setVersaoBase] = useState(0);
  const [base, setBase] = useState<(Base & { versao: number }) | null>(null);
  const [versaoTransacoes, setVersaoTransacoes] = useState(0);
  const [dadosTransacoes, setDadosTransacoes] = useState<{ chave: string; transacoes: Transacao[] } | null>(null);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null);
  const [modalCategorias, setModalCategorias] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const chave = `${periodo.ano}-${periodo.mes}-${versaoTransacoes}`;

  // Categorias, contas e status da sincronizacao (recarrega depois de editar categorias)
  useEffect(() => {
    let ativo = true;
    Promise.all([api.get("/api/v1/categorias"), api.get("/api/v1/contas"), api.get("/api/v1/sincronizacao/status")])
      .then(([cat, contas, status]) => {
        if (!ativo) return;
        const st = status.data as StatusSincronizacao;
        const fim = st.ultima?.finalizada_em;
        setBase({
          versao: versaoBase,
          categorias: cat.data.categorias,
          contas: contas.data.contas,
          status: st,
          desatualizado: !!fim && Date.now() - new Date(fim).getTime() > HORAS_ATE_DESATUALIZAR * 3600 * 1000,
        });
      })
      .catch(() => ativo && setErro("Não foi possível carregar os dados. Verifique se o backend está no ar."));
    return () => {
      ativo = false;
    };
  }, [versaoBase]);

  // Transacoes do mes escolhido
  useEffect(() => {
    let ativo = true;
    const { de, ate } = intervaloDoMes(periodo.ano, periodo.mes);
    api
      .get("/api/v1/transacoes", { params: { de, ate, incluir_ignoradas: true, limite: 1000 } })
      .then((res) => ativo && setDadosTransacoes({ chave, transacoes: res.data.transacoes }))
      .catch(() => ativo && setErro("Não foi possível carregar as transações."));
    return () => {
      ativo = false;
    };
  }, [chave, periodo]);

  const carregando = dadosTransacoes?.chave !== chave;
  const transacoes = useMemo(() => (carregando ? [] : (dadosTransacoes?.transacoes ?? [])), [carregando, dadosTransacoes]);
  const mapa = useMemo(() => mapaDeCategorias(base?.categorias ?? []), [base?.categorias]);
  const totais = useMemo(() => totaisDoMes(transacoes), [transacoes]);
  const gastos = useMemo(() => gastosPorCategoria(transacoes, mapa), [transacoes, mapa]);
  const contas = useMemo(() => resumoDeContas(base?.contas ?? []), [base?.contas]);

  const mudarMes = (delta: number) => {
    setCategoriaFiltro(null);
    setPeriodo(({ ano, mes }) => {
      const d = new Date(ano, mes - 1 + delta, 1);
      return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
    });
  };

  // Atualiza a tela na hora e confirma no servidor; se falhar, desfaz.
  const atualizarLocalmente = (ids: string[], mudanca: Partial<Transacao>) =>
    setDadosTransacoes((atual) =>
      atual && { ...atual, transacoes: atual.transacoes.map((t) => (ids.includes(t.id) ? { ...t, ...mudanca } : t)) },
    );

  const desfazer = (mensagem: string) => {
    setErro(mensagem);
    setVersaoTransacoes((v) => v + 1); // rebusca o estado real
  };

  const categorizar = async (ids: string[], categoriaId: string | null) => {
    atualizarLocalmente(ids, { categoria_id: categoriaId });
    try {
      if (ids.length === 1) {
        await api.patch(`/api/v1/transacoes/${ids[0]}`, { categoria_id: categoriaId });
      } else {
        for (let i = 0; i < ids.length; i += LOTE_MAXIMO) {
          await api.post("/api/v1/transacoes/categorizar-em-lote", { ids: ids.slice(i, i + LOTE_MAXIMO), categoria_id: categoriaId });
        }
      }
    } catch {
      desfazer("Não foi possível salvar a categoria. Tente novamente.");
    }
  };

  const ignorar = async (id: string, ignorarNoFluxo: boolean) => {
    atualizarLocalmente([id], { ignorar_no_fluxo: ignorarNoFluxo });
    try {
      await api.patch(`/api/v1/transacoes/${id}`, { ignorar_no_fluxo: ignorarNoFluxo });
    } catch {
      desfazer("Não foi possível salvar a alteração. Tente novamente.");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold tracking-tight">Controle Financeiro</h1>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900">
              <button onClick={() => mudarMes(-1)} aria-label="Mês anterior" className="p-2 text-zinc-400 transition-colors hover:text-zinc-100">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-36 text-center text-sm font-medium capitalize">{nomeDoMes(periodo.ano, periodo.mes)}</span>
              <button onClick={() => mudarMes(1)} aria-label="Próximo mês" className="p-2 text-zinc-400 transition-colors hover:text-zinc-100">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => setModalCategorias(true)}
              className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              <Tags className="h-4 w-4" /> <span className="hidden sm:inline">Categorias</span>
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </header>

        {erro && (
          <div className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {erro}
            <button onClick={() => setErro(null)} className="ml-3 text-rose-400 hover:text-rose-200">Fechar</button>
          </div>
        )}

        {base && <AvisosSincronizacao status={base.status} desatualizado={base.desatualizado} />}

        <ResumoCards
          saldoEmConta={contas.saldoEmConta}
          cartaoEmAberto={contas.cartaoEmAberto}
          temContas={contas.temContas}
          entradas={totais.entradas}
          saidas={totais.saidas}
        />

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <GastosPorCategoria gastos={gastos} selecionada={categoriaFiltro} onSelecionar={setCategoriaFiltro} />
          </div>
          <div className="lg:col-span-2">
            <ListaTransacoes
              key={chave.split("-").slice(0, 2).join("-")} // reinicia filtros e selecao ao trocar de mes
              transacoes={transacoes}
              categorias={base?.categorias ?? []}
              mapaCategorias={mapa}
              categoriaFiltro={categoriaFiltro}
              onLimparCategoriaFiltro={() => setCategoriaFiltro(null)}
              carregando={carregando}
              onCategorizar={categorizar}
              onIgnorar={ignorar}
            />
          </div>
        </div>
      </div>

      <CategoriasModal
        isOpen={modalCategorias}
        onClose={() => {
          setModalCategorias(false);
          setVersaoBase((v) => v + 1); // recarrega as categorias (nomes, cores, novas, excluidas)
          setVersaoTransacoes((v) => v + 1); // transacoes de categoria excluida ficam sem categoria
        }}
      />
    </div>
  );
}
