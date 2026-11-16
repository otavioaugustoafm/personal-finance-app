import axios from "axios";
import { limparToken, obterToken } from "./auth";

export const SESSAO_EXPIRADA = "sessao-expirada";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use((config) => {
  const token = obterToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (resposta) => resposta,
  (erro) => {
    // 401 fora da tela de login = token expirou (ex.: virou a segunda-feira)
    if (erro.response?.status === 401 && !erro.config?.url?.includes("/auth/login")) {
      limparToken();
      window.dispatchEvent(new Event(SESSAO_EXPIRADA));
    }
    return Promise.reject(erro);
  },
);

/** Texto amigavel para erros do backend (o FastAPI manda `detail` como texto ou como lista de problemas). */
export function mensagemDeErro(erro: unknown, padrao = "Não foi possível salvar. Tente novamente."): string {
  // sem resposta nenhuma = nao chegou na API (rede, URL errada ou bloqueio de CORS no navegador)
  if (!(erro as { response?: unknown }).response) {
    return "Sem resposta do servidor. Verifique a conexão, a VITE_API_URL e o ALLOWED_ORIGINS da API.";
  }
  const detalhe = (erro as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
  if (typeof detalhe === "string") return detalhe;
  if (Array.isArray(detalhe)) {
    const msgs = detalhe.map((d) => (d as { msg?: string }).msg).filter(Boolean);
    if (msgs.length) return msgs.join(" ");
  }
  return padrao;
}
