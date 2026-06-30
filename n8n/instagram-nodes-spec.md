# Especificação dos Nós Instagram — Fluxo 4G v55

## Contexto

Adicionar suporte ao Instagram como fonte de busca de leads no fluxo `Fluxo_4g — Dashboard v2`.

O campo `fonte` no webhook `receber_busca_dashboard` pode receber:
- `google_maps` → fluxo atual (sem mudança)
- `instagram` → branch novo (nós A-E abaixo)
- `ambos` → dispara AMBOS os branches em paralelo

---

## Mudança no Fluxo Atual

### Conexão que muda

**Antes:**
```
reserva_suficiente [FALSE saída index 1] → definir_termos
```

**Depois:**
```
reserva_suficiente [FALSE saída index 1] → verificar_fonte
  verificar_fonte [TRUE — instagram]  → definir_termos_instagram → apify_instagram → ...
  verificar_fonte [FALSE — maps/ambos] → definir_termos → ... (fluxo atual)
```

Para o caso `ambos`, o nó `verificar_fonte` tem uma **terceira saída** (índice 2) que também vai para `definir_termos_instagram`. Na prática, use dois nós IF em sequência (veja Nó A2 abaixo) para tratar os três casos.

---

## Nós Novos

### Nó A1: `verificar_fonte` (IF Node)

| Campo | Valor |
|-------|-------|
| **Tipo** | `n8n-nodes-base.if` |
| **typeVersion** | `2` |
| **Nome** | `verificar_fonte` |

**Condição:**
```
leftValue:  {{ $('receber_busca_dashboard').first().json.body.fonte }}
operator:   string — equals
rightValue: instagram
```

**Saídas:**
- `TRUE (index 0)` → `definir_termos_instagram`
- `FALSE (index 1)` → `verificar_fonte_ambos` (Nó A2)

---

### Nó A2: `verificar_fonte_ambos` (IF Node)

| Campo | Valor |
|-------|-------|
| **Tipo** | `n8n-nodes-base.if` |
| **typeVersion** | `2` |
| **Nome** | `verificar_fonte_ambos` |

**Condição:**
```
leftValue:  {{ $('receber_busca_dashboard').first().json.body.fonte }}
operator:   string — equals
rightValue: ambos
```

**Saídas:**
- `TRUE (index 0)` → `definir_termos_instagram` E `definir_termos` (dois branches paralelos)
- `FALSE (index 1)` → `definir_termos` (somente Google Maps)

> **Nota para o Pietro:** No n8n, para disparar dois nós a partir de uma saída, use o modo "Execute once for all items" e conecte a saída TRUE de `verificar_fonte_ambos` para AMBOS `definir_termos_instagram` e `definir_termos`. O n8n executa os dois em paralelo automaticamente.

---

### Nó B: `definir_termos_instagram` (Code Node)

| Campo | Valor |
|-------|-------|
| **Tipo** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Nome** | `definir_termos_instagram` |
| **onError** | `continueRegularOutput` |

**Código JavaScript:**
```javascript
const body = $('receber_busca_dashboard').first().json.body;
const tipoLoja = body.tipo_loja || '';
const cidade = body.cidade || '';
const estado = body.estado || '';

const HASHTAGS = {
  'Lojas de artigos esportivos': ['lojaesportiva', 'materialesportivo', 'bolasdefutebol', 'patins', 'beachtennis'],
  'Lojas de brinquedos': ['lojadebrinquedos', 'brinquedosinfantis', 'lojakids', 'brinquedos'],
  'Lojas de Variedades/1,99/miudezas/bazares': ['lojavariedades', 'bazar', 'importados', 'loja199', 'bazarvariedades'],
  'Supermercados': ['supermercado', 'mercadinho', 'minimercado'],
  'Hipermercados': ['hipermercado', 'supermercado', 'atacadista'],
  'Eletroportáteis/eletrônicos': ['lojaeletronicos', 'lojacelulares', 'techstore', 'eletronicos'],
};

const hashtags = HASHTAGS[tipoLoja] || ['lojavariedades', 'lojaesportiva', 'lojadebrinquedos'];
const searchTerms = hashtags.map(h => `#${h} ${cidade}`);

return [{
  json: {
    search_id: body.search_id,
    cidade,
    estado,
    tipo_loja: tipoLoja,
    quantidade: parseInt(body.quantidade) || 30,
    fonte: 'instagram',
    hashtags,
    searchTerms,
    locationQuery: `${cidade}, ${estado}, Brasil`,
  }
}];
```

---

### Nó C: `apify_instagram` (HTTP Request Node)

| Campo | Valor |
|-------|-------|
| **Tipo** | `n8n-nodes-base.httpRequest` |
| **typeVersion** | `4.3` |
| **Nome** | `apify_instagram` |
| **Método** | `POST` |
| **URL** | `https://api.apify.com/v2/acts/apify~instagram-hashtag-scraper/runs?token={{ $env.APIFY_TOKEN }}` |
| **onError** | `continueRegularOutput` |

