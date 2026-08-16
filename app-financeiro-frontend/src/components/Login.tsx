import { useState } from "react";
import axios from "axios";

interface LoginProps {
  onLoginSuccess: () => void;
  irParaCadastro: () => void;
}

export default function Login({ onLoginSuccess, irParaCadastro }: LoginProps) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setCarregando(true);

    try {
      const resposta = await axios.post("http://127.0.0.1:8000/api/v1/auth/login", {
        email,
        senha,
      });

      const token = resposta.data.token;
      localStorage.setItem("token", token);

      onLoginSuccess();
    } catch (err: any) {
      console.error("Erro no login:", err);
      setErro("E-mail ou senha incorretos.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-slate-800 mb-2">Entrar na sua conta</h1>
        <p className="text-sm text-slate-500 mb-6">Digite suas credenciais para acessar o painel financeiro.</p>

        {erro && (
          <div className="mb-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-600 border border-rose-100">
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@email.com"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-xl bg-teal-600 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-700 disabled:opacity-50"
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>

        {/* Rodapé integrado dentro do container corretamente */}
        <div className="mt-6 text-center text-xs text-slate-500">
          Ainda não tem uma conta?{" "}
          <button onClick={irParaCadastro} className="font-medium text-teal-600 hover:underline">
            Cadastre-se
          </button>
        </div>
      </div>
    </div>
  );
}