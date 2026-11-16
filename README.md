# Controle Financeiro (Open Finance / Santander)

Dashboard de página única para acompanhar saldo, cartão, débito e PIX da conta Santander,
via **Meu Pluggy** (plano pessoal gratuito), com categorias criadas por você. Uso pessoal, usuário único.

| Camada | Tecnologia |
|---|---|
| Front | React + Vite + TailwindCSS (AWS Amplify) |
| Back | Python + FastAPI + Mangum (AWS Lambda + API Gateway) |
| Banco | PostgreSQL serverless no Neon |

## Roadmap

- [x] **Fase 1** — base limpa, esquema novo, login por senha única (renovado toda segunda-feira)
- [x] **Fase 2** — integração Pluggy, sincronização diária, endpoints de transações
- [x] **Fase 3** — dashboard de página única
- [x] **Fase 4** — deploy (Amplify + Lambda em zip + API Gateway + EventBridge): veja o `GUIA_DE_DEPLOY.md`

## Colocando no ar

O passo a passo completo (GitHub, Neon, Lambda, API Gateway, agendamento e Amplify) está em **[GUIA_DE_DEPLOY.md](GUIA_DE_DEPLOY.md)**.

## Rodando localmente

### 1. Banco (Neon)

1. No Neon, crie uma **branch de backup** do banco atual (o script abaixo apaga as tabelas antigas).
2. Rode a migração:
   ```bash
   psql "$DATABASE_URL" -f app-financeiro-backend/migrations/001_schema_open_finance.sql
   psql "$DATABASE_URL" -f app-financeiro-backend/migrations/002_ajustes_sincronizacao.sql
   psql "$DATABASE_URL" -f app-financeiro-backend/migrations/003_edicao_e_faturas.sql
   ```
   (Sem `psql`: cole o conteúdo de cada arquivo, na ordem, no **SQL Editor** do Neon.
   Se você já rodou o 001 e o 002, rode só o 003.)

### 2. Backend

```bash
cd app-financeiro-backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python scripts/gerar_credenciais.py                 # gera APP_PASSWORD_HASH e JWT_SECRET_KEY
# preencha DATABASE_URL, APP_PASSWORD_HASH e JWT_SECRET_KEY no .env
uvicorn src.main:app --reload                       # http://localhost:8000/docs
```

### 3. Frontend

```bash
cd app-financeiro-frontend
npm install
cp .env.example .env.local                          # VITE_API_URL=http://localhost:8000
npm run dev                                         # http://localhost:5173
```

## Conectando o Santander (Meu Pluggy, gratuito)

