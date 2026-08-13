# Contrato da API RESTful — Aplicação Financeira

**Versionamento:** todas as rotas ficam sob o prefixo `/api/v1/`.
**Autenticação:** exceto os endpoints de cadastro e login, todas as demais rotas exigem o header:

```
Authorization: Bearer <token_jwt>
```

O `usuario_id` **nunca** é recebido via payload nas rotas autenticadas — ele é extraído do token JWT decodificado pela Lambda (autorizador), evitando que um usuário manipule dados de outro.

**Convenção de resposta de erro** (padrão em todos os endpoints):

```json
{
  "erro": {
    "codigo": "CREDENCIAIS_INVALIDAS",
    "mensagem": "E-mail ou senha incorretos."
  }
}
```

---

## 1. Cadastro de Usuário

### 1.1 Criar nova conta

Cria uma nova conta de usuário na plataforma. Rota pública, utilizada pelo fluxo de "criar conta" antes do primeiro login.

| Campo | Valor |
|---|---|
| **Método** | `POST` |
| **Endpoint** | `/api/v1/usuarios` |
| **Autenticado** | Não |

**Request Payload**
```json
{
  "nome": "João Silva",
  "email": "usuario@email.com",
  "senha": "minhaSenha123"
}
```

> A senha viaja em texto plano no corpo da requisição **apenas porque o transporte é feito via HTTPS/TLS** (obrigatório em produção). O hash (via `passlib`) é gerado exclusivamente no backend, antes da persistência — em nenhum momento a senha em texto plano é armazenada ou logada.

**Response Payload — `201 Created`**
```json
{
  "id": "b7e2c1a4-9988-4a3b-8c2d-1f2e3d4c5b6a",
  "nome": "João Silva",
  "email": "usuario@email.com",
  "data_criacao": "2026-08-13T15:10:00Z"
}
```

> Por regra estrita de segurança, `senha` e `senha_hash` **jamais** aparecem no response — em nenhum cenário, nem mesmo em rotas administrativas futuras.

**Códigos de status**
| Código | Cenário |
|---|---|
| `201 Created` | Conta criada com sucesso (retorna o recurso, incluindo `Location` header apontando para `/api/v1/usuarios/{id}`) |
| `400 Bad Request` | Campo obrigatório ausente, e-mail em formato inválido, ou senha fora da política mínima (ex: menos de 8 caracteres) |
| `409 Conflict` | Já existe um usuário cadastrado com o e-mail informado |

---

## 2. Autenticação

### 2.1 Login

Autentica o usuário e retorna um token JWT para uso nas demais requisições.

| Campo | Valor |
|---|---|
| **Método** | `POST` |
| **Endpoint** | `/api/v1/auth/login` |
| **Autenticado** | Não |

**Request Payload**
```json
{
  "email": "usuario@email.com",
  "senha": "minhaSenha123"
}
```

