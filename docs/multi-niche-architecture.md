# Arquitetura Multi-Nicho — Expansão para Múltiplos Clientes

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-05-18 | 1.0 | Criação — estudo de arquitetura para demo e escala futura | Jan Oberhauser (Architect) |

---

## 1. Contexto e Propósito

Este documento nasce de uma necessidade imediata e de uma visão de longo prazo.

**Necessidade imediata (Dia 5):** Configurar o dashboard com o nicho "Distribuidora B2B" para servir como demo genérico durante prospecção comercial — genérico o suficiente para ser mostrado a qualquer empresa do setor sem revelar dados da 4G.

**Visão de longo prazo:** Estudar como o sistema evoluirá quando houver múltiplos clientes ativos simultaneamente. As decisões arquiteturais tomadas agora devem permitir essa transição sem reescrever o código do zero.

> **IMPORTANTE:** A implementação atual descrita neste documento é um DEMO. O objetivo é aprender o processo de configuração por nicho, não entregar um produto multi-tenant de produção. A arquitetura multi-tenant completa (Opção B) será implementada quando houver clientes pagantes suficientes para justificar o investimento.

---

## 2. O Que Muda Entre Clientes

Analisando o sistema atual, apenas ~10% do código é específico de um cliente. O restante é infraestrutura universal.

### Componentes Universais (não mudam entre clientes)

| Componente | Descrição |
|---|---|
| Funil Kanban | A lógica de colunas e status é igual para qualquer setor |
| Painel de aprovação | Swipe/aprovação em lote funciona para qualquer lead |
| Autenticação | Login email + senha via Supabase Auth |
| Integração n8n | Os 3 fluxos (prospecção, follow-up, reengajamento) têm estrutura idêntica |
| API Routes | Endpoints `/api/leads` e `/api/searches` são genéricos |
| Schema do banco | Tabelas `leads` e `searches` funcionam para qualquer nicho |

### Componentes Configuráveis (mudam por cliente)

| Componente | Exemplo 4G | Exemplo Distribuidora B2B |
|---|---|---|
| Nome do negócio | 4G Distribuidora | Distribuidora B2B (Demo) |
| Categorias de lead | DOMÉSTICOS / ESPORTIVOS / MISTO | ALIMENTÍCIO / HIGIENE / LIMPEZA |
| Nome do vendedor | Lucas | (configurável) |
| Setor de busca Apify | distribuidoras GLP | distribuidoras atacado |
| Textos da interface | referências à 4G | textos genéricos |
| Credenciais | Supabase + n8n da 4G | Supabase + n8n do cliente |

---

## 3. As Duas Opções Arquiteturais

### Opção A — Uma Instância por Cliente (implementação atual)

```
cliente-4g.vercel.app        → projeto 4G     (config: GLP, Lucas)
demo-b2b.vercel.app          → demo genérico  (config: atacado, genérico)
cliente-padaria.vercel.app   → padaria        (config: panificação, João)
```

**Como funciona:**
- Cada cliente = 1 deploy Vercel + 1 projeto Supabase + variáveis de ambiente próprias
- O código é idêntico — só as variáveis e a tabela `config` mudam
- Para adicionar um cliente: fork do repositório + novo Supabase + preencher configuração

**Vantagens:**
- Isolamento total — problema de um cliente não afeta outro
- Simples de entender e manter
- Cada cliente pode ter customizações sem afetar os demais
- Custo zero até ~5 clientes (Vercel free + Supabase free por projeto)

**Desvantagens:**
- Gerenciar 10+ clientes vira trabalho manual
- Updates de código precisam ser aplicados em cada instância separadamente
- Sem painel centralizado para ver todos os clientes

**Indicado para:** até ~10 clientes ativos

---

### Opção B — Multi-Tenant (estudo para escala futura)

```
app.seudominio.com           → painel do operador (você)
app.seudominio.com/4g        → cliente 4G
app.seudominio.com/demo      → demo
app.seudominio.com/padaria   → padaria
```

**Como funcionaria:**
- 1 deploy, 1 banco com `tenant_id` em todas as tabelas
- Cada cliente acessa sua instância via subdomínio ou path
- Painel central de gestão para você gerenciar todos os clientes

**Mudanças necessárias no banco:**
```sql
-- Adicionar tenant_id em todas as tabelas
ALTER TABLE leads ADD COLUMN tenant_id UUID NOT NULL;
ALTER TABLE searches ADD COLUMN tenant_id UUID NOT NULL;

-- Nova tabela de tenants (clientes)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,          -- ex: "4g", "padaria"
  nome TEXT NOT NULL,
  categorias TEXT[] NOT NULL,         -- ex: ARRAY['ALIMENTÍCIO','HIGIENE']
  vendedor_nome TEXT,
  setor_busca TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: cada cliente só vê seus próprios dados
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON leads
  USING (tenant_id = current_setting('app.tenant_id')::UUID);
```

**Mudanças necessárias no código:**
- Middleware de roteamento por tenant (subdomínio ou path)
- Contexto de tenant injetado em todas as queries
- Painel administrativo para criar/gerenciar clientes

