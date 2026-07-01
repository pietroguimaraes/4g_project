@AGENTS.md

# 4G Dashboard — Contexto do Projeto

## O que é esse projeto
Dashboard de CRM + prospecção de leads para a loja 4G (distribuidora de variedades, brinquedos e artigos esportivos) do Anderson.

**Stack:** Next.js + TypeScript + Tailwind | Supabase | n8n | Vercel

## Infraestrutura
- **Repo GitHub:** `pietroguimaraes/4g_project` → branch `main` → Vercel (auto-deploy)
- **Supabase:** projeto `tuctjosvxdzbfnyvvodc` (NÃO confundir com o projeto Domi `yzfyzcuzxyqinxmhhkiu`)
- **Migrations:** aplicadas manualmente via Supabase SQL Editor (CLI não configurado)
- **n8n:** `n8n-pietro-n8n.gats6d.easypanel.host`

## Protocolo de deploy
```
git add <arquivo>
git commit -m "tipo: descrição"
git push  # Vercel faz deploy automático em ~2 min
```
Só o @devops (Gage) faz git push. Nunca usar --force.

## Rotas principais
- `/aprovacao` — Painel de Aprovação (Anderson inicia buscas aqui)
- `/kanban` — CRM Kanban de leads
- `/manual` — Cadastro manual de lead

## APIs
| Rota | Função |
|------|--------|
| `POST /api/leads` | Salvar lead (n8n usa header `x-api-key`) |
| `POST /api/searches` | Iniciar busca → dispara webhook n8n |
| `PATCH /api/leads/[telefone]` | Atualizar status/transferir |
| `GET /api/leads/[telefone]/messages` | Histórico de mensagens |

## Tipos de automação (SearchForm)
- Google Maps (`fonte: 'google_maps'`)
- Instagram (`fonte: 'instagram'`)
- Ambos (`fonte: 'ambos'`)

## Categorias 4G (IMPORTANTE — não usar valores do Victor Pizza)
```ts
// CORRETO para 4G:
const TIPOS_LOJA = [
  'Lojas de Variedades/1,99/miudezas/bazares',
  'Lojas de brinquedos',
  'Lojas de artigos esportivos',
]

// ERRADO (Victor Pizza — não usar):
// 'Supermercados', 'Hipermercados', 'Redes de mercado'
```

## Design system atual
- **Dashboard:** fundo `bg-gray-950`, nav `bg-gray-900`
- **Cards Maps:** `bg-orange-500` (card inteiro laranja, texto branco)
- **Cards Instagram:** `bg-purple-600` (card inteiro roxo, texto branco)
- **Cards sem fonte:** `bg-gray-800`
- **Colunas Kanban:** `bg-gray-900` (hover: `bg-gray-800`)

## Tabelas Supabase — colunas que EXISTEM no projeto 4G

### `leads`
`id`, `empresa`, `telefone`, `email`, `website`, `cidade`, `estado`, `pais`, `search_id`, `status`, `tipo_loja`, `fonte_telefone`, `fonte`, `instagram_handle`, `instagram_followers`, `manual`, `categoria`, `nota`, `data_coleta`, `data_resposta`, `data_followup`, `qtd_reengajamentos`

**NÃO existem:** `cnpj`, `bairro`, `endereco`, `cep` (são colunas do Victor Pizza)

### `searches`
`id`, `pais`, `estado`, `cidade`, `quantidade`, `tipo_loja`, `fonte`, `status`, `created_at`, `total_encontrados`, `quantidade_bruta`, `quantidade_entregue`, `num_rodadas`

**NÃO existem:** `municipio_id`, `bairro` (são colunas do Victor Pizza)

## Armadilhas conhecidas (lições aprendidas)

### Cherry-pick contamination
O branch `demo-victor-pizza` tem campos específicos do Victor que NÃO existem no 4G:
- `searches`: `municipio_id`, `bairro`
- `leads`: `cnpj`, `bairro`, `endereco`, `cep`
- `LeadCategoria`: `'SUPERMERCADO'`, `'ATACADISTA'`, `'DISTRIBUIDORA'`

Sempre verificar se alguma migração ou cherry-pick trouxe esses campos.

### Supabase migration
Migrations nunca via CLI — sempre SQL Editor manual no projeto correto (`tuctjosvxdzbfnyvvodc`).

### API de leads — autenticação dupla
```ts
// n8n usa API key no header:
x-api-key: <N8N_API_KEY>  // usa service role (bypass RLS)

// Anderson usa sessão Supabase normal
```

## n8n — Fluxo Instagram
- Arquivo: `n8n/Fluxo_4g_v55_instagram.json`
- Quando não há telefone na bio do Instagram, usar `@username` como identificador no campo `telefone`
- Credencial Apify necessária para o scraper `apify~instagram-hashtag-scraper`

## Arquivos-chave
| Arquivo | Função |
|---------|--------|
| `src/types/index.ts` | Tipos globais (Lead, Search, LeadCategoria) |
| `src/components/kanban/KanbanCard.tsx` | Card com cor por fonte |
| `src/components/kanban/KanbanColumn.tsx` | Coluna dark |
| `src/components/approval/SearchForm.tsx` | Formulário de busca (categorias 4G + toggle fonte) |
| `src/components/approval/LeadCard.tsx` | Card no painel de aprovação |
| `src/app/api/leads/route.ts` | API de leads |
| `src/app/api/searches/route.ts` | API de buscas |
| `src/app/(dashboard)/layout.tsx` | Layout dark do dashboard |
| `src/lib/api/searches.ts` | Helper client-side de searches |

## Status (2026-07-01)
- Fluxo Google Maps: funcionando
- Fluxo Instagram: `@username` como telefone implementado, commit `994b06b` remove campos inexistentes da API — aguardando confirmação de deploy e teste no n8n
