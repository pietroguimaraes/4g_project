# 4g_project — Product Requirements Document (PRD)

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-04-15 | 1.0 | Criação inicial | Morgan (PM) |

---

## 1. Objetivos e Contexto

### Objetivos
- Substituir o Google Sheets por um dashboard web interativo
- Dar ao Anderson controle de aprovação sobre quais empresas serão prospectadas
- Permitir configurar buscas por região, cidade e quantidade (até 100 leads)
- Visualizar o funil de leads em tempo real via Kanban
- Garantir que o Anderson (Closer) receba apenas leads qualificados pela IA
- Manter os 3 fluxos n8n funcionando após a migração

### Contexto
A 4G é uma distribuidora que usa uma automação n8n para prospectar lojas via Google Maps (Apify), qualificar leads por WhatsApp com IA (GPT-4o-mini) e acompanhar o funil no Google Sheets. O Anderson (dono e Closer da 4G) pediu para eliminar o Sheets e ter um dashboard interativo onde, após cada busca, ele vê as empresas encontradas em cards e **arrasta cada uma para a direita para aprovar (prospectar) ou para a esquerda para descartar** — só então o WhatsApp é disparado para as aprovadas. Além disso, pode aprovar todas de uma vez com um único botão. Os leads aprovados entram no Kanban de funil, onde o Anderson acompanha visualmente cada etapa até o handoff final para ele mesmo como Closer. Tudo isso sem precisar abrir nenhuma planilha.

---

## 2. Requisitos

### Funcionais

- **FR1:** O sistema deve permitir ao Anderson configurar uma busca definindo país, estado, cidade e quantidade de empresas (até 100) antes de iniciá-la
- **FR2:** Após a busca, o sistema deve exibir as empresas encontradas como cards individuais com status `LOCALIZADOS` para revisão
- **FR3:** O Anderson deve poder arrastar um card para a direita para aprovar (`PROSPECTAR`) ou para a esquerda para descartar (`DESCARTADOS`)
- **FR4:** O sistema deve oferecer um botão "Aprovar Todos" para mover todas as empresas de `LOCALIZADOS` para `PROSPECTAR` em lote
- **FR5:** Apenas empresas em `PROSPECTAR` devem ter a mensagem de prospecção disparada via WhatsApp (uazapi), passando para `PROSPECTADOS`
- **FR6:** Empresas descartadas (`DESCARTADOS`) incluem: rejeitadas manualmente, sem WhatsApp válido, bots detectados (ENCERRADO_BOT) e opt-outs
- **FR7:** O sistema deve exibir um quadro Kanban com colunas: `PROSPECTADOS`, `INTERESSE`, `TRANSFERIDOS`, `DESCARTADOS`
- **FR8:** Cada card de lead no Kanban deve exibir: empresa, telefone, cidade, categoria (DOMÉSTICOS/ESPORTIVOS/MISTO), nota da IA (0-10) e data de coleta
- **FR9:** Leads em `INTERESSE` devem ter um botão "Transferir para Closer" que muda o status para `TRANSFERIDOS`, marcando o handoff ao Anderson como concluído
- **FR10:** O Anderson deve fazer login com email e senha para acessar o dashboard
- **FR11:** Os 3 fluxos n8n existentes devem ler e escrever no banco de dados do dashboard em vez do Google Sheets
- **FR12:** O Anderson deve poder adicionar manualmente uma empresa para prospecção, informando nome e telefone diretamente no dashboard

### Dicionário Oficial de Status

| Status | Descrição |
|--------|-----------|
| `LOCALIZADOS` | Empresas encontradas pelo Apify, aguardando aprovação do Anderson |
| `PROSPECTAR` | WhatsApp válido, aprovadas pelo Anderson, aguardando disparo da mensagem inicial |
| `PROSPECTADOS` | Mensagem inicial enviada ou follow-ups em curso |
| `INTERESSE` | Respondeu com fit e intenção — qualificado pela IA, aguardando handoff |
| `TRANSFERIDOS` | Handoff ao Closer (Anderson) concluído |
| `DESCARTADOS` | Sem fit / bot / telefone inválido / opt-out / rejeitado manualmente |

### Não-Funcionais

