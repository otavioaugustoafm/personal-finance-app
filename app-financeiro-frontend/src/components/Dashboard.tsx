import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, LogOut, Tags } from "lucide-react";
import { api, mensagemDeErro } from "../lib/api";
import {
  FILTROS_VAZIOS, SEM_CATEGORIA, calcularPrevisoes, categoriaDeGastoPorNome, comprasNoCredito, contarFiltrosAtivos, filtrarTransacoes,
  gastosPorCategoria, mapaDeCategorias, resumoDeContas, saldoPresumido, totaisDoMes, totalDaCategoria, type Filtros,
} from "../lib/calculos";
import { nomeDoMes } from "../lib/format";
import { chaveDoPeriodo, intervaloDoPeriodo, periodoDeHoje, rotuloDoIntervalo, somarMeses, type Periodo } from "../lib/periodo";
import type { Categoria, Conta, Direcao, Previsao, StatusSincronizacao, Transacao } from "../lib/types";
import AvisosSincronizacao from "./AvisosSincronizacao";
import CategoriasModal from "./CategoriasModal";
import EditarTransacaoModal from "./EditarTransacaoModal";
import FiltrosTransacoes from "./FiltrosTransacoes";
import GastosPorCategoria from "./GastosPorCategoria";
import ListaTransacoes from "./ListaTransacoes";
import PrevisoesModal from "./PrevisoesModal";
import ResumoCards from "./ResumoCards";

interface DashboardProps {
  onLogout: () => void;
}

interface Base {
  categorias: Categoria[];
  contas: Conta[];
  status: StatusSincronizacao;
  desatualizado: boolean;
}

const LOTE_MAXIMO = 500; // limite do endpoint de categorizacao em lote
const HORAS_ATE_DESATUALIZAR = 36;

const CHAVE_DESTAQUE = "categoria-em-destaque";
const NOME_PADRAO_DESTAQUE = "Gastos da Mãe";

