import { useState } from "react";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import Cadastro from "./components/Cadastro";

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [rotaAtual, setRotaAtual] = useState<"login" | "cadastro">("login");

  const handleLogout = () => {
    localStorage.removeItem("token"); // Remove o token
    setToken(null); // Reseta o estado para voltar ao login
  };

  if (token) {
    return <Dashboard onLogout={handleLogout} />; // <-- O onLogout tem que estar aqui!
  }

  if (rotaAtual === "cadastro") {
    return (
      <Cadastro
        onCadastroSuccess={() => setToken(localStorage.getItem("token"))}
        irParaLogin={() => setRotaAtual("login")}
      />
    );
  }

  return (
    <Login
      onLoginSuccess={() => setToken(localStorage.getItem("token"))}
      irParaCadastro={() => setRotaAtual("cadastro")}
    />
  );
}