# Guia de deploy — do zero até o painel no ar

Comandos em **PowerShell (Windows)**. No Mac/Linux troque `py` por `python3` e `.venv\Scripts\Activate.ps1` por
`source .venv/bin/activate`.

Ordem geral: **computador → GitHub → Neon → credenciais → (teste local) → zip → Lambda da API → API Gateway →
Lambda de sincronização → agendamento → Amplify → ligar as pontas**.

> Dica: use **a mesma região da AWS** em tudo (canto superior direito do console). Se o Neon está em Ohio, use
> `us-east-2`.

---

## 0. O que você precisa ter

| Item | Como conferir |
|---|---|
| Python 3.12 (ou mais novo) | `py --version` |
| Node 22 (ou 20.19+) | `node --version` |
| Git | `git --version` |
| Contas: GitHub, AWS, Neon, Meu Pluggy | — |

---

## 1. Colocar o projeto no computador e no GitHub

Use um **repositório novo** e, mais adiante, um **app novo no Amplify**. Assim o seu app antigo continua funcionando
até você decidir trocar.

1. Extraia o zip numa pasta nova (ex.: `C:\projetos`). Vai nascer a pasta `personal-finance-app`.
2. No GitHub, crie um repositório **privado e vazio** (sem README, sem .gitignore).
3. No PowerShell:

```powershell
cd C:\projetos\personal-finance-app
git init
git add .
git status
```

   Confira a lista: **não pode** aparecer `.env`, `.venv`, `node_modules`, `dist` nem `lambda.zip`. (O `.gitignore` já
   cuida disso; esta conferência é só para você ter certeza.)

```powershell
git commit -m "Controle financeiro v2"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/NOME_DO_REPO.git
git push -u origin main
```

---

## 2. Banco de dados (Neon)

1. No projeto novo do Neon, abra o **SQL Editor**.
2. Cole e execute `app-financeiro-backend/migrations/001_schema_open_finance.sql`.
3. Cole e execute `app-financeiro-backend/migrations/002_ajustes_sincronizacao.sql`. (Sempre nessa ordem.)
4. Cole e execute `app-financeiro-backend/migrations/003_edicao_e_faturas.sql`.
5. Cole e execute `app-financeiro-backend/migrations/004_previsoes.sql`.
6. Clique em **Connect** e copie a string de conexão **com "Connection pooling" ligado** (o host contém `-pooler`).
   Essa é a `DATABASE_URL`.

---

## 3. Credenciais

### 3.1 Senha de acesso e segredo do login

```powershell
cd app-financeiro-backend
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python scripts\gerar_credenciais.py
```

O script pede a senha de acesso (mínimo 12 caracteres) e imprime `APP_PASSWORD_HASH=...` e `JWT_SECRET_KEY=...`.
Abra o `.env` e cole as duas linhas (mantenha as aspas simples do hash **no .env**) e a `DATABASE_URL`.

### 3.2 Meu Pluggy (só os três valores do Pluggy; o Santander é conectado lá)

1. Em <https://meu.pluggy.ai>, crie a conta e conecte o Santander.
2. Em <https://dashboard.pluggy.ai>, entre com a **mesma conta** e crie uma aplicação.
3. Em **Applications → sua aplicação → Demo → Connect Account**, escolha **MeuPluggy** (não o banco).
4. Em **Connected Items**, copie o **itemId**. Copie também o **Client ID** e gere o **Client Secret** (só aparece
   uma vez).
5. Preencha no `.env`: `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`, `PLUGGY_ITEM_IDS`.

---

## 4. Teste local (recomendado, leva poucos minutos)

Achar um erro aqui é bem mais fácil do que achar na AWS.

```powershell
# ainda em app-financeiro-backend, com a .venv ativa
python -m src.sync
```

Deve imprimir `"status": "OK"` e quantas transações entraram (é a **primeira carga**, até 12 meses). Depois:

```powershell
uvicorn src.main:app --reload
```

Em outro PowerShell:

```powershell
cd app-financeiro-frontend
npm install
copy .env.example .env.local
npm run dev
```

