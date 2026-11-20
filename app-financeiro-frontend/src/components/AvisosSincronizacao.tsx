import { Info, TriangleAlert } from "lucide-react";
import { dataHora } from "../lib/format";
import type { StatusSincronizacao } from "../lib/types";

interface Props {
  status: StatusSincronizacao;
  desatualizado: boolean;
}

function Faixa({ tipo, children }: { tipo: "erro" | "aviso" | "info"; children: React.ReactNode }) {
  const estilos = {
    erro: "border-saida/30 bg-saida/10 text-saida",
    aviso: "border-aviso/30 bg-aviso/10 text-aviso",
    info: "border-borda bg-painel text-suave",
  }[tipo];
  const Icone = tipo === "info" ? Info : TriangleAlert;
  return (
    <div className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm leading-snug ${estilos}`}>
      <Icone className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

export default function AvisosSincronizacao({ status, desatualizado }: Props) {
  const { ultima, conexoes } = status;
  const faixas: React.ReactNode[] = [];

  if (!ultima) {
    faixas.push(
      <Faixa key="nunca" tipo="info">
        Ainda não houve nenhuma sincronização com o banco. Rode <code className="rounded bg-painel-2 px-1">python -m src.sync</code> no backend.
      </Faixa>,
    );
  } else {
    if (ultima.status === "ERRO" || ultima.status === "PARCIAL") {
      faixas.push(
        <Faixa key="erro" tipo={ultima.status === "ERRO" ? "erro" : "aviso"}>
          A última sincronização {ultima.status === "ERRO" ? "falhou" : "terminou com problemas"}: {ultima.erro ?? "veja os logs"}
        </Faixa>,
      );
    }
    if (desatualizado && ultima.status !== "ERRO") {
      faixas.push(
        <Faixa key="velho" tipo="aviso">
          Os dados estão desatualizados: a última sincronização terminou em {ultima.finalizada_em ? dataHora(ultima.finalizada_em) : "—"}.
        </Faixa>,
      );
    }
    ultima.avisos.forEach((aviso, i) =>
      faixas.push(
        <Faixa key={`aviso-${i}`} tipo="aviso">
          {aviso}
        </Faixa>,
      ),
    );
  }

  conexoes.forEach((c, i) => {
    if (c.dias_para_expirar !== null && c.dias_para_expirar <= 30 && !ultima?.avisos.some((a) => a.includes("expira"))) {
      faixas.push(
        <Faixa key={`consent-${i}`} tipo="aviso">
          {c.dias_para_expirar < 0
            ? "A autorização do Meu Pluggy expirou. Refaça a conexão no dashboard da Pluggy (Demo → Connect Account → MeuPluggy)."
            : `A autorização do Meu Pluggy expira em ${c.dias_para_expirar} dia(s). Renove antes para não perder a sincronização.`}
        </Faixa>,
      );
    }
  });

  if (faixas.length === 0) return null;
  return <div className="space-y-2">{faixas}</div>;
}