**Headers:**
| Nome | Valor |
|------|-------|
| `Content-Type` | `application/json` |

**Body (JSON raw):**
```json
{
  "hashtags": "={{ $json.hashtags.slice(0,3).join(',') }}",
  "resultsLimit": "={{ $json.quantidade * 5 }}",
  "addParentData": true
}
```

> **Atenção:** O Actor `apify~instagram-hashtag-scraper` retorna posts. Cada post tem dados do perfil que publicou. O campo `addParentData: true` inclui os dados do perfil (bio, followers, username) em cada item do dataset.
>
> **Alternativa mais direta:** Usar `apify~instagram-profile-scraper` com uma lista de usernames extraídos primeiro dos posts. Porém isso exige dois passos. Para simplicidade, usamos o hashtag scraper com `addParentData`.

**Aguardar dataset:** Este nó faz o POST para *iniciar* o run. Para aguardar o resultado, adicione após ele um nó **Wait** (5 minutos) seguido de um HTTP GET para buscar o dataset:

```
GET https://api.apify.com/v2/acts/apify~instagram-hashtag-scraper/runs/last/dataset/items?token={{ $env.APIFY_TOKEN }}&limit={{ $('definir_termos_instagram').first().json.quantidade * 5 }}
```

> **Alternativa recomendada:** Use o nó nativo **Apify** (tipo `@apify/n8n-nodes-apify.apify`) com operação `Run actor and get dataset` — igual ao nó `Run an Actor and get dataset1` do Google Maps. Actor ID: `apify~instagram-hashtag-scraper`. Veja o JSON parcial abaixo.

---

### Nó D: `extrair_telefone_instagram` (Code Node)

| Campo | Valor |
|-------|-------|
| **Tipo** | `n8n-nodes-base.code` |
| **typeVersion** | `2` |
| **Nome** | `extrair_telefone_instagram` |
| **onError** | `continueRegularOutput` |

**Código JavaScript:**
```javascript
const items = $input.all();
const results = [];
const seen = new Set();

for (const item of items) {
  const profile = item.json;
  const bio = profile.biography || profile.bio || profile.ownerBiography || '';
  const username = profile.username || profile.ownerUsername || '';
  const followers = profile.followersCount || profile.ownerFollowersCount || profile.followers || 0;
  const nome = profile.fullName || profile.ownerFullName || profile.name || username;
  const website = profile.externalUrl || profile.ownerExternalUrl || profile.website || '';

  // Regex para telefone brasileiro
  const phoneRegex = /(?:\+55\s?)?(?:\(?\d{2}\)?\s?)(?:9\s?)?\d{4}[-\s]?\d{4}/g;
  const phones = bio.match(phoneRegex);

  if (!phones || phones.length === 0) continue;

  // Normaliza o primeiro telefone encontrado
  let telefone = phones[0].replace(/\D/g, '');
  if (telefone.startsWith('55') && telefone.length >= 12) {
    telefone = telefone.substring(2);
  }
  if (telefone.length === 10) {
    const firstAfterDDD = telefone.charAt(2);
    if (['6','7','8','9'].includes(firstAfterDDD)) {
      telefone = telefone.substring(0,2) + '9' + telefone.substring(2);
    } else {
      continue; // fixo, descarta
    }
  }
  if (telefone.length !== 11) continue;
  if (telefone.charAt(2) !== '9') continue;
  telefone = '55' + telefone;

  // Deduplicar por telefone
  if (seen.has(telefone)) continue;
  seen.add(telefone);

  results.push({
    json: {
      empresa: nome,
      telefone,
      website,
      cidade: $('definir_termos_instagram').first().json.cidade,
      estado: $('definir_termos_instagram').first().json.estado,
      tipo_loja: $('definir_termos_instagram').first().json.tipo_loja,
      search_id: $('definir_termos_instagram').first().json.search_id,
      fonte: 'instagram',
      instagram_handle: username,
      instagram_followers: followers,
      status: 'LOCALIZADOS',
      _status_final: 'LOCALIZADOS',
      _tipo_loja: $('definir_termos_instagram').first().json.tipo_loja,
      _fonte_telefone: 'instagram_bio',
    }
  });
}

return results.length > 0 ? results : [{ json: { _empty: true } }];
```

---

### Nó E: `salvar_lead_instagram` (HTTP Request Node)

| Campo | Valor |
|-------|-------|
| **Tipo** | `n8n-nodes-base.httpRequest` |
| **typeVersion** | `4.3` |
| **Nome** | `salvar_lead_instagram` |
| **Método** | `POST` |
| **URL** | `https://4g-project.vercel.app/api/leads` |
| **onError** | `continueRegularOutput` |

