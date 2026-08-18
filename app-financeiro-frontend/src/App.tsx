import { useState } from "react";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import Investimentos from "./components/Investimentos";
import Cadastro from "./components/Cadastro";

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [rotaAtual, setRotaAtual] = useState<"login" | "cadastro">("login");
  
  // NOVO: Estado para controlar as abas apenas para quem está logado
  const [abaAtiva, setAbaAtiva] = useState<"dashboard" | "investimentos">("dashboard");

  const handleLogout = () => {
    localStorage.removeItem("token"); // Remove o token
    setToken(null); // Reseta o estado para voltar ao login
  };

  // ÁREA DO USUÁRIO LOGADO (Aqui entra o Menu + Telas)
  if (token) {
    return (
      <div className="min-h-screen bg-zinc-950">
        
        {/* NAVEGAÇÃO SUPERIOR */}
        <nav className="border-b border-zinc-800 bg-zinc-900 px-4 py-3 sm:px-6 lg:px-10">
          <div className="mx-auto flex max-w-7xl items-center gap-4">
            <button 
              onClick={() => setAbaAtiva("dashboard")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                abaAtiva === "dashboard" 
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              Fluxo de Caixa
            </button>

            <button 
              onClick={() => setAbaAtiva("investimentos")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                abaAtiva === "investimentos" 
                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" 
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              Carteira de Ativos
            </button>
          </div>
        </nav>

        {/* EXIBE A TELA SELECIONADA */}
        <main>
          {abaAtiva === "dashboard" ? (
            <Dashboard onLogout={handleLogout} /> 
          ) : (
            <Investimentos />
          )}
        </main>
      </div>
    );
  }

  // ÁREA DE VISITANTES (Cadastro)
  if (rotaAtual === "cadastro") {
    return (
      <Cadastro
        onCadastroSuccess={() => setToken(localStorage.getItem("token"))}
        irParaLogin={() => setRotaAtual("login")}
      />
    );
  }

  // ÁREA DE VISITANTES (Login)
  return (
    <Login
      onLoginSuccess={() => setToken(localStorage.getItem("token"))}
      irParaCadastro={() => setRotaAtual("cadastro")}
    />
  );
}