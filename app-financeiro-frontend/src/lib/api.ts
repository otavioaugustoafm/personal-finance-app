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
