import { useEffect, useState } from "react";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import { SESSAO_EXPIRADA } from "./lib/api";
import { limparToken, obterToken, tokenValido } from "./lib/auth";

export default function App() {
  const [logado, setLogado] = useState(() => tokenValido(obterToken()));

  useEffect(() => {
    const aoExpirar = () => setLogado(false);
    window.addEventListener(SESSAO_EXPIRADA, aoExpirar);
    return () => window.removeEventListener(SESSAO_EXPIRADA, aoExpirar);
  }, []);

  const sair = () => {
    limparToken();
    setLogado(false);
  };

  return logado ? <Dashboard onLogout={sair} /> : <Login onLoginSuccess={() => setLogado(true)} />;
}
