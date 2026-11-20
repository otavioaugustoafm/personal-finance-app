import { useState } from "react";
import { LockKeyhole } from "lucide-react";
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
      setErro(status === 401 ? "Senha incorreta. Tente de novo." : "Não foi possível falar com o servidor. Verifique sua conexão.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="pt-seguro flex min-h-dvh flex-col justify-end bg-fundo px-5 pb-10 sm:items-center sm:justify-center sm:pb-0">
      <div className="w-full sm:max-w-sm">
        <div className="mb-8">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-latao text-latao-tinta">
            <LockKeyhole className="h-6 w-6" strokeWidth={2.2} />
          </div>
          <h1 className="font-display text-4xl font-semibold leading-none tracking-tight text-texto">Suas finanças</h1>
          <p className="mt-3 text-base text-suave">Digite a senha para ver o painel desta semana.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label htmlFor="senha" className="sr-only">Senha</label>
          <input
            id="senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha"
            autoFocus
            autoComplete="current-password"
            required
            aria-invalid={!!erro}
            className="campo py-3.5! text-base!"
          />
          {erro && (
            <p role="alert" className="text-sm text-saida">
              {erro}
            </p>
          )}
          <button type="submit" disabled={carregando} className="botao-acao w-full py-3.5! text-base!">
            {carregando ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
