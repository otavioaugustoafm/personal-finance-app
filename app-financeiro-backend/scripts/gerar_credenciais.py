"""Gera o hash bcrypt da senha de acesso e um JWT_SECRET_KEY aleatorio.

Uso: python scripts/gerar_credenciais.py
Copie os dois valores para o .env (local) e para as variaveis da Lambda (producao).
"""
import getpass
import secrets

import bcrypt

senha = getpass.getpass("Escolha a senha de acesso (minimo 12 caracteres): ")
if len(senha) < 12:
    raise SystemExit("Senha curta demais. Use pelo menos 12 caracteres.")
if senha != getpass.getpass("Repita a senha: "):
    raise SystemExit("As senhas nao conferem.")

hash_senha = bcrypt.hashpw(senha.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")
print("\nAPP_PASSWORD_HASH='" + hash_senha + "'")
print("JWT_SECRET_KEY=" + secrets.token_urlsafe(48))
