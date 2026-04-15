# Project Brief: 4g_project

## Resumo Executivo

**4g_project** é uma extensão da automação de prospecção via WhatsApp já existente no n8n, que substitui o Google Sheets por um **dashboard interativo estilo Kanban**. O gestor da 4G poderá visualizar todas as empresas encontradas pelo sistema, aprovar ou rejeitar cada uma antes do disparo do WhatsApp, acompanhar o funil de qualificação em tempo real e configurar os parâmetros de busca (região, quantidade) — sem precisar abrir nenhuma planilha. O objetivo final é que o vendedor Lucas só receba leads já aquecidos e qualificados pela IA, prontos para fechar.

---

## Declaração do Problema

A equipe da 4G gerencia todo o pipeline de prospecção através do Google Sheets — uma ferramenta que exige abrir a planilha, localizar o lead, editar células manualmente e interpretar dados sem nenhuma visualização intuitiva. Além disso, hoje o sistema dispara mensagens WhatsApp automaticamente para todas as empresas encontradas, sem que o gestor possa revisar ou aprovar antes. Isso cria fricção desnecessária, aumenta o risco de erros e tira o controle do gestor sobre o processo. As soluções genéricas de CRM existentes são complexas demais para um fluxo simples e específico como esse. O problema precisa ser resolvido agora pois a automação já está ativa e gerando leads — cada dia sem dashboard é um dia com menos controle sobre o funil.

---

## Solução Proposta

O **4g_project** propõe substituir o Google Sheets por um dashboard web interativo, integrado diretamente à automação n8n existente. A solução tem dois pilares:

1. **Painel de Aprovação:** Empresas encontradas pelo Apify (Google Maps) aparecem no dashboard antes do disparo do WhatsApp. O gestor aprova (arrasta para direita) ou rejeita (arrasta para esquerda) cada empresa individualmente, ou aprova todas em lote. Só as aprovadas recebem a mensagem de prospecção.

2. **Quadro Kanban de Leads:** Após a aprovação, os leads percorrem o funil visualmente através de colunas (`Prospectado` → `Respondeu` → `Qualificado` / `Sem Resposta` → `FollowUp1` → `Reengajamento`), com informações de categoria (DOMÉSTICOS/ESPORTIVOS/MISTO) e nota da IA (0-10) em cada card.

O diferencial é a simplicidade: uma ferramenta feita exatamente para esse fluxo, sem nada a mais.

---

## Usuários-Alvo

### Segmento Primário: Gestor da 4G
O gestor/dono da 4G é o único usuário do dashboard. Não é técnico — usa WhatsApp e planilhas no dia a dia. Precisa de uma ferramenta simples e visual para aprovar empresas antes da prospecção, acompanhar o funil e garantir que o vendedor Lucas só receba leads quentes.

### Segmento Secundário: Automatizador (Pietro)
Como responsável pela automação, também é usuário indireto — precisa que o sistema seja fácil de manter, que a integração com o n8n seja clara e que futuras alterações sejam simples de implementar.

---

## Objetivos e Métricas de Sucesso

### Objetivos de Negócio
- Eliminar o uso do Google Sheets no gerenciamento de leads da 4G
- Dar ao gestor controle sobre quais empresas serão prospectadas
- Reduzir o tempo do gestor gasto em gestão de funil
- Garantir que o vendedor Lucas receba apenas leads qualificados e aquecidos
- Manter a automação n8n 100% funcional após a migração

### Métricas de Sucesso do Usuário
- O gestor visualiza todas as empresas encontradas em menos de 5 segundos ao abrir o dashboard
- O gestor aprova ou rejeita empresas arrastando cards, sem digitar nada
- Zero necessidade de abrir o Google Sheets após o lançamento

### KPIs
- **Taxa de adoção:** O gestor usa o dashboard diariamente na primeira semana
- **Zero erros de integração:** Os fluxos n8n continuam disparando corretamente após a migração
- **Tempo de resposta:** Dashboard carrega em menos de 3 segundos

---

## Escopo do MVP

### Funcionalidades Essenciais (Must Have)

- **Painel de aprovação:** Empresas encontradas pelo Apify aparecem para o gestor aprovar/rejeitar antes do WhatsApp ser disparado
- **Aprovação individual:** Arrastar card para direita (prospectar) ou esquerda (rejeitar)
- **Aprovação em lote:** Botão "Aprovar todos" para agilizar o processo
- **Quadro Kanban:** Visualização dos leads em colunas por status
- **Cards de lead:** Empresa, telefone, cidade, categoria (DOMÉSTICOS/ESPORTIVOS/MISTO), nota IA (0-10), data
- **Configuração de busca:** Gestor escolhe quantidade (até 100), país, estado e cidade antes de iniciar uma busca
- **Banco de dados próprio:** Substitui o Google Sheets como fonte de dados dos 3 fluxos n8n
- **Integração n8n:** Os 3 fluxos existentes leem e escrevem no novo banco
- **Login com email e senha:** Acesso seguro, funciona de qualquer lugar