**Headers:**
| Nome | Valor |
|------|-------|
| `x-api-key` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyNjkyODc2My1iOGQ5LTQ5YTAtYmY3Yy0wNGIzMmFjMmNhNTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc2MjgzNjUxfQ.gc_mgxaHzURxlIs5W0iR2RH2yIQ4BV7pEbyueJ95nGU` |
| `Content-Type` | `application/json` |

**Body (JSON raw):**
```json
{
  "empresa": "={{ $json.empresa }}",
  "telefone": "={{ $json.telefone }}",
  "website": "={{ $json.website }}",
  "cidade": "={{ $json.cidade }}",
  "estado": "={{ $json.estado }}",
  "pais": "BR",
  "status": "={{ $json._status_final }}",
  "tipo_loja": "={{ $json._tipo_loja }}",
  "fonte": "instagram",
  "instagram_handle": "={{ $json.instagram_handle }}"
}
```

**Modo de execução:** `Run Once for Each Item` (para salvar cada lead individualmente)

---

### Nó F: `finalizar_busca_instagram` (HTTP Request Node — PATCH)

| Campo | Valor |
|-------|-------|
| **Tipo** | `n8n-nodes-base.httpRequest` |
| **typeVersion** | `4.3` |
| **Nome** | `finalizar_busca_instagram` |
| **Método** | `PATCH` |
| **URL** | `={{ 'https://4g-project.vercel.app/api/searches/' + $('receber_busca_dashboard').first().json.body.search_id }}` |
| **onError** | `continueRegularOutput` |

**Headers:** mesmo `x-api-key` acima

**Body (JSON raw):**
```json
{
  "status": "CONCLUÍDA",
  "quantidade_bruta": "={{ $input.all().length }}",
  "quantidade_entregue": "={{ $input.all().filter(i => !i.json._empty).length }}",
  "num_rodadas": 1
}
```

---

## Diagrama de Conexões

```
receber_busca_dashboard
    └── verificar_reserva
            └── reserva_suficiente
                    ├── [TRUE]  → ativar_reserva → patch_reserva_concluida
                    └── [FALSE] → verificar_fonte (NOVO)
                                    ├── [TRUE: instagram]  → definir_termos_instagram
                                    │                           └── apify_instagram (Apify node)
                                    │                                   └── extrair_telefone_instagram
                                    │                                           └── salvar_lead_instagram
                                    │                                                   └── finalizar_busca_instagram
                                    └── [FALSE] → verificar_fonte_ambos (NOVO)
                                                    ├── [TRUE: ambos]  → definir_termos_instagram (branch instagram acima)
                                                    │                  └── definir_termos (branch maps abaixo)
                                                    └── [FALSE: maps]  → definir_termos
                                                                               └── Run an Actor and get dataset1
                                                                                       └── enriquecer_leads → ...
```

---

## Instruções de Importação Manual no n8n

### Opção 1 — Importar JSON parcial (recomendado)

1. Abra o fluxo no n8n: `https://n8n-pietro-n8n.gats6d.easypanel.host`
2. No canvas, pressione `Ctrl+A` para ver todos os nós
3. Clique em **...** (menu do fluxo) → **Import from JSON**
4. Cole o conteúdo do arquivo `instagram-nodes.json` (gerado junto com este arquivo)
5. Os nós novos vão aparecer no canvas — posicione-os manualmente
6. Conecte as arestas conforme o diagrama acima

### Opção 2 — Criar manualmente

1. Abra o fluxo
2. Clique em `+` para adicionar nó
3. Para cada nó (A1, A2, B, C, D, E, F), use os parâmetros da tabela acima
4. Conecte conforme o diagrama

### Passo final obrigatório — mudar a conexão da reserva

No nó `reserva_suficiente`:
- Apague a seta que vai de `[FALSE]` para `definir_termos`
- Crie nova seta de `[FALSE]` para `verificar_fonte`

---

## Observações Importantes

1. **APIFY_TOKEN:** Certifique-se que a variável de ambiente `APIFY_TOKEN` está configurada no n8n. Se não, use o valor direto da credencial Apify (já configurada no nó `Run an Actor and get dataset1`).

2. **Actor do Instagram:** O actor `apify~instagram-hashtag-scraper` funciona mas tem limitações — o Instagram bloqueia scraping com frequência. Uma alternativa mais estável é `apify~instagram-profile-scraper`. Avalie pelos resultados.

3. **Telefone no bio:** Nem todos os perfis colocam telefone no bio. A taxa de extração esperada é de 10-30% dos perfis encontrados. Para compensar, busque 5x mais do que a quantidade desejada (já está no nó C: `resultsLimit: quantidade * 5`).

4. **Caso `ambos`:** O n8n executa os dois branches em paralelo quando uma saída está conectada a dois nós. Não há problema de performance — os dois (Maps + Instagram) rodam simultaneamente.

5. **Deduplicação:** O nó D já deduplica por telefone dentro do lote Instagram. Mas pode haver duplicatas entre Maps e Instagram — a API `/api/leads` deve tratar isso (checar se já existe o telefone antes de inserir).