Abra <http://localhost:5173>, entre com a senha e confira o painel.

---

## 5. Gerar o zip da Lambda

```powershell
cd app-financeiro-backend
python scripts\montar_zip_lambda.py
```

Gera `app-financeiro-backend\lambda.zip` (~10 MB). O script baixa as bibliotecas **para Linux**, que é o que a Lambda
usa; por isso não adianta zipar a pasta na mão. Esse **mesmo zip** serve às duas Lambdas.

---

## 6. Lambda da API

Console AWS → **Lambda** → **Create function** → *Author from scratch*:

| Campo | Valor |
|---|---|
| Function name | `financeiro-api` |
| Runtime | Python 3.12 |
| Architecture | **x86_64** |

Depois de criada:

1. Aba **Code** → **Upload from** → **.zip file** → escolha o `lambda.zip` → Save.
2. Ainda em **Code**, em **Runtime settings** → **Edit** → **Handler**: `src.main.handler` → Save.
3. Aba **Configuration** → **General configuration** → Edit: **Memory 512 MB**, **Timeout 30 s**.
4. **Configuration** → **Environment variables** → Edit. Cole os valores **sem aspas**:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | string do Neon (pooled) |
| `JWT_SECRET_KEY` | o valor gerado no passo 3.1 |
| `APP_PASSWORD_HASH` | o hash do passo 3.1 (**sem** as aspas simples) |
| `ALLOWED_ORIGINS` | `http://localhost:5173` (provisório; troca no passo 11) |

---

## 7. API Gateway (a "porta de entrada" pública)

Console → **API Gateway** → **Create API** → **HTTP API** → **Build**:

1. **Add integration** → *Lambda* → selecione `financeiro-api`. Nome da API: `financeiro-api`. Next.
2. **Routes**: Method `ANY`, Resource path `/{proxy+}`, integração `financeiro-api`. Next.
   (Opcional: adicione também `ANY` + `/`, só para o endereço raiz responder `{"status":"ok"}`.)
3. **Stages**: deixe `$default` com **Auto-deploy** ligado. Next → **Create**.
4. Copie a **Invoke URL** (`https://xxxx.execute-api.us-east-2.amazonaws.com`).

**Teste:** abra `<Invoke URL>/api/v1/categorias` no navegador. Deve aparecer
`{"detail":"Acesso nao autenticado."}`. Isso prova que API Gateway → Lambda → FastAPI está funcionando.

> Não ligue CORS no API Gateway. O CORS é feito pelo próprio FastAPI; ligar nos dois duplica os cabeçalhos e o
> navegador recusa.
> Use o stage `$default`. Com um stage nomeado, o caminho ganha um prefixo e as rotas deixam de casar.

---

## 8. Lambda de sincronização

Mesmo caminho do passo 6, com outro nome e outro handler:

| Campo | Valor |
|---|---|
| Function name | `financeiro-sync` |
| Runtime / Architecture | Python 3.12 / **x86_64** |
| Zip | o **mesmo** `lambda.zip` |
| Handler | `src.sync_handler.handler` |
| Memory / Timeout | 512 MB / **10 min (600 s)** |

Variáveis de ambiente (sem aspas):

| Variável | Valor |
|---|---|
| `DATABASE_URL` | string do Neon (pooled) |
| `PLUGGY_CLIENT_ID` | do passo 3.2 |
| `PLUGGY_CLIENT_SECRET` | do passo 3.2 |
| `PLUGGY_ITEM_IDS` | itemId do passo 3.2 (vários: separados por vírgula) |

**Teste:** aba **Test** → evento `{}` → **Test**. O resultado deve conter `"status": "OK"`. Se você já fez a primeira
carga no passo 4, vai mostrar `novas: 0` e algumas `atualizadas`, o que é o esperado (nada duplica).

---

## 9. Agendamento diário (EventBridge Scheduler)

Console → **EventBridge** → **Scheduler** → **Schedules** → **Create schedule**:

1. Nome: `financeiro-sync-diario`.
2. **Recurring schedule** → **Cron-based** → expressão `0 7 * * ? *` (todo dia às 07:00).
   **Time zone**: `America/Sao_Paulo`. **Flexible time window**: Off.
3. **Target**: *AWS Lambda — Invoke* → função `financeiro-sync`. Payload em branco.
4. **Settings**: *Create new role for this schedule*. Retry policy pode ficar no padrão.
5. **Create schedule**.

A sincronização é idempotente: se a AWS repetir a execução depois de uma falha, nada duplica.

---

## 10. Front-end no Amplify

Console → **AWS Amplify** → **Create new app** → **GitHub** → autorize e escolha o repositório e a branch `main`.

1. Marque **My app is a monorepo** e informe o caminho: `app-financeiro-frontend`.
2. O Amplify lê o `amplify.yml` da raiz do repositório (já está pronto, com Node 22).
3. Em **Environment variables**, adicione `VITE_API_URL` = a **Invoke URL** do passo 7, **sem barra no final**.
4. **Save and deploy**. Ao terminar, copie o endereço do app (`https://main.xxxx.amplifyapp.com`).

> Opcional: `VITE_DIA_INICIO_PERIODO` (padrão 27) define em que dia do mês anterior o período do painel começa.
> A `VITE_API_URL` é gravada no site na hora do build. Se mudar depois, faça um novo deploy (Redeploy this version).

---

## 11. Ligar as pontas

Volte na Lambda `financeiro-api` → **Configuration → Environment variables** e troque:

```
ALLOWED_ORIGINS = https://main.xxxx.amplifyapp.com
```

(sem barra no final; para manter o teste local também, separe por vírgula:
`https://main.xxxx.amplifyapp.com,http://localhost:5173`).

Pronto: abra o endereço do Amplify, entre com a senha e use o painel. Para ver dados agora em vez de esperar as 07:00,
rode o **Test** da `financeiro-sync` (passo 8).

---

## 12. Alarme de custo (faça uma vez)

Console → **Billing → Budgets** → crie um orçamento de gasto baixo (ou o modelo "Zero spend budget", se aparecer) com
alerta por e-mail. Para o uso pessoal deste projeto o esperado é ficar dentro das cotas gratuitas, mas confira as
condições da **sua** conta e deixe o alerta ligado.

---

## Quando algo der errado

Onde olhar: Lambda → aba **Monitor** → **View CloudWatch logs** → abra o log mais recente.

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Tela de login: "Não foi possível conectar ao servidor" | `VITE_API_URL` errada, ou CORS | confira a URL (sem barra final) e o `ALLOWED_ORIGINS`; depois, redeploy no Amplify |
| Login: "Senha incorreta" com a senha certa | hash colado com aspas ou cortado | cole o hash **sem aspas** na variável da Lambda |
| `{"message":"Not Found"}` | rota não casou | rota `ANY /{proxy+}` e stage `$default` (passo 7) |
| `Task timed out after 3.00 seconds` | timeout padrão | passos 6.3 e 8 |
| `No module named 'pydantic_core._pydantic_core'` | zip montado fora do script, ou arquitetura errada | refaça o zip com o script e confirme Python 3.12 + x86_64 |
| `RuntimeError: Variavel ... ausente` | variável de ambiente faltando | a mensagem diz qual |
| Erro 500 nas categorias | migrações não rodadas, ou `DATABASE_URL` errada | passo 2 e a variável |
| Aviso "autorização do Meu Pluggy" no painel | a autorização vale 1 ano | refaça o passo 3.2.3; confira se o `itemId` mudou |

---

## Atualizar depois

- **Mudou o banco (arquivo novo em `migrations/`)?** Rode o SQL novo no SQL Editor do Neon **antes** de subir o código novo.
- **Código do backend:** rode `python scripts\montar_zip_lambda.py` e suba o novo zip nas **duas** Lambdas
  (Code → Upload from → .zip).
- **Front-end:** é só `git push`; o Amplify faz o deploy sozinho.
- **Renovação anual** da autorização do Meu Pluggy (passo 3.2).