**Indicado para:** 10+ clientes, modelo SaaS, receita recorrente justifica o investimento

---

## 4. Decisão Arquitetural Atual

**Implementar Opção A agora, com preparação para Opção B.**

O critério de migração é simples: quando o trabalho manual de gerenciar clientes individuais custar mais do que o tempo de implementar multi-tenant, migre.

| Clientes ativos | Recomendação |
|---|---|
| 1-5 | Opção A (instâncias separadas) |
| 6-10 | Opção A com automação de deploy |
| 10+ | Opção B (multi-tenant) |

---

## 5. Tabela de Configuração (Implementação da Opção A)

Para evitar strings hardcoded no código, toda configuração específica do cliente vive em uma tabela `config` no Supabase. O dashboard lê essa tabela na inicialização.

### Schema

```sql
CREATE TABLE config (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  descricao TEXT
);

-- Dados do demo distribuidora B2B
INSERT INTO config (chave, valor, descricao) VALUES
  ('negocio_nome',      'Distribuidora B2B',              'Nome exibido no dashboard'),
  ('negocio_segmento',  'Distribuição Atacado',           'Segmento do negócio'),
  ('categorias',        'ALIMENTÍCIO,HIGIENE,LIMPEZA',    'Categorias de lead separadas por vírgula'),
  ('vendedor_nome',     'Vendedor',                       'Nome do responsável pelos leads quentes'),
  ('setor_busca',       'distribuidoras atacado',         'Termo padrão para busca no Apify'),
  ('demo_mode',         'true',                           'Indica que é uma instância de demonstração');
```

### Uso no código

```typescript
// src/lib/config.ts
export async function getConfig(): Promise<AppConfig> {
  const { data } = await supabase.from('config').select('chave, valor');
  return Object.fromEntries(data.map(r => [r.chave, r.valor]));
}

// Uso nos componentes
const config = await getConfig();
const categorias = config.categorias.split(',');
// → ['ALIMENTÍCIO', 'HIGIENE', 'LIMPEZA']
```

---

## 6. Processo de Clone para Novo Cliente

Quando um novo cliente fechar contrato, o processo será:

```
1. Fork do repositório 4g_project
2. Criar novo projeto no Supabase
3. Rodar migrations (schema idêntico)
4. Inserir dados na tabela config (valores do cliente)
5. Configurar variáveis de ambiente no Vercel
6. Deploy — cliente online em ~30 minutos
```

Este processo será automatizado com um script quando houver 3+ clientes ativos.

---

## 7. O Demo "Distribuidora B2B"

### Objetivo
Mostrar o sistema funcionando para empresas do setor de distribuição atacado, sem dados reais da 4G. O demo serve para fechar as primeiras vendas.

### Configuração do Demo

| Campo | Valor |
|---|---|
| Nome | Distribuidora B2B (Demo) |
| Categorias | ALIMENTÍCIO / HIGIENE / LIMPEZA |
| Vendedor | Vendedor |
| Setor de busca | distribuidoras atacado B2B |
| Modo demo | true (banner de demo visível) |

### O Que Mostrar no Demo

1. **Painel de aprovação** — empresas encontradas aguardando triagem
2. **Aprovação por swipe** — arrastar para aprovar/rejeitar
3. **Aprovação em lote** — aprovar todas de uma vez
4. **Kanban do funil** — leads percorrendo as colunas
5. **Configuração de busca** — definir cidade, quantidade

### O Que NÃO Mostrar no Demo

- Dados reais da 4G (empresa, telefone, cidade)
- Credenciais de produção
- Conversas reais de WhatsApp

---

## 8. Caminho de Evolução

```
AGORA (Dia 5)
└── Demo B2B configurado
    └── 1 instância, dados fictícios, mostra o produto

APÓS PRIMEIRAS VENDAS (2-5 clientes)
└── Opção A operando
    └── Cada cliente = 1 instância separada
    └── Tabela config preenchida por cliente
    └── Script de clone manual (~30 min por cliente)

ESCALA (10+ clientes)
└── Migração para Opção B (multi-tenant)
    └── 1 codebase, N clientes
    └── Painel administrativo centralizado
    └── Onboarding automatizado
```

---

## 9. Próximos Passos

| Ação | Responsável | Quando |
|---|---|---|
| Criar tabela `config` no Supabase do demo | @nick-saraev | Dia 5 |
| Substituir valores hardcoded da 4G no código | @nick-saraev | Dia 5 |
| Popular config com dados de distribuidora B2B | @nick-saraev | Dia 5 |
| Testar demo completo | Pietro | Dia 5 |
| Documentar script de clone | @nick-saraev | Após 1º cliente fechado |
| Avaliar migração multi-tenant | @jan-oberhauser | Ao atingir 10 clientes |

---

*Documento gerado por Jan Oberhauser (Architect Agent) — 4g_project*
*Versão: 1.0 | Data: 2026-05-18*
*Contexto: Demo Dia 5 + estudo de escala futura*
