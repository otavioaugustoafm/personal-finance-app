import { useState } from "react";
import axios from "axios";

interface CadastroProps {
  onCadastroSuccess: () => void;
  irParaLogin: () => void;
}

export default function Cadastro({ onCadastroSuccess, irParaLogin }: CadastroProps) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setCarregando(true);

    try {
      // Cria a conta no FastAPI
      await axios.post("http://127.0.0.1:8000/api/v1/usuarios", {
        nome,
        email,
        senha,
      });

      // Logo após cadastrar, faz o login automático para pegar o token
      const respostaLogin = await axios.post("http://127.0.0.1:8000/api/v1/auth/login", {
        email,
        senha,
      });

      localStorage.setItem("token", respostaLogin.data.token);
      onCadastroSuccess();
    } catch (err: any) {
      console.error("Erro no cadastro:", err);
      if (err.response?.status === 409) {
        setErro("Já existe uma conta cadastrada com este e-mail.");
      } else {
        setErro("Erro ao criar conta. Verifique os dados (senha precisa ser forte).");
      }
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-slate-800 mb-2">Criar sua conta</h1>
        <p className="text-sm text-slate-500 mb-6">Preencha os dados abaixo para começar a usar o painel.</p>

        {erro && (
          <div className="mb-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-600 border border-rose-100">
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Nome completo</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="João Silva"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              required
            />
          </div>

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
            {carregando ? "Cadastrando..." : "Cadastrar conta"}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-500">
          Já tem uma conta?{" "}
          <button onClick={irParaLogin} className="font-medium text-teal-600 hover:underline">
            Faça login aqui
          </button>
        </div>
      </div>
    </div>
  );
}