# 4G Distribuição — PRD Épico 4: Garantia de Quantidade de Leads

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-04-27 | 1.0 | Criação inicial | Morgan (PM) |

---

## 1. Contexto e Problema

### O Sistema Atual

O dashboard 4G já funciona de ponta a ponta: o Anderson configura uma busca (cidade, tipo de loja, quantidade), o n8n aciona o Apify para buscar no Google Maps, os resultados passam por um filtro de categorias e chegam ao dashboard como cards `LOCALIZADOS` para aprovação.

### O Problema

**O Anderson pede X leads e recebe muito menos que X.**

Exemplo real: pede 30 lojas de artigos esportivos em uma cidade e recebe 6 ou 8.

Isso acontece porque o fluxo atual já compensa parcialmente o descarte do filtro buscando 2,5x a mais no Apify — mas essa margem não é suficiente. Após o filtro de categorias (approved/denied list + dedup por telefone), o número de leads válidos fica muito abaixo do pedido. O Anderson não sabe quantos vão chegar de verdade antes de o fluxo terminar.

### Impacto

- Anderson não consegue prospectar na quantidade que planejou
- Processo de busca se torna frustrante e imprevisível
- O ajuste manual do fluxo n8n chegou à versão 16 sem resolver definitivamente o problema de quantidade

### O que NÃO muda

- A stack (Next.js, Supabase, n8n, Apify, uazapi) permanece a mesma
- O funil de status dos leads permanece igual
- O dashboard e a UX de aprovação/Kanban não mudam
- As approved/denied lists e a lógica de filtro permanecem — só a **quantidade final** deve ser garantida

---

## 2. Objetivo

Garantir que o número de leads `LOCALIZADOS` entregues ao Anderson seja igual ou próximo da quantidade solicitada, de forma confiável, sem necessidade de ajuste manual no n8n.

**Critério de sucesso:** Para qualquer busca válida (cidade com estabelecimentos do tipo pedido), o sistema deve entregar pelo menos **80% da quantidade solicitada** em leads válidos e filtrados.

---

## 3. Requisitos Funcionais

- **FR1:** O sistema deve aumentar automaticamente o volume de busca no Apify até ter pool suficiente para, após o filtro, atingir a quantidade pedida
- **FR2:** Se a primeira rodada de busca retornar menos leads válidos que o pedido, o sistema deve executar rodadas adicionais de busca automaticamente, sem intervenção do Anderson
- **FR3:** O Anderson deve ver no dashboard o progresso da busca em tempo real: quantos leads válidos já foram encontrados vs. quantos foram pedidos (ex: "18 de 30 encontrados")
- **FR4:** O sistema deve parar de buscar quando atingir a quantidade pedida OU quando esgotar as possibilidades reais da cidade (sem resultados novos após N tentativas)
- **FR5:** Quando o sistema esgotar as possibilidades e não conseguir atingir a quantidade pedida, deve informar o Anderson com clareza: "Encontrei X de Y pedidos. Essa cidade pode não ter mais lojas desse tipo disponíveis no Google Maps."
- **FR6:** O histórico da busca na tabela `searches` deve registrar: quantidade pedida, quantidade encontrada pelo Apify (bruto) e quantidade entregue após filtro

---

## 4. Requisitos Não-Funcionais

- **NFR1:** O fluxo de busca com retry não deve ultrapassar 10 minutos no total (timeout de segurança)
- **NFR2:** Não deve criar leads duplicados — o dedup por telefone já existente deve continuar funcionando entre rodadas
- **NFR3:** A solução deve viver dentro do fluxo n8n existente e da API do dashboard — sem nova infraestrutura
- **NFR4:** O custo adicional de chamadas ao Apify deve ser proporcional à busca — não fazer chamadas desnecessárias quando a quantidade já foi atingida

---

## 5. Fora de Escopo (Este Épico)

- Mudar as approved/denied lists do filtro de categorias
- Adicionar novos tipos de loja
- Criar novo dashboard ou nova tela
- Integração com outras fontes de dados além do Apify
- Mudanças no funil de status ou na UX de aprovação

---

## 6. Épico e Stories

### Épico 4: Garantia de Quantidade de Leads

*Objetivo: O sistema entrega ao Anderson pelo menos 80% da quantidade de leads pedida, com feedback em tempo real e comunicação clara quando a cidade não tem mais resultados disponíveis.*

---

**Story 4.1 — Retry Automático no Fluxo n8n**

Como sistema, quero executar rodadas adicionais de busca no Apify automaticamente quando o número de leads válidos após o filtro for menor que o pedido, para maximizar a quantidade entregue sem intervenção manual.

*Critérios de Aceitação:*
1. Após a primeira busca + filtro, se `leads_validos < quantidade_pedida`, o fluxo executa uma segunda rodada de busca com strings diferentes ou maior `maxResults`
2. O sistema pode executar até 3 rodadas antes de encerrar
3. O dedup por telefone funciona entre todas as rodadas (sem duplicatas)
4. O fluxo para imediatamente quando `leads_validos >= quantidade_pedida`
5. O fluxo para após 3 rodadas mesmo que não tenha atingido a quantidade (com registro do motivo)

---

**Story 4.2 — Feedback de Progresso da Busca no Dashboard**

Como Anderson, quero ver em tempo real quantos leads válidos já foram encontrados durante a busca, para saber o que esperar antes de o fluxo terminar.

*Critérios de Aceitação:*
1. Durante a busca, o dashboard exibe: "Buscando... X de Y leads encontrados"
2. O contador atualiza em tempo real conforme cada rodada do n8n envia resultados
3. Quando a busca termina, exibe: "Busca concluída — X leads encontrados" (ou mensagem de esgotamento)
4. A mensagem de esgotamento é clara e amigável: "Encontrei X de Y pedidos. Essa cidade pode não ter mais lojas disponíveis no Google Maps."
5. O estado de progresso some após o Anderson começar a revisar os cards

---

**Story 4.3 — Registro de Métricas de Busca**

Como sistema, quero registrar na tabela `searches` as métricas completas de cada busca, para que o Anderson e o sistema possam entender o desempenho real de cada região e tipo de loja.

*Critérios de Aceitação:*
1. Tabela `searches` registra: `quantidade_pedida`, `quantidade_bruta` (total do Apify antes do filtro), `quantidade_entregue` (após filtro), `num_rodadas` (quantas rodadas de busca foram necessárias)
2. API PATCH `/api/searches/{id}` aceita atualização desses campos pelo n8n
3. Esses dados são visíveis para debug (não precisam aparecer para o Anderson na UI neste momento)
4. Migration aplicada no Supabase para os novos campos

---

## 7. Próximos Passos

### Para o Scrum Master (@sm)
Criar as stories detalhadas a partir deste épico, começando pela Story 4.1 (retry no n8n) por ser o núcleo da solução.

### Para o Dev (@dev)
- Story 4.1: trabalho principal no fluxo n8n (`Fluxo_4g_v16_final.json`)
- Story 4.2: atualização no componente de busca do dashboard + API de progresso
- Story 4.3: migration SQL + PATCH na API de searches

---

*Documento gerado por Morgan (PM Agent) — 4G Distribuição*
*Versão: 1.0 | Data: 2026-04-27*