1. Em [meu.pluggy.ai](https://meu.pluggy.ai), crie a conta e conecte o Santander (cada banco é autorizado separadamente).
2. Em [dashboard.pluggy.ai](https://dashboard.pluggy.ai), entre **com a mesma conta**, crie uma aplicação e, em
   **Applications → sua aplicação → Demo → Connect Account**, escolha **MeuPluggy** (não o banco!).
3. Na mesma tela Demo, clique no item em **Connected Items** e copie o **itemId**. Copie também o **Client ID** e gere o
   **Client Secret** (ele só aparece uma vez).
4. Preencha no `.env` do backend: `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET` e `PLUGGY_ITEM_IDS`.
5. Rode a primeira sincronização (traz até 12 meses):
   ```bash
   cd app-financeiro-backend
   python -m src.sync
   ```

**Renovação anual:** a autorização do Meu Pluggy vale 1 ano. Antes disso a sincronização avisa (veja `GET /api/v1/sincronizacao/status`);
depois, ela falha com a mensagem para refazer o passo 2. Ao renovar, confira se o `itemId` mudou.

### Como a sincronização protege o que você fez

- Sincronizar nunca altera a categoria nem o "ignorar no fluxo" de uma transação já existente.
- O Pluggy pode trocar o id de uma transação (comum no cartão perto do fechamento da fatura). Nesse caso a nova herda a categoria
  da antiga se data, valor e descrição forem iguais.
- Transação que some do banco fica oculta (`sumiu_em`) em vez de apagada; se voltar, volta com a categoria.
- Se o Pluggy devolver zero transações para uma conta que já tinha dados, nada é alterado e a execução registra um aviso.
- Pagamento de fatura é marcado como "fora do fluxo" para não contar em dobro com as compras do cartão. Você pode desfazer via `PATCH`.

## O dashboard (página única)

- **Cards:** saldo em conta, **próxima fatura** do cartão (valor e vencimento informados pelo banco), entradas e saídas do mês.
  O "limite usado" aparece à parte: nas conexões Open Finance o banco informa o limite utilizado (que inclui parcelas
  futuras), e isso **não é** a fatura.
- **Mês:** setas no topo trocam o mês; tudo (cards, gráfico e lista) acompanha.
- **Filtros** (acima do gráfico e da lista): busca na descrição, entradas/saídas, forma (PIX, Débito, Crédito, Outro — pode combinar),
  e categorias (várias de uma vez, incluindo "Sem categoria"). "Limpar filtros" zera tudo. Os filtros permanecem ao trocar de mês.
- **Gráfico de barras por categoria** (saídas ou entradas): respeita os filtros; clique numa barra, ou na legenda, para filtrar a lista.
- **Editar transação** (lápis): descrição, valor, data, tipo, forma, categoria, parcelas e "fora do fluxo". O que você editar **não é
  desfeito pela sincronização diária**; campos que você não mexer continuam acompanhando o banco. A tela mostra o que o banco informou
  e há "Restaurar valores do banco".
- **Lista de transações:** escolha a categoria no próprio item (salva na hora). Marque várias e use "Aplicar" para categorizar em lote.
- **Fora do fluxo (olho):** tira a transação dos totais, como pagamento de fatura. Dá para desfazer.
- **Avisos:** sincronização com erro ou desatualizada (+36h) e autorização do Meu Pluggy perto de expirar.
- **Categorias:** botão no topo, agora com cor (a cor aparece no gráfico e na lista).

## Como funciona o login

Não há usuários: existe uma única senha de acesso, guardada como hash bcrypt em `APP_PASSWORD_HASH`.
`POST /api/v1/auth/login` devolve um JWT que **expira na próxima segunda-feira às 00:00 (Brasília)**,
então você só digita a senha uma vez por semana. Quem acessar o domínio sem o token não lê nada.

## API

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/v1/auth/login` | `{ "senha": "..." }` → `{ token, expira_em }` |
| GET | `/api/v1/contas` | contas, saldo, limites do cartão e `proximas_faturas` (as 2 próximas a vencer) |
| GET | `/api/v1/transacoes` | filtros: `de`, `ate`, `direcao`, `categoria_id`, `sem_categoria`, `incluir_ignoradas`, `limite`, `deslocamento`; devolve também `totais` |
| POST | `/api/v1/transacoes/categorizar-em-lote` | `{ "ids": [uuid, ...], "categoria_id": uuid\|null }` (até 500) |
| PATCH | `/api/v1/transacoes/{id}` | edita qualquer campo (só o que for enviado muda): `descricao`, `data`, `valor`, `direcao`, `metodo`, `parcela_atual`, `total_parcelas`, `categoria_id`, `ignorar_no_fluxo` |
| POST | `/api/v1/transacoes/{id}/restaurar` | volta descrição, data, valor, tipo, forma e parcelas ao que o banco informou |
| GET | `/api/v1/sincronizacao/status` | última sincronização e validade da autorização do Meu Pluggy |
| GET/POST | `/api/v1/categorias` | lista / cria (`nome`, `tipo` = ENTRADA\|SAIDA, `cor` opcional) |
| PUT/DELETE | `/api/v1/categorias/{id}` | renomeia / exclui (transações ficam sem categoria) |

## Testes

```bash
cd app-financeiro-backend
pip install -r requirements-dev.txt
pytest                                    # normalização e cliente do Pluggy (sem banco)
TEST_DATABASE_URL=... pytest              # inclui os testes de banco
```

Os testes de banco **apagam todas as tabelas** do banco indicado em `TEST_DATABASE_URL`: use uma branch descartável do Neon, nunca a real.

## Fatura diferente do app do banco?

Rode `python -m src.diagnostico` (no backend, com o `.env` preenchido). Ele mostra o que o Pluggy devolve para o cartão (limite, faturas e
um resumo das compras recentes) **sem nomes, CPF nem número de cartão**, e serve para entender qualquer diferença.

## Segurança

- Nenhum segredo no repositório: `.env` está no `.gitignore`; em produção use variáveis da Lambda.
- O app **não inicia** sem `DATABASE_URL`, `JWT_SECRET_KEY` (≥ 32 caracteres) e `APP_PASSWORD_HASH`.
- CORS restrito a `ALLOWED_ORIGINS`.
- Credenciais do Pluggy (`PLUGGY_CLIENT_ID`/`PLUGGY_CLIENT_SECRET`) só em variáveis de ambiente; nunca no repositório.