function lerDestaqueSalvo(): string | null {
  try {
    return localStorage.getItem(CHAVE_DESTAQUE);
  } catch {
    return null; // navegador sem armazenamento: o card ainda funciona, so nao lembra a escolha
  }
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoDeHoje(new Date()));
  const [idDestaqueSalvo, setIdDestaqueSalvo] = useState<string | null>(lerDestaqueSalvo);
  const [versaoBase, setVersaoBase] = useState(0);
  const [base, setBase] = useState<(Base & { versao: number }) | null>(null);
  const [versaoTransacoes, setVersaoTransacoes] = useState(0);
  const [dadosTransacoes, setDadosTransacoes] = useState<{ chave: string; transacoes: Transacao[] } | null>(null);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  const [tipoGrafico, setTipoGrafico] = useState<Direcao>("SAIDA");
  const [editando, setEditando] = useState<Transacao | null>(null);
  const [modalCategorias, setModalCategorias] = useState(false);
  const [modalPrevisoes, setModalPrevisoes] = useState(false);
  const [dadosPrevisoes, setDadosPrevisoes] = useState<{ chave: string; previsoes: Previsao[] } | null>(null);
  const [previsoesIndisponiveis, setPrevisoesIndisponiveis] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const chave = `${periodo.ano}-${periodo.mes}-${versaoTransacoes}`;
  const chavePeriodo = chaveDoPeriodo(periodo);

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
    const { de, ate } = intervaloDoPeriodo(periodo);
    api
      .get("/api/v1/transacoes", { params: { de, ate, incluir_ignoradas: true, limite: 1000 } })
      .then((res) => ativo && setDadosTransacoes({ chave, transacoes: res.data.transacoes }))
      .catch(() => ativo && setErro("Não foi possível carregar as transações."));
    return () => {
      ativo = false;
    };
  }, [chave, periodo]);

  // Previsoes (entradas esperadas / saidas previstas) do periodo escolhido
  useEffect(() => {
    let ativo = true;
    api
      .get("/api/v1/previsoes", { params: { periodo: chavePeriodo } })
      .then((res) => {
        if (!ativo) return;
        setPrevisoesIndisponiveis(false);
        setDadosPrevisoes({ chave: chavePeriodo, previsoes: res.data.previsoes });
      })
      .catch(() => ativo && setPrevisoesIndisponiveis(true)); // so o saldo presumido fica indisponivel; o resto do painel segue
    return () => {
      ativo = false;
    };
  }, [chavePeriodo]);

  const carregando = dadosTransacoes?.chave !== chave;
  const transacoes = useMemo(() => (carregando ? [] : (dadosTransacoes?.transacoes ?? [])), [carregando, dadosTransacoes]);
  const mapa = useMemo(() => mapaDeCategorias(base?.categorias ?? []), [base?.categorias]);
  const filtradas = useMemo(() => filtrarTransacoes(transacoes, filtros), [transacoes, filtros]);
  const totaisFiltro = useMemo(() => totaisDoMes(filtradas), [filtradas]);
  // o grafico respeita busca, forma e "fora do fluxo", mas mostra todas as categorias (e o tipo e escolhido nele)
  const gastos = useMemo(
    () => gastosPorCategoria(filtrarTransacoes(transacoes, filtros, { ignorarCategorias: true, ignorarDirecao: true }), mapa, tipoGrafico),
    [transacoes, filtros, mapa, tipoGrafico],
  );
  const semCategoria = useMemo(() => transacoes.filter((t) => !t.ignorar_no_fluxo && t.categoria_id === null).length, [transacoes]);
  const contas = useMemo(() => resumoDeContas(base?.contas ?? []), [base?.contas]);
  const rotuloPeriodo = useMemo(() => {
    const { de, ate } = intervaloDoPeriodo(periodo);
    return rotuloDoIntervalo(de, ate);
  }, [periodo]);
  const compras = useMemo(() => comprasNoCredito(transacoes), [transacoes]);
  const categoriasDeGasto = useMemo(() => (base?.categorias ?? []).filter((c) => c.tipo === "SAIDA"), [base?.categorias]);
  // a escolhida pelo usuario; se nao houver (ou foi excluida), a que se chama "Gastos da Mae"
  const categoriaDestaque = useMemo(
    () => categoriasDeGasto.find((c) => c.id === idDestaqueSalvo) ?? categoriaDeGastoPorNome(categoriasDeGasto, NOME_PADRAO_DESTAQUE),
    [categoriasDeGasto, idDestaqueSalvo],
  );
  const destaque = useMemo(
    () => (categoriaDestaque ? { nome: categoriaDestaque.nome, ...totalDaCategoria(transacoes, categoriaDestaque.id) } : null),
    [categoriaDestaque, transacoes],
  );

  const previsoes = useMemo(() => (dadosPrevisoes?.chave === chavePeriodo ? dadosPrevisoes.previsoes : []), [dadosPrevisoes, chavePeriodo]);
  const carregandoPrevisoes = !previsoesIndisponiveis && dadosPrevisoes?.chave !== chavePeriodo;
  // previsoes ligadas a uma categoria acompanham o total dela no periodo (sobem a cada novo gasto)
  const previsoesCalculadas = useMemo(() => calcularPrevisoes(previsoes, transacoes, base?.categorias ?? []), [previsoes, transacoes, base?.categorias]);
  const presumido = useMemo(
    () => saldoPresumido(contas.saldoEmConta, compras.total, previsoesCalculadas),
    [contas.saldoEmConta, compras.total, previsoesCalculadas],
  );
  const tituloPrevisoes = `${nomeDoMes(periodo.ano, periodo.mes)} · ${rotuloPeriodo}`;

  // Previsoes: cada acao devolve null (deu certo) ou a mensagem de erro; a lista local acompanha a resposta da API
  const ordenarPrevisoes = (lista: Previsao[]) => [...lista].sort((a, b) => Number(a.concluida) - Number(b.concluida)); // concluidas no fim
  const trocarPrevisoes = (mudar: (lista: Previsao[]) => Previsao[]) =>
    setDadosPrevisoes((atual) => atual && { ...atual, previsoes: ordenarPrevisoes(mudar(atual.previsoes)) });

  const criarPrevisao = async (dados: { tipo: Direcao; descricao: string; valor: string | null; categoria_id: string | null }): Promise<string | null> => {
    try {
      const res = await api.post("/api/v1/previsoes", { ...dados, periodo: chavePeriodo });
      trocarPrevisoes((lista) => [...lista, res.data as Previsao]);
      return null;
    } catch (e) {
      return mensagemDeErro(e);
    }
  };
  const atualizarPrevisao = async (id: string, mudancas: { descricao?: string; valor?: string; concluida?: boolean }): Promise<string | null> => {
    try {
      const res = await api.patch(`/api/v1/previsoes/${id}`, mudancas);
      trocarPrevisoes((lista) => lista.map((p) => (p.id === id ? (res.data as Previsao) : p)));
      return null;
    } catch (e) {
      return mensagemDeErro(e);
    }
  };
  const excluirPrevisao = async (id: string): Promise<string | null> => {
    try {
      await api.delete(`/api/v1/previsoes/${id}`);
      trocarPrevisoes((lista) => lista.filter((p) => p.id !== id));
      return null;
    } catch (e) {
      return mensagemDeErro(e);
    }
  };

  const trocarDestaque = (id: string) => {
    setIdDestaqueSalvo(id);
    try {
      localStorage.setItem(CHAVE_DESTAQUE, id);
    } catch {
      /* sem armazenamento: vale so ate recarregar */
    }
  };

  const alternarCategoria = (chave: string) =>
    setFiltros((f) => {
      const jaTem = f.categorias.includes(chave);
      return {
        ...f,
        categorias: jaTem ? f.categorias.filter((c) => c !== chave) : [...f.categorias, chave],
        // clicar numa barra de "Saidas" mostra as saidas dessa categoria (o grafico so conta aquele tipo)
        direcao: !jaTem && f.direcao === "TODAS" ? tipoGrafico : f.direcao,
      };
    });

  const mudarMes = (delta: number) => setPeriodo((p) => somarMeses(p, delta));

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
    } catch (erro) {
      desfazer(mensagemDeErro(erro, "Não foi possível salvar a categoria. Tente novamente."));
    }
  };

  const ignorar = async (id: string, ignorarNoFluxo: boolean) => {
    atualizarLocalmente([id], { ignorar_no_fluxo: ignorarNoFluxo });
    try {
      await api.patch(`/api/v1/transacoes/${id}`, { ignorar_no_fluxo: ignorarNoFluxo });
    } catch (erro) {
      desfazer(mensagemDeErro(erro, "Não foi possível salvar a alteração. Tente novamente."));
    }
  };

  // Troca a linha editada pela devolvida pelo servidor; se a data saiu do mes exibido, a linha some daqui
  const aplicarLinha = (linha: Transacao) => {
    const { de, ate } = intervaloDoPeriodo(periodo);
    const dentroDoMes = linha.data >= de && linha.data <= ate;
    setDadosTransacoes((atual) =>
      atual && {
        ...atual,
        transacoes: dentroDoMes ? atual.transacoes.map((t) => (t.id === linha.id ? linha : t)) : atual.transacoes.filter((t) => t.id !== linha.id),
      },
    );
  };

  const salvarEdicao = async (id: string, alteracoes: Record<string, unknown>): Promise<string | null> => {
    try {
      const res = await api.patch(`/api/v1/transacoes/${id}`, alteracoes);
      aplicarLinha(res.data as Transacao);
      return null;
    } catch (erro) {
      return mensagemDeErro(erro);
    }
  };

  const restaurarEdicao = async (id: string): Promise<string | null> => {
    try {
      const res = await api.post(`/api/v1/transacoes/${id}/restaurar`);
      aplicarLinha(res.data as Transacao);
      return null;
    } catch (erro) {
      return mensagemDeErro(erro, "Não foi possível restaurar. Tente novamente.");
    }
  };

  return (
    <div className="min-h-dvh bg-fundo text-texto">
      <header className="pt-seguro sticky top-0 z-40 border-b border-borda/70 bg-fundo/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-3 sm:px-6 lg:px-10">
          <div className="hidden items-center gap-2.5 sm:flex sm:flex-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-latao font-display text-sm font-bold text-latao-tinta" aria-hidden="true">R$</span>
            <h1 className="font-display text-lg font-semibold tracking-tight">Controle Financeiro</h1>
          </div>

          {/* troca de período: o principal controle de navegação */}
          <div className="flex min-w-0 flex-1 items-center justify-between rounded-full bg-painel p-1 sm:max-w-xs sm:flex-none">
            <button onClick={() => mudarMes(-1)} aria-label="Período anterior" className="rounded-full p-2.5 text-suave transition-colors hover:bg-painel-2 hover:text-texto sm:p-2">
              <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" />
            </button>
            <button
              onClick={() => setPeriodo(periodoDeHoje(new Date()))}
              title="Voltar ao período atual"
              className="min-w-0 flex-1 truncate px-1 text-center leading-tight"
            >
              <span className="block truncate text-[15px] font-semibold first-letter:uppercase sm:text-sm">{nomeDoMes(periodo.ano, periodo.mes)}</span>
              <span className="block text-xs text-apagado">{rotuloPeriodo}</span>
            </button>
            <button onClick={() => mudarMes(1)} aria-label="Próximo período" className="rounded-full p-2.5 text-suave transition-colors hover:bg-painel-2 hover:text-texto sm:p-2">
              <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4" />
            </button>
          </div>

          <div className="flex items-center gap-1 sm:flex-1 sm:justify-end">
            <button
              onClick={() => setModalCategorias(true)}
              aria-label="Categorias"
              className="flex items-center gap-2 rounded-full p-3 text-suave transition-colors hover:bg-painel hover:text-texto sm:px-3.5 sm:py-2"
            >
              <Tags className="h-5 w-5 sm:h-4 sm:w-4" /> <span className="hidden text-sm sm:inline">Categorias</span>
            </button>
            <button
              onClick={onLogout}
              aria-label="Sair"
              className="flex items-center gap-2 rounded-full p-3 text-suave transition-colors hover:bg-painel hover:text-texto sm:px-3.5 sm:py-2"
            >
              <LogOut className="h-5 w-5 sm:h-4 sm:w-4" /> <span className="hidden text-sm sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-3 px-3 pb-[max(2rem,env(safe-area-inset-bottom))] pt-3 sm:space-y-4 sm:px-6 sm:pt-5 lg:px-10">
        {erro && (
          <div role="alert" className="flex items-start justify-between gap-3 rounded-2xl border border-saida/30 bg-saida/10 px-4 py-3 text-sm text-saida">
            <span className="min-w-0">{erro}</span>
            <button onClick={() => setErro(null)} className="shrink-0 font-medium underline-offset-2 hover:underline">Fechar</button>
          </div>
        )}

        {base && <AvisosSincronizacao status={base.status} desatualizado={base.desatualizado} />}

        <ResumoCards
          carregando={carregando || carregandoPrevisoes}
          saldoEmConta={contas.saldoEmConta}
          temContas={contas.temContas}
          rotuloPeriodo={rotuloPeriodo}
          compras={compras}
          presumido={{
            aReceber: presumido.aReceber,
            aPagar: presumido.aPagar,
            valor: presumido.presumido,
            pendentes: previsoes.filter((p) => !p.concluida).length,
            indisponivel: previsoesIndisponiveis,
          }}
          onAbrirPrevisoes={() => setModalPrevisoes(true)}
          destaque={destaque}
          categoriasDeGasto={categoriasDeGasto}
          idDestaque={categoriaDestaque?.id ?? null}
          onTrocarDestaque={trocarDestaque}
        />

        <FiltrosTransacoes filtros={filtros} onChange={setFiltros} categorias={base?.categorias ?? []} mapaCategorias={mapa} />

        <div className="grid items-start gap-3 sm:gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <GastosPorCategoria gastos={gastos} tipo={tipoGrafico} onTipo={setTipoGrafico} selecionadas={filtros.categorias} onAlternar={alternarCategoria} />
          </div>
          <div className="min-w-0 lg:col-span-2">
            <ListaTransacoes
              key={`${periodo.ano}-${periodo.mes}`} // reinicia a seleção ao trocar de mês (os filtros permanecem)
              transacoes={filtradas}
              categorias={base?.categorias ?? []}
              mapaCategorias={mapa}
              carregando={carregando}
              filtrosAtivos={contarFiltrosAtivos(filtros)}
              resumoFiltro={totaisFiltro}
              semCategoria={semCategoria}
              onVerSemCategoria={() => setFiltros({ ...FILTROS_VAZIOS, categorias: [SEM_CATEGORIA] })}
              onCategorizar={categorizar}
              onIgnorar={ignorar}
              onEditar={setEditando}
            />
          </div>
        </div>
      </main>

      {editando && (
        <EditarTransacaoModal
          key={editando.id}
          transacao={editando}
          categorias={base?.categorias ?? []}
          onClose={() => setEditando(null)}
          onSalvar={salvarEdicao}
          onRestaurar={restaurarEdicao}
        />
      )}

      {modalPrevisoes && !previsoesIndisponiveis && (
        <PrevisoesModal
          tituloPeriodo={tituloPrevisoes}
          previsoes={previsoesCalculadas}
          categorias={base?.categorias ?? []}
          mapaCategorias={mapa}
          resumo={{ saldoEmConta: contas.saldoEmConta, aReceber: presumido.aReceber, aPagar: presumido.aPagar, faturaAtual: compras.total, presumido: presumido.presumido }}
          onClose={() => setModalPrevisoes(false)}
          onCriar={criarPrevisao}
          onAtualizar={atualizarPrevisao}
          onExcluir={excluirPrevisao}
        />
      )}

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