- **NFR1:** O dashboard deve carregar em menos de 3 segundos
- **NFR2:** Funciona em qualquer navegador moderno (Chrome, Safari, Firefox) em desktop e celular
- **NFR3:** Custo de infraestrutura mínimo — planos gratuitos (Supabase free tier, Vercel free tier)
- **NFR4:** Suporta até 100 novos leads por busca sem degradação de performance
- **NFR5:** Acessível de qualquer lugar via internet com autenticação segura

---

## 3. Interface e Design

### Visão Geral de UX
Interface minimalista e intuitiva — o Anderson não é técnico. Tudo auto-explicativo, sem manuais. Inspiração: Trello (Kanban) e apps de swipe (aprovação de cards).

### Interações Principais
- **Swipe/arrastar cards** para aprovar (`PROSPECTAR`) ou descartar (`DESCARTADOS`) empresas
- **Drag and drop** para mover leads entre colunas do Kanban
- **Botão "Transferir para Closer"** em cards na coluna `INTERESSE`
- **Formulário simples** para adicionar empresa manualmente (nome + telefone)
- **Botão "Aprovar Todos"** para aprovação em lote

### Telas Principais
- **Login** — email e senha
- **Painel de Aprovação** — cards das empresas `LOCALIZADOS` para revisar antes do disparo
- **Kanban de Funil** — leads em `PROSPECTADOS`, `INTERESSE`, `TRANSFERIDOS`, `DESCARTADOS`
- **Configuração de Busca** — campos para país, estado, cidade e quantidade
- **Adicionar Empresa** — formulário manual simples

### Acessibilidade
Nenhum requisito específico para o MVP.

### Plataformas
Web responsiva — desktop e celular via navegador.

### Identidade Visual
Design limpo e profissional como padrão.

---

## 4. Premissas Técnicas

### Stack
| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js + React + Tailwind CSS |
| Backend | Next.js API Routes |
| Banco de dados | PostgreSQL via Supabase |
| Autenticação | Supabase Auth (email + senha) |
| Deploy | Vercel (gratuito) |
| WhatsApp | uazapi (já em uso) |
| Scraping | Apify Google Maps (já em uso) |
| IA | GPT-4o-mini via OpenAI (já em uso) |

### Arquitetura
- **Estrutura:** Monorepo
- **Serviços:** Monolito (Next.js com API Routes integradas)
- **Integração n8n:** Fluxos chamam a API do dashboard via HTTP (API key por segurança)
- **Perfis de usuário:** Um único usuário (Anderson) no MVP

### Testes
Testes básicos nas partes críticas: login, aprovação de leads e integração n8n.

---

## 5. Lista de Épicos

| Épico | Título | Objetivo |
|-------|--------|----------|
| 1 | Fundação & Autenticação | Base técnica, banco de dados e login |
| 2 | Painel de Aprovação | Fluxo completo de aprovação de empresas |
| 3 | Kanban de Funil & Migração n8n | Kanban + aposentadoria do Google Sheets |

---

## 6. Detalhamento dos Épicos

### Épico 1: Fundação & Autenticação

*Objetivo: Estabelecer a base técnica completa — Next.js, banco de dados com schema oficial de status, autenticação e deploy — com uma tela inicial funcional.*

---

**Story 1.1 — Setup do Projeto**
Como desenvolvedor, quero o projeto Next.js configurado com Supabase e Vercel, para ter a base técnica pronta para desenvolvimento.

*Critérios de Aceitação:*
1. Projeto Next.js criado com TypeScript e Tailwind CSS
2. Supabase conectado ao projeto (variáveis de ambiente configuradas)
3. Deploy funcionando no Vercel com URL pública
4. Repositório Git inicializado

---

**Story 1.2 — Schema do Banco de Dados**
Como sistema, quero as tabelas do banco criadas no Supabase com o dicionário oficial de status, para substituir o Google Sheets como fonte da verdade.

*Critérios de Aceitação:*
1. Tabela `leads` criada com colunas: id, empresa, telefone, website, cidade, estado, pais, status, categoria, nota, data_coleta, data_resposta, data_followup, qtd_reengajamentos
2. Tabela `searches` criada com colunas: id, pais, estado, cidade, quantidade, data, status
3. Status possíveis documentados e implementados: `LOCALIZADOS`, `PROSPECTAR`, `PROSPECTADOS`, `INTERESSE`, `TRANSFERIDOS`, `DESCARTADOS`
4. API REST idempotente com identificação por telefone (formato E.164)
5. Migrations aplicadas com sucesso no Supabase

---

**Story 1.3 — Autenticação com Email e Senha**
Como Anderson, quero fazer login com email e senha, para acessar o dashboard com segurança de qualquer lugar.

*Critérios de Aceitação:*
1. Tela de login com campos de email e senha
2. Login funcional via Supabase Auth
3. Sessão mantida entre visitas
4. Rotas do dashboard bloqueadas para usuários não autenticados
5. Botão de logout disponível

---

**Story 1.4 — Layout Base do Dashboard**
Como Anderson, quero ver a estrutura base do dashboard após o login, para confirmar que o sistema está funcionando.

*Critérios de Aceitação:*
1. Navbar com nome do projeto e botão de logout
2. Menu de navegação com: Painel de Aprovação e Kanban
3. Telas vazias renderizando sem erros
4. Layout responsivo funcionando em desktop e celular

---

### Épico 2: Painel de Aprovação

*Objetivo: Criar o fluxo completo de aprovação — o Anderson configura a busca, vê as empresas encontradas como cards (`LOCALIZADOS`), aprova (`PROSPECTAR`) ou descarta (`DESCARTADOS`) por swipe, aprova em lote, ou adiciona manualmente. Só as aprovadas recebem o WhatsApp.*

---

**Story 2.1 — Configuração de Busca**
Como Anderson, quero configurar os parâmetros de busca antes de iniciar uma prospecção, para encontrar empresas na região e quantidade que eu quiser.

*Critérios de Aceitação:*
1. Formulário com campos: país, estado, cidade e quantidade (1 a 100)
2. Botão "Iniciar Busca" que aciona o fluxo n8n via webhook
3. Estado de loading exibido enquanto o Apify busca as empresas
4. Busca salva na tabela `searches` com status e data
5. Validação: todos os campos obrigatórios antes de enviar

---

**Story 2.2 — Recebimento e Exibição das Empresas Encontradas**
Como sistema, quero receber as empresas encontradas pelo Apify e exibi-las como cards com status `LOCALIZADOS`, para que o Anderson possa revisá-las.

*Critérios de Aceitação:*
1. Endpoint da API recebe as empresas enviadas pelo n8n após a busca
2. Empresas salvas na tabela `leads` com status `LOCALIZADOS`
3. Cards exibidos com: nome da empresa, telefone e cidade
4. Painel atualiza automaticamente quando novas empresas chegam
5. Contador de empresas `LOCALIZADOS` visível

---

**Story 2.3 — Aprovação e Descarte por Swipe**
Como Anderson, quero arrastar o card de uma empresa para a direita para aprovar (`PROSPECTAR`) ou para a esquerda para descartar (`DESCARTADOS`), para decidir quem vai receber o WhatsApp.

*Critérios de Aceitação:*
1. Card pode ser arrastado para direita (aprovado) ou esquerda (descartado)
2. Indicação visual clara durante o arraste (verde para aprovar, vermelho para descartar)
3. Empresa aprovada: status muda para `PROSPECTAR`, n8n dispara WhatsApp e muda para `PROSPECTADOS`
4. Empresa descartada: status muda para `DESCARTADOS`
5. Card removido do painel após decisão

---

**Story 2.4 — Aprovação em Lote**
Como Anderson, quero aprovar todas as empresas pendentes de uma vez, para agilizar quando confio nos resultados da busca.

*Critérios de Aceitação:*
1. Botão "Aprovar Todos" visível no Painel de Aprovação
2. Confirmação antes de executar ("Aprovar X empresas?")
3. Todas as empresas `LOCALIZADOS` movidas para `PROSPECTAR`
4. WhatsApp disparado para todas via n8n, passando para `PROSPECTADOS`
5. Painel esvaziado após aprovação em lote

---

**Story 2.5 — Adição Manual de Empresa**
Como Anderson, quero adicionar manualmente uma empresa para prospecção informando nome e telefone, para incluir leads que não vieram da busca automática.

*Critérios de Aceitação:*
1. Botão "Adicionar Empresa" visível no Painel de Aprovação
2. Formulário com campos: nome da empresa e telefone
3. Empresa salva com status `PROSPECTAR` diretamente
4. WhatsApp de prospecção disparado imediatamente via n8n, passando para `PROSPECTADOS`
5. Empresa aparece no Kanban na coluna `PROSPECTADOS`