### Fora do Escopo do MVP
- Histórico de conversas do WhatsApp no dashboard
- Relatórios e gráficos analíticos
- App mobile nativo
- Múltiplos usuários com permissões diferentes

### Critério de Sucesso do MVP
> O gestor da 4G faz login no dashboard, vê as empresas encontradas pelo sistema, aprova as que quer prospectar, acompanha o funil no Kanban — enquanto a automação n8n continua funcionando normalmente sem o Google Sheets.

---

## Visão Pós-MVP

### Funcionalidades Fase 2
- Histórico completo de conversas do WhatsApp dentro do card do lead
- Filtros e busca no Kanban (por empresa, data, status, categoria, nota)
- Notificações para o gestor quando um lead responde ou é qualificado
- Múltiplos usuários com níveis de acesso diferentes (gestor vs vendedor)

### Visão de Longo Prazo (6-12 meses)
O dashboard evolui para um CRM leve e completo, feito sob medida para o modelo de negócio da 4G — com histórico de interações, métricas de conversão e integração direta com o WhatsApp do Lucas para que ele feche vendas sem sair da plataforma.

### Oportunidades de Expansão
- Replicar a solução para outros clientes que usam automações n8n similares
- Transformar em produto SaaS para distribuidoras e pequenos times comerciais

---

## Considerações Técnicas

### Plataformas
- **Acesso:** Navegador web — funciona em qualquer computador ou celular
- **Compatibilidade:** Web responsiva
- **Performance:** Dashboard carrega em menos de 3 segundos

### Stack Tecnológica (preset nextjs-react)
- **Frontend:** Next.js + React + Tailwind CSS
- **Backend:** Next.js API Routes
- **Banco de dados:** PostgreSQL via Supabase (substitui Google Sheets)
- **Autenticação:** Supabase Auth (email + senha)
- **Infraestrutura:** Vercel (deploy) + Supabase (banco + auth)

### Arquitetura
- **Estrutura:** Monorepo
- **Serviços:** Monolito
- **Integração n8n:** Os fluxos chamam a API do dashboard via HTTP em vez de escrever no Sheets

### Testes
- Testes básicos nas partes críticas (login, aprovação de leads, integração n8n)

---

## Restrições e Suposições

### Restrições
- **Orçamento:** Mínimo possível — priorizar planos gratuitos (Supabase free tier, Vercel free tier)
- **Prazo:** Em aberto, com urgência para entregar MVP o mais rápido possível
- **Recursos:** Desenvolvido por Pietro, sem equipe
- **Técnico:** Manter compatibilidade com os 3 fluxos n8n existentes sem reescrevê-los do zero

### Suposições
- O gestor acessa o dashboard pelo navegador (desktop ou celular)
- O n8n consegue fazer chamadas HTTP para a API do dashboard
- A conta Apify já está ativa e funcionando
- A uazapi continua sendo usada para WhatsApp
- Máximo de 100 leads por busca

---

## Riscos e Perguntas em Aberto

### Riscos
- **Migração do Sheets:** Os 3 fluxos n8n precisam ser atualizados para usar o novo banco — risco de quebrar a automação durante a transição
- **Inserção de etapa de aprovação:** Hoje o Apify dispara e já envia WhatsApp automaticamente — inserir a revisão humana requer alteração no fluxo principal
- **Custo Apify:** Se o gestor buscar muitos leads com frequência, o custo do Apify pode crescer

### Perguntas Respondidas
- Máximo de leads por busca: **100**
- Aprovação: **individual E em lote**
- Leads rejeitados: **entram no fluxo de follow-up/reengajamento normalmente**

---

## Próximos Passos

### Ações Imediatas
1. Criar PRD completo a partir deste Brief
2. Definir arquitetura técnica com @architect
3. Configurar ambiente de desenvolvimento (Next.js + Supabase)
4. Migrar dados do Google Sheets para o banco novo

### Handoff para o PM
Este Project Brief fornece o contexto completo do **4g_project**. Iniciar modo de criação de PRD, revisando o brief para trabalhar com o usuário seção por seção, pedindo clarificações quando necessário.

---

*Documento gerado por Morgan (PM Agent) — 4g_project*
*Data: 2026-04-14*
