import { useState } from "react";
import { api } from "../lib/api";
import { salvarToken } from "../lib/auth";

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const resposta = await api.post("/api/v1/auth/login", { senha });
      salvarToken(resposta.data.token);
      onLoginSuccess();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      setErro(status === 401 ? "Senha incorreta." : "Nao foi possivel conectar ao servidor.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
        <h1 className="mb-1 text-xl font-semibold tracking-tight text-zinc-100">Controle Financeiro</h1>
        <p className="mb-6 text-sm text-zinc-400">Informe a senha de acesso.</p>

        {erro && (
          <div className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha"
            autoFocus
            required
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