---

### Épico 3: Kanban de Funil & Migração n8n

*Objetivo: Criar o quadro Kanban completo com o novo vocabulário de status e migrar os 3 fluxos n8n do Google Sheets para o banco — aposentando o Sheets definitivamente.*

---

**Story 3.1 — Kanban com Colunas e Cards**
Como Anderson, quero ver todos os leads organizados no Kanban por status, para acompanhar o funil de qualificação em tempo real.

*Critérios de Aceitação:*
1. Kanban exibe colunas: `PROSPECTADOS`, `INTERESSE`, `TRANSFERIDOS`, `DESCARTADOS`
2. Cada card exibe: empresa, telefone, cidade, categoria, nota IA (0-10) e data de coleta
3. Contador de leads em cada coluna visível
4. Leads carregados do banco Supabase em tempo real
5. Layout responsivo em desktop e celular

---

**Story 3.2 — Drag and Drop e Handoff para Closer**
Como Anderson, quero mover leads entre colunas e marcar leads qualificados como transferidos, para gerenciar o funil e registrar o handoff.

*Critérios de Aceitação:*
1. Cards podem ser arrastados entre colunas do Kanban
2. Status do lead atualizado no banco imediatamente após o drop
3. Cards em `INTERESSE` exibem botão "Transferir para Closer"
4. Ao clicar em "Transferir para Closer", status muda para `TRANSFERIDOS`
5. Indicação visual clara durante o arraste

---

**Story 3.3 — Migração do Fluxo Principal n8n**
Como sistema, quero que o fluxo principal n8n use o novo banco e o novo vocabulário de status, para que prospecção e qualificação usem o CRM como fonte da verdade.

*Critérios de Aceitação:*
1. Nós do Google Sheets substituídos por chamadas HTTP à API do dashboard (com API key)
2. Status gravados conforme dicionário oficial: `PROSPECTADOS`, `INTERESSE`, `DESCARTADOS`
3. Fluxo testado end-to-end: busca → aprovação → WhatsApp → qualificação → Kanban atualizado
4. Google Sheets não é mais escrito ou lido por este fluxo

---

**Story 3.4 — Migração do Fluxo de Follow-up n8n**
Como sistema, quero que o fluxo de Follow-up (D+3 e D+7) use o novo banco, mantendo o acompanhamento automático de leads `PROSPECTADOS` sem resposta.

*Critérios de Aceitação:*
1. Nós do Google Sheets substituídos por chamadas HTTP à API do dashboard
2. Fluxo lê leads com status `PROSPECTADOS` e filtra por prazo (D+3/D+7)
3. Status e datas atualizados corretamente no Kanban após cada follow-up
4. Google Sheets não é mais usado por este fluxo

---

**Story 3.5 — Migração do Fluxo de Reengajamento n8n**
Como sistema, quero que o fluxo de Reengajamento Mensal use o novo banco, completando a aposentadoria do Google Sheets.

*Critérios de Aceitação:*
1. Nós do Google Sheets substituídos por chamadas HTTP à API do dashboard
2. Lógica de elegibilidade mantida: máx 3 reengajamentos, 30+ dias desde último contato
3. Leads elegíveis lidos do status `PROSPECTADOS` (inclui reengajamentos anteriores)
4. Google Sheets não é mais usado por nenhum dos 3 fluxos n8n

---

## 7. Pós-MVP (Fase 2)

- Edição da mensagem de prospecção diretamente pelo dashboard
- Histórico completo de conversas do WhatsApp dentro do card do lead
- Filtros e busca no Kanban (por empresa, data, status, categoria, nota)
- Notificações quando um lead sobe para `INTERESSE`
- Múltiplos usuários com perfis diferentes (Admin, SDR, Closer)

---

## 8. Próximos Passos

### Para o Arquiteto (@architect)
Criar a arquitetura técnica com base neste PRD, definindo estrutura de pastas, padrões de API, modelo de dados detalhado e estratégia de deploy.

### Para o Scrum Master (@sm)
Criar as stories detalhadas a partir dos épicos deste PRD, começando pelo Épico 1.

---

*Documento gerado por Morgan (PM Agent) — 4g_project*
*Versão: 1.0 | Data: 2026-04-15*