**Response Payload — `200 OK`**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expira_em": 3600,
  "usuario": {
    "id": "3f2e1a90-4b21-4a6c-9d2a-1e2f3a4b5c6d",
    "nome": "João Silva",
    "email": "usuario@email.com"
  }
}
```

**Códigos de status**
| Código | Cenário |
|---|---|
| `200 OK` | Login efetuado, token gerado |
| `400 Bad Request` | Payload malformado (ex: e-mail ausente) |
| `401 Unauthorized` | E-mail ou senha inválidos |
| `429 Too Many Requests` | Excesso de tentativas (proteção contra brute-force) |

---

## 3. Entradas

### 3.1 Listar entradas do mês

Retorna as entradas (receitas) do usuário autenticado filtradas por mês/ano.

| Campo | Valor |
|---|---|
| **Método** | `GET` |
| **Endpoint** | `/api/v1/entradas?ano=2026&mes=8` |
| **Autenticado** | Sim |

**Query params**
| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `ano` | int | Sim | Ano de referência (ex: `2026`) |
| `mes` | int | Sim | Mês de referência (`1`–`12`) |

**Request Payload:** não se aplica (parâmetros via query string)

**Response Payload — `200 OK`**
```json
{
  "periodo": { "ano": 2026, "mes": 8 },
  "total_confirmado": 5200.00,
  "total_pendente": 350.00,
  "entradas": [
    {
      "id": "9b1d5e2a-1234-4c1a-8f2e-abcde1234567",
      "descricao": "Salário CLT",
      "valor": 5200.00,
      "tipo_entrada": "FIXA",
      "data_recebimento": "2026-08-05",
      "confirmada": true
    },
    {
      "id": "7c4a8b91-5678-4d2b-9a3f-fedcba987654",
      "descricao": "Freelance - projeto X",
      "valor": 350.00,
      "tipo_entrada": "PONTUAL",
      "data_recebimento": "2026-08-20",
      "confirmada": false
    }
  ]
}
```

**Códigos de status**
| Código | Cenário |
|---|---|
| `200 OK` | Lista retornada (pode ser um array vazio) |
| `400 Bad Request` | `ano`/`mes` ausentes ou inválidos |
| `401 Unauthorized` | Token ausente, inválido ou expirado |

---

### 3.2 Confirmar recebimento de uma entrada

Marca uma entrada (tipicamente `FIXA`, como o salário) como confirmada pelo usuário via "check" manual no frontend.

| Campo | Valor |
|---|---|
| **Método** | `PATCH` |
| **Endpoint** | `/api/v1/entradas/{entrada_id}/confirmar` |
| **Autenticado** | Sim |

> Usa-se `PATCH` (não `PUT`) por ser uma atualização **parcial** de um único campo (`confirmada`), semântica mais correta do que substituir o recurso inteiro.

**Request Payload:** não se aplica (a ação é expressa pela própria rota; corpo vazio)

**Response Payload — `200 OK`**
```json
{
  "id": "9b1d5e2a-1234-4c1a-8f2e-abcde1234567",
  "descricao": "Salário CLT",
  "confirmada": true,
  "confirmada_em": "2026-08-13T14:32:10Z"
}
```

**Códigos de status**
| Código | Cenário |
|---|---|
| `200 OK` | Entrada confirmada com sucesso |
| `401 Unauthorized` | Token ausente, inválido ou expirado |
| `404 Not Found` | Entrada não existe ou não pertence ao usuário autenticado |
| `409 Conflict` | Entrada já estava confirmada anteriormente |

---

## 4. Gastos e Categorias

### 4.1 Listar categorias

Retorna a lista de categorias disponíveis para classificação de gastos (usada para popular selects/checkboxes no frontend).

| Campo | Valor |
|---|---|
| **Método** | `GET` |
| **Endpoint** | `/api/v1/categorias` |
| **Autenticado** | Sim |

**Request Payload:** não se aplica

**Response Payload — `200 OK`**
```json
{
  "categorias": [
    { "id": "a1b2c3d4-0000-0000-0000-000000000001", "nome": "Alimentação" },
    { "id": "a1b2c3d4-0000-0000-0000-000000000002", "nome": "Transporte" },
    { "id": "a1b2c3d4-0000-0000-0000-000000000003", "nome": "Lazer" }
  ]
}
```

**Códigos de status**
| Código | Cenário |
|---|---|
| `200 OK` | Lista retornada |
| `401 Unauthorized` | Token ausente, inválido ou expirado |

---

### 4.2 Criar novo gasto

Cria um gasto e o associa a uma ou mais categorias (relação N:N) em uma única operação.

| Campo | Valor |
|---|---|
| **Método** | `POST` |
| **Endpoint** | `/api/v1/gastos` |
| **Autenticado** | Sim |

**Request Payload**
```json
{
  "nome": "Supermercado do mês",
  "valor": 480.75,
  "data_gasto": "2026-08-10",
  "descricao": "Compra mensal - Extra",
  "categorias_ids": [
    "a1b2c3d4-0000-0000-0000-000000000001"
  ]
}
```

**Response Payload — `201 Created`**
```json
{
  "id": "d4e5f6a7-1111-2222-3333-444455556666",
  "nome": "Supermercado do mês",
  "valor": 480.75,
  "data_gasto": "2026-08-10",
  "descricao": "Compra mensal - Extra",
  "categorias": [
    { "id": "a1b2c3d4-0000-0000-0000-000000000001", "nome": "Alimentação" }
  ],
  "data_criacao": "2026-08-13T14:40:00Z"
}
```

**Códigos de status**
| Código | Cenário |
|---|---|
| `201 Created` | Gasto criado (retorna o recurso, incluindo `Location` header com a URL do novo gasto) |
| `400 Bad Request` | Campos obrigatórios ausentes ou `valor <= 0` |
| `401 Unauthorized` | Token ausente, inválido ou expirado |
| `422 Unprocessable Entity` | Algum `categoria_id` informado não existe |

---

### 4.3 Listar extrato de gastos do mês

Retorna os gastos do usuário em um período, já com as categorias associadas.

| Campo | Valor |
|---|---|
| **Método** | `GET` |
| **Endpoint** | `/api/v1/gastos?ano=2026&mes=8` |
| **Autenticado** | Sim |

**Query params**
| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `ano` | int | Sim | Ano de referência |
| `mes` | int | Sim | Mês de referência (`1`–`12`) |
| `categoria_id` | uuid | Não | Filtra o extrato por uma categoria específica |

**Request Payload:** não se aplica

**Response Payload — `200 OK`**
```json
{
  "periodo": { "ano": 2026, "mes": 8 },
  "total_gasto": 480.75,
  "gastos": [
    {
      "id": "d4e5f6a7-1111-2222-3333-444455556666",
      "nome": "Supermercado do mês",
      "valor": 480.75,
      "data_gasto": "2026-08-10",
      "descricao": "Compra mensal - Extra",
      "categorias": [
        { "id": "a1b2c3d4-0000-0000-0000-000000000001", "nome": "Alimentação" }
      ]
    }
  ]
}
```

**Códigos de status**
| Código | Cenário |
|---|---|
| `200 OK` | Extrato retornado (pode ser um array vazio) |
| `400 Bad Request` | `ano`/`mes` ausentes ou inválidos |
| `401 Unauthorized` | Token ausente, inválido ou expirado |

---

## 5. Investimentos

### 5.1 Registrar novo aporte

Registra um aporte no "diário de alocação de ativos" do usuário. Não gera automaticamente um registro em `gastos` — essa amarração, se desejada, é uma decisão explícita do frontend/negócio.

| Campo | Valor |
|---|---|
| **Método** | `POST` |
| **Endpoint** | `/api/v1/investimentos` |
| **Autenticado** | Sim |

**Request Payload**
```json
{
  "ativo_fundo": "Tesouro Selic 2029",
  "valor_aportado": 1000.00,
  "data_aporte": "2026-08-12"
}
```

**Response Payload — `201 Created`**
```json
{
  "id": "e5f6a7b8-2222-3333-4444-555566667777",
  "ativo_fundo": "Tesouro Selic 2029",
  "valor_aportado": 1000.00,
  "data_aporte": "2026-08-12",
  "data_criacao": "2026-08-13T14:45:00Z"
}
```

**Códigos de status**
| Código | Cenário |
|---|---|
| `201 Created` | Aporte registrado (retorna o recurso, incluindo `Location` header) |
| `400 Bad Request` | Campos obrigatórios ausentes ou `valor_aportado <= 0` |
| `401 Unauthorized` | Token ausente, inválido ou expirado |

---

### 5.2 Listar histórico de investimentos

Retorna o histórico de aportes do usuário, com suporte a paginação.

| Campo | Valor |
|---|---|
| **Método** | `GET` |
| **Endpoint** | `/api/v1/investimentos?pagina=1&tamanho=20` |
| **Autenticado** | Sim |

**Query params**
| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `pagina` | int | Não (padrão `1`) | Página de resultados |
| `tamanho` | int | Não (padrão `20`) | Itens por página |
| `ativo_fundo` | string | Não | Filtro por nome do ativo/fundo |

**Request Payload:** não se aplica

**Response Payload — `200 OK`**
```json
{
  "total_aportado": 1000.00,
  "paginacao": {
    "pagina": 1,
    "tamanho": 20,
    "total_itens": 1,
    "total_paginas": 1
  },
  "investimentos": [
    {
      "id": "e5f6a7b8-2222-3333-4444-555566667777",
      "ativo_fundo": "Tesouro Selic 2029",
      "valor_aportado": 1000.00,
      "data_aporte": "2026-08-12"
    }
  ]
}
```

**Códigos de status**
| Código | Cenário |
|---|---|
| `200 OK` | Histórico retornado (pode ser um array vazio) |
| `400 Bad Request` | Parâmetros de paginação inválidos (ex: `tamanho` negativo) |
| `401 Unauthorized` | Token ausente, inválido ou expirado |

---

## 6. Resumo das rotas

| Método | Endpoint | Descrição | Autenticado | Sucesso |
|---|---|---|---|---|
| `POST` | `/api/v1/usuarios` | Cria uma nova conta de usuário | Não | `201` |
| `POST` | `/api/v1/auth/login` | Autentica e gera token JWT | Não | `200` |
| `GET` | `/api/v1/entradas` | Lista entradas do mês | Sim | `200` |
| `PATCH` | `/api/v1/entradas/{id}/confirmar` | Confirma recebimento de uma entrada | Sim | `200` |
| `GET` | `/api/v1/categorias` | Lista categorias de gastos | Sim | `200` |
| `POST` | `/api/v1/gastos` | Cria um novo gasto (com categorias) | Sim | `201` |
| `GET` | `/api/v1/gastos` | Lista extrato de gastos do mês | Sim | `200` |
| `POST` | `/api/v1/investimentos` | Registra um novo aporte | Sim | `201` |
| `GET` | `/api/v1/investimentos` | Lista histórico de investimentos | Sim | `200` |

---

## 7. Observações de arquitetura

- **Identidade via token, não via payload/URL:** em nenhuma rota autenticada o `usuario_id` é passado explicitamente pelo cliente. Ele é extraído do JWT no *Lambda Authorizer* (ou middleware equivalente), impedindo que um usuário acesse ou manipule dados de outro (IDOR).
- **`404` vs `403` em recursos de terceiros:** ao tentar confirmar uma entrada que pertence a outro usuário, a API retorna `404 Not Found` (e não `403 Forbidden`), evitando confirmar a um invasor que o recurso existe.
- **Senha nunca retornada:** em nenhum endpoint, em nenhuma circunstância, `senha` ou `senha_hash` aparecem em uma response — nem mesmo em rotas administrativas futuras.
- **Hash fora do caminho crítico de validação:** o backend deve validar a política de senha (`400 Bad Request`) *antes* de invocar o `passlib`, já que o hashing é computacionalmente caro por design e não deve ser executado para senhas que serão rejeitadas de qualquer forma.
- **Paginação:** aplicada em `/investimentos`, que tende a crescer indefinidamente ao longo do tempo. As rotas de `/entradas` e `/gastos` são naturalmente limitadas pelo filtro mensal, então a paginação é opcional nelas por ora.
- **Fora do escopo definido, mas prováveis próximos passos:** rotas de `POST /entradas` (cadastro manual de uma nova entrada) e `PUT/DELETE` para `gastos` e `investimentos`. Não foram incluídas aqui por não terem sido listadas no escopo solicitado — posso desenhá-las na sequência, se fizerem parte do próximo sprint.