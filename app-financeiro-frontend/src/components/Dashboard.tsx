import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Banknote,
  CreditCard,
  Filter,
  Info,
  PiggyBank,
  Undo2,
  Trash2,
  Edit2,
  Plus,
  LogOut,
  Tags,
} from "lucide-react";
import DespesaModal from "./DespesaModal";
import CategoriasModal from "./CategoriasModal";
import axios from "axios";

interface ResumoFinanceiro {
  contas_bancarias: {
    saldo_atual_em_conta: number;
    saldo_projetado_fim_do_mes: number;
  };
  cartao_de_credito: { 
    fatura_atual_pendente: number;
    total_fatura: number;
  };
  terceiros: { valores_a_serem_reembolsados: number };
}

interface Saida {
  id: string;
  descricao: string;
  valor: number;
  categoria: string;
  data_vencimento: string;
  pago: boolean;
  tipo_saida: string;
  is_reembolsavel: boolean;
  forma_pagamento?: string;
}

interface GastoPorCategoria {
  categoria: string;
  total: number;
}

type StatusFiltro = "todos" | "pago" | "pendente" | "reembolsavel";

const formatarMoeda = (valor: number): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);

const formatarData = (isoDate: string): string => {
  if (!isoDate) return "";
  const [ano, mes, dia] = isoDate.split("-");
  return `${dia}/${mes}/${ano}`;
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const CORES_GRAFICO = ["#10B981", "#14B8A6", "#34D399", "#6EE7B7", "#A7F3D0"];

function InfoTooltip({ texto }: { texto: string }) {
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function aoClicarFora(evento: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(evento.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        aria-label="Mais informações"
        onMouseEnter={() => setAberto(true)}
        onMouseLeave={() => setAberto(false)}
        onClick={() => setAberto((valor) => !valor)}
        className="flex h-5 w-5 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-amber-400 focus:outline-none"
      >
        <Info className="h-3.5 w-3.5" />
      </button>

      {aberto && (
        <div role="tooltip" className="absolute right-0 top-7 z-25 w-56 rounded-xl border border-zinc-700 bg-zinc-800 p-3 text-xs leading-relaxed text-zinc-300 shadow-xl">
          <div className="absolute -top-1 right-1.5 h-2 w-2 rotate-45 border-l border-t border-zinc-700 bg-zinc-800" />
          {texto}
        </div>
      )}
    </div>
  );
}

type EsquemaCor = "verde" | "verdeAgua" | "vermelho" | "ambar";
const ESQUEMAS_CORES: Record<EsquemaCor, { bgIcone: string; textoIcone: string }> = {
  verde: { bgIcone: "bg-emerald-950/60", textoIcone: "text-emerald-400" },
  verdeAgua: { bgIcone: "bg-teal-950/60", textoIcone: "text-teal-400" },
  vermelho: { bgIcone: "bg-rose-950/60", textoIcone: "text-rose-400" },
  ambar: { bgIcone: "bg-amber-950/60", textoIcone: "text-amber-400" },
};

function CardResumo({ titulo, valor, icone, esquemaCor, tooltip, action }: { titulo: string; valor: number; icone: React.ReactNode; esquemaCor: EsquemaCor; tooltip: string; action?: React.ReactNode }) {
  const cores = ESQUEMAS_CORES[esquemaCor];
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-lg transition-all hover:border-zinc-700">
      <div className="flex items-start justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${cores.bgIcone} ${cores.textoIcone}`}>
          {icone}
        </div>
        <div className="flex items-center gap-3">
          {action}
          <InfoTooltip texto={tooltip} />
        </div>
      </div>
      <p className="mt-4 text-sm font-medium text-zinc-400">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-100">{formatarMoeda(valor)}</p>
    </div>
  );
}

function BadgeStatus({ pago }: { pago: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${pago ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/50" : "bg-zinc-800 text-zinc-300 border border-zinc-700"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${pago ? "bg-emerald-400" : "bg-amber-400"}`} />
      {pago ? "Pago / Recebido" : "Pendente"}
    </span>
  );
}

function TooltipGrafico({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm shadow-xl text-zinc-200">
      <p className="font-medium text-amber-300">{item.payload.categoria}</p>
      <p className="text-emerald-400">{formatarMoeda(item.value)}</p>
    </div>
  );
}

interface DashboardProps {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const [resumo, setResumo] = useState<ResumoFinanceiro>({
    contas_bancarias: { saldo_atual_em_conta: 0, saldo_projetado_fim_do_mes: 0 },
    cartao_de_credito: { fatura_atual_pendente: 0, total_fatura: 0 },
    terceiros: { valores_a_serem_reembolsados: 0 },
  });
  const [saidas, setSaidas] = useState<Saida[]>([]);
  const [gastosPorCategoria, setGastosPorCategoria] = useState<GastoPorCategoria[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoriasModalOpen, setIsCategoriasModalOpen] = useState(false);
  const [editando, setEditando] = useState<any>(null);

  const hoje = new Date();
  const [mesSelecionado, setMesSelecionado] = useState(hoje.getMonth());
  const [anoSelecionado, setAnoSelecionado] = useState(hoje.getFullYear());
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>("todas");
  const [statusSelecionado, setStatusSelecionado] = useState<StatusFiltro>("todos");
  const [formaPagamentoSelecionada, setFormaPagamentoSelecionada] = useState<string>("todas"); 

  const [listaCategorias, setListaCategorias] = useState<string[]>([]);

  const carregarDadosReais = async () => {
    try {
      const token = localStorage.getItem("token") || "";
      const headers = { Authorization: `Bearer ${token}` };
      const mesNum = mesSelecionado + 1;

      const [resResumo, resSaidas, resGrafico, resCategorias] = await Promise.all([
        axios.get(`https://fqdj9kncvf.execute-api.us-east-2.amazonaws.com/api/v1/resumo?ano=${anoSelecionado}&mes=${mesNum}`, { headers }).catch(() => ({ data: resumo })),
        axios.get(`https://fqdj9kncvf.execute-api.us-east-2.amazonaws.com/api/v1/saidas?ano=${anoSelecionado}&mes=${mesNum}`, { headers }).catch(() => ({ data: { saidas: [] } })),
        axios.get(`https://fqdj9kncvf.execute-api.us-east-2.amazonaws.com/api/v1/saidas/grafico/categorias?ano=${anoSelecionado}&mes=${mesNum}`, { headers }).catch(() => ({ data: [] })),
        axios.get("https://fqdj9kncvf.execute-api.us-east-2.amazonaws.com/api/v1/categorias", { headers }).catch(() => ({ data: { categorias: [] } })),
      ]);

      setResumo(resResumo.data);
      setSaidas(resSaidas.data.saidas || []);
      setGastosPorCategoria(resGrafico.data || []);
      
      const nomesCats = (resCategorias.data.categorias || []).map((c: any) => c.nome);
      setListaCategorias(nomesCats);
    } catch (error) {
      console.error("Erro ao buscar dados do backend:", error);
    }
  };

  useEffect(() => {
    carregarDadosReais();
  }, [mesSelecionado, anoSelecionado]);

  const categoriasDisponiveis = useMemo(() => {
    return listaCategorias;
  }, [listaCategorias]);

  const saidasFiltradas = useMemo(() => {
    return saidas.filter((saida) => {
      const combinaCategoria = categoriaSelecionada === "todas" || saida.categoria === categoriaSelecionada;
      
      const combinaStatus =
        statusSelecionado === "todos" ||
        (statusSelecionado === "pago" && saida.pago) ||
        (statusSelecionado === "pendente" && !saida.pago) ||
        (statusSelecionado === "reembolsavel" && saida.is_reembolsavel);
        
      const combinaForma = 
        formaPagamentoSelecionada === "todas" || 
        (saida.forma_pagamento && saida.forma_pagamento.toUpperCase() === formaPagamentoSelecionada.toUpperCase());
        
      return combinaCategoria && combinaStatus && combinaForma;
    });
  }, [saidas, categoriaSelecionada, statusSelecionado, formaPagamentoSelecionada]);

  const totalDespesasFiltradas = useMemo(
    () => saidasFiltradas.reduce((soma, saida) => {
      return saida.tipo_saida !== "ENTRADA" ? soma + saida.valor : soma;
    }, 0),
    [saidasFiltradas]
  );

  const totalReceitasFiltradas = useMemo(
    () => saidasFiltradas.reduce((soma, saida) => {
      return saida.tipo_saida === "ENTRADA" ? soma + saida.valor : soma;
    }, 0),
    [saidasFiltradas]
  );

  const handleSalvar = async (dados: any) => {
    try {
      const token = localStorage.getItem("token") || "";
      const headers = { Authorization: `Bearer ${token}` };

      if (editando) {
        await axios.put(`https://fqdj9kncvf.execute-api.us-east-2.amazonaws.com/api/v1/saidas/${editando.id}`, dados, { headers });
      } else {
        await axios.post("https://fqdj9kncvf.execute-api.us-east-2.amazonaws.com/api/v1/saidas", {
          ...dados,
          data_vencimento: dados.data_vencimento || new Date().toISOString().split('T')[0]
        }, { headers });
      }
      setIsModalOpen(false);
      setEditando(null);
      carregarDadosReais();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Erro ao salvar lançamento.");
    }
  };

  const handleDeletar = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este lançamento?")) {
      try {
        const token = localStorage.getItem("token") || "";
        await axios.delete(`https://fqdj9kncvf.execute-api.us-east-2.amazonaws.com/api/v1/saidas/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        carregarDadosReais();
      } catch (error) {
        console.error("Erro ao deletar:", error);
        alert("Erro ao excluir lançamento.");
      }
    }
  };

  const handlePagarFatura = async () => {
    if (confirm(`Tem certeza que deseja pagar a fatura de ${MESES[mesSelecionado]}? Isso vai dar baixa em todos os gastos de crédito pendentes neste mês.`)) {
      try {
        const token = localStorage.getItem("token") || "";
        const mesNum = mesSelecionado + 1;
        
        await axios.post(`https://fqdj9kncvf.execute-api.us-east-2.amazonaws.com/api/v1/saidas/pagar-fatura?ano=${anoSelecionado}&mes=${mesNum}`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        carregarDadosReais();
      } catch (error) {
        console.error("Erro ao pagar fatura:", error);
        alert("Erro ao pagar fatura.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Visão geral financeira</h1>
            <p className="mt-1 text-sm text-amber-400/90 font-medium">{MESES[mesSelecionado]} de {anoSelecionado}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsCategoriasModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-300 shadow-sm transition-colors hover:bg-zinc-800 hover:text-amber-400"
            >
              <Tags className="h-4 w-4 text-emerald-400" /> Categorias
            </button>

            <button
              onClick={() => { setEditando(null); setIsModalOpen(true); }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-500"
            >
              <Plus className="h-4 w-4" /> Novo Lançamento
            </button>
            
            <button
              onClick={onLogout}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-300 shadow-sm transition-colors hover:bg-zinc-800 hover:text-rose-400"
              title="Sair da conta"
            >
              <LogOut className="h-4 w-4 text-zinc-400" /> Sair
            </button>
          </div>
        </header>

        {/* CARDS DE RESUMO */}
        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CardResumo titulo="Saldo atual" valor={resumo.contas_bancarias.saldo_atual_em_conta} icone={<Banknote className="h-5 w-5" />} esquemaCor="verde" tooltip="Saldo disponível em conta hoje (Entradas recebidas - Gastos e Faturas pagas)." />
          <CardResumo titulo="Saldo projetado" valor={resumo.contas_bancarias.saldo_projetado_fim_do_mes} icone={<PiggyBank className="h-5 w-5" />} esquemaCor="verdeAgua" tooltip="O que vai sobrar livre na conta ao fim do mês, após quitar a fatura e receber o que falta." />
          
          <CardResumo 
            titulo="Fatura do mês" 
            valor={resumo.cartao_de_credito.total_fatura} 
            icone={<CreditCard className="h-5 w-5" />} 
            esquemaCor="vermelho" 
            tooltip={`Total de gastos no crédito. Pendente para pagar: ${formatarMoeda(resumo.cartao_de_credito.fatura_atual_pendente)}`} 
            action={
              resumo.cartao_de_credito.fatura_atual_pendente > 0 ? (
                <button 
                  onClick={handlePagarFatura} 
                  className="rounded border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold tracking-wide text-rose-400 transition-colors hover:bg-rose-500/20"
                >
                  PAGAR FATURA
                </button>
              ) : resumo.cartao_de_credito.total_fatura > 0 ? (
                <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold tracking-wide text-emerald-400">
                  PAGA
                </span>
              ) : null
            }
          />
          
          <CardResumo titulo="A receber" valor={resumo.terceiros.valores_a_serem_reembolsados} icone={<Undo2 className="h-5 w-5" />} esquemaCor="ambar" tooltip="Valores marcados como reembolsáveis no mês." />
        </section>

        {/* GRÁFICO + FILTROS */}
        <section className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-10">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-lg lg:col-span-7">
            <h2 className="mb-4 text-sm font-semibold text-zinc-200">Gastos por categoria</h2>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gastosPorCategoria} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#27272a" />
                  <XAxis dataKey="categoria" tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={{ stroke: "#3f3f46" }} tickLine={false} />
                  <YAxis tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
                  <RechartsTooltip content={<TooltipGrafico />} cursor={{ fill: "#18181b" }} />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {gastosPorCategoria.map((_, index) => (
                      <Cell key={index} fill={CORES_GRAFICO[index % CORES_GRAFICO.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-lg lg:col-span-3">
            <div className="mb-4 flex items-center gap-2">
              <Filter className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-zinc-200">Filtros</h2>
            </div>
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Período</label>
                <div className="flex gap-2">
                  <select value={mesSelecionado} onChange={(e) => setMesSelecionado(Number(e.target.value))} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500 outline-none">
                    {MESES.map((mes, idx) => <option key={mes} value={idx}>{mes}</option>)}
                  </select>
                  <select value={anoSelecionado} onChange={(e) => setAnoSelecionado(Number(e.target.value))} className="w-28 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500 outline-none">
                    {[anoSelecionado - 1, anoSelecionado, anoSelecionado + 1].map((ano) => <option key={ano} value={ano}>{ano}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Categoria</label>
                <select value={categoriaSelecionada} onChange={(e) => setCategoriaSelecionada(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500 outline-none">
                  <option value="todas">Todas as categorias</option>
                  {categoriasDisponiveis.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Tipo de Gasto</label>
                <select 
                  value={formaPagamentoSelecionada} 
                  onChange={(e) => setFormaPagamentoSelecionada(e.target.value)} 
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500 outline-none"
                >
                  <option value="todas">Todos os tipos</option>
                  <option value="CREDITO">Cartão de Crédito</option>
                  <option value="DEBITO">Cartão de Débito</option>
                  <option value="PIX">PIX</option>
                  <option value="DINHEIRO">Dinheiro</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Status</label>
                <div className="flex flex-col gap-2">
                  {(["todos", "pago", "pendente", "reembolsavel"] as StatusFiltro[]).map((status) => (
                    <label key={status} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                      <input 
                        type="radio" 
                        name="status" 
                        value={status} 
                        checked={statusSelecionado === status} 
                        onChange={() => setStatusSelecionado(status)} 
                        className="h-3.5 w-3.5 accent-emerald-500" 
                      />
                      {status === "reembolsavel" ? "A receber" : status.charAt(0).toUpperCase() + status.slice(1)}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* LISTA DE LANÇAMENTOS */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 shadow-lg">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-200">Lançamentos do mês</h2>
            
            <div className="flex gap-4 text-sm text-zinc-400">
               <p>Receitas: <span className="font-semibold text-emerald-400">{formatarMoeda(totalReceitasFiltradas)}</span></p>
               <p>Despesas: <span className="font-semibold text-rose-400">{formatarMoeda(totalDespesasFiltradas)}</span></p>
            </div>
          </div>
          <div className="hidden grid-cols-12 gap-4 px-5 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 sm:grid">
            <span className="col-span-3">Descrição</span>
            <span className="col-span-3">Categoria</span>
            <span className="col-span-2">Vencimento</span>
            <span className="col-span-2 text-right">Valor</span>
            <span className="col-span-1 text-center">Status</span>
            <span className="col-span-1 text-right">Ações</span>
          </div>
          <ul className="divide-y divide-zinc-800/60">
            {saidasFiltradas.map((saida) => {
              const isEntrada = saida.tipo_saida === "ENTRADA";
              return (
                <li key={saida.id} className="grid grid-cols-2 items-center gap-2 px-5 py-4 sm:grid-cols-12 sm:gap-4 hover:bg-zinc-800/30 transition-colors">
                  <span className="col-span-2 text-sm font-medium text-zinc-200 sm:col-span-3 flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${isEntrada ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                    {saida.descricao}
                  </span>
                  <span className="col-span-1 text-sm text-zinc-400 sm:col-span-3">
                    <span className="inline-flex rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300 border border-zinc-700">{saida.categoria}</span>
                  </span>
                  <span className="col-span-1 text-sm text-zinc-400 sm:col-span-2">{formatarData(saida.data_vencimento)}</span>
                  
                  <span className={`col-span-1 text-right text-sm font-semibold sm:col-span-2 ${isEntrada ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isEntrada ? `+ ${formatarMoeda(saida.valor)}` : `- ${formatarMoeda(saida.valor)}`}
                  </span>

                  <span className="col-span-1 flex justify-center sm:col-span-1"><BadgeStatus pago={saida.pago} /></span>
                  <span className="col-span-2 flex items-center justify-end gap-2 sm:col-span-1">
                    <button onClick={() => { setEditando(saida); setIsModalOpen(true); }} className="p-1 text-zinc-400 hover:text-amber-300 transition-colors" title="Editar"><Edit2 className="h-4 w-4" /></button>
                    <button onClick={() => handleDeletar(saida.id)} className="p-1 text-zinc-400 hover:text-rose-400 transition-colors" title="Excluir"><Trash2 className="h-4 w-4" /></button>
                  </span>
                </li>
              );
            })}
            {saidasFiltradas.length === 0 && (
              <li className="px-5 py-10 text-center text-sm text-zinc-500">Nenhum lançamento encontrado.</li>
            )}
          </ul>
        </section>
      </div>

      <DespesaModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditando(null); }} onSave={handleSalvar} despesaParaEditar={editando} />
      <CategoriasModal isOpen={isCategoriasModalOpen} onClose={() => setIsCategoriasModalOpen(false)} />
    </div>
  );
}