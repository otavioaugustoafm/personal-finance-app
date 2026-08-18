# 🚀 Projeto Financeiro - Arquitetura e Roadmap

Este documento detalha a arquitetura atual do nosso aplicativo de gestão financeira e o roadmap oficial para a implementação do novo **Módulo de Investimentos**.

---

## 📦 Parte 1: O Que Já Temos Pronto (Nosso Arsenal)

A fundação do aplicativo já está sólida e rodando 100% na nuvem. Grande parte dessa base será reutilizada para as novas funcionalidades.

### 🛠️ Backend (AWS Lambda + Python/FastAPI + PostgreSQL)
* **Autenticação JWT:** Sistema de login seguro e controle de sessão já implementado.
* **CRUD de Lançamentos:** Rotas completas para criar, ler, atualizar e deletar entradas e saídas.
* **Inteligência de Resumo (`resumo.py`):** Lógica robusta que calcula "Saldo Atual" e "Saldo Projetado", separando receitas e despesas, além de controlar o fluxo de valores "A receber".
* **Gestão de Cartão de Crédito:** Lógica que isola a fatura e diferencia automaticamente um gasto de crédito pendente de uma fatura paga.
* **Infraestrutura Cloud:** Pacote configurado com as bibliotecas corretas (binários Linux `manylinux2014`) rodando no AWS Lambda e integrado ao API Gateway.

### 💻 Frontend (React + Tailwind CSS)
* **Dashboard Financeiro:** Interface responsiva com gráficos Recharts para análise de gastos por categoria.
* **Filtros Avançados:** Filtros de período (Mês/Ano), categorias, tipo de pagamento (Crédito, Débito, PIX, Dinheiro) e status (Pago, Pendente, A receber).
* **Cards Dinâmicos:** Visuais interativos e reativos, como o card da Fatura que exibe o botão de pagamento e se transforma em uma *badge* verde quando quitada.
* **Conexão Axios:** Camada de requisições HTTP para a API configurada com passagem automática do Token de autorização.

---

## 🗺️ Parte 2: Roadmap do Módulo de Investimentos

O desenvolvimento da aba de investimentos será dividido em 4 fases incrementais, focando primeiramente na gestão da carteira atual (O Gestor Interno) antes de expandir para o radar de mercado externo.

### Fase 1: Fundação do Banco de Dados e API de Cadastro
* [ ] **Tabela `investimentos` no PostgreSQL:** Estruturação das colunas `usuario_id`, `ticker`, `quantidade`, `preco_medio` e `categoria` (FII, Ação, ETF).
* [ ] **Rotas no FastAPI:** Criação dos *endpoints* REST (GET, POST, PUT, DELETE) para o cadastro e gerenciamento manual dos aportes.

### Fase 2: O Motor de Cotações (Inteligência sob Demanda)
* [ ] **Integração com API Financeira:** Conexão do backend à API da *Brapi* (ou *yfinance*) para buscar o preço real dos ativos na B3.
* [ ] **Sistema de Cache Inteligente:** Implementação de uma regra de armazenamento temporário (ex: 30 minutos) no banco de dados para a cotação do dia. O sistema só consumirá a API externa sob demanda (ao abrir a aba), poupando o limite de requisições gratuitas.
* [ ] **Matemática de Rentabilidade:** Lógica em Python para cruzar o `preco_medio` com a cotação atualizada, retornando Lucro/Prejuízo e o peso percentual de cada ativo na carteira.

### Fase 3: O Assessor Interno (Integração com IA Generativa)
* [ ] **Conexão com Google AI Studio (Gemini):** Configuração segura da chave de API no backend.
* [ ] **Construção do Payload de Contexto:** Função para empacotar o "Saldo Projetado" livre do mês atual + a lista da carteira de ativos do usuário.
* [ ] **Engenharia de Prompt e Output (JSON):** Configuração do *System Prompt* focado na estratégia do usuário (otimização de preço médio e balanceamento) e padronização da resposta da IA em formato JSON para fácil renderização no frontend.

### Fase 4: O Frontend do Investidor (Interface UI)
* [ ] **Criação da página `Investimentos.tsx`:** Nova aba principal no menu de navegação.
* [ ] **Tabela de Posição Consolidada:** Listagem dos ativos exibindo Ticker, Quantidade, Preço Médio, Preço Atual, Variação (%) e Peso na Carteira.
* [ ] **Ação "Consultar IA":** Botão em destaque para disparar a análise do Gemini, com estado de *loading* elegante, exibindo a sugestão de aporte e a justificativa gerada.