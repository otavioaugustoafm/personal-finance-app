const CHAVE = "token";

export function salvarToken(token: string) {
  localStorage.setItem(CHAVE, token);
}

export function limparToken() {
  localStorage.removeItem(CHAVE);
}

export function obterToken(): string | null {
  return localStorage.getItem(CHAVE);
}

/** Le o "exp" do JWT so para decidir se mostra a tela de login (quem valida de verdade e o backend). */
export function tokenValido(token: string | null): boolean {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}
