import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const TRIAL_MAX_SEARCHES = 3
const TRIAL_QUANTITY = 5

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { count } = await supabase
    .from('searches')
    .select('*', { count: 'exact', head: true })

  return NextResponse.json({ count: count ?? 0 })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // Limite do período de teste
  const { count: searchCount } = await supabase
    .from('searches')
    .select('*', { count: 'exact', head: true })
  if ((searchCount ?? 0) >= TRIAL_MAX_SEARCHES) {
    return NextResponse.json({ error: 'Limite de buscas do período de teste atingido.' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { pais, estado, cidade, tipo_loja } = body as Record<string, unknown>

  if (!pais || !estado || !cidade || !tipo_loja) {
    return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 })
  }

  // Quantidade fixa no período de teste
  const qty = TRIAL_QUANTITY

  const { data: search, error: dbError } = await supabase
    .from('searches')
    .insert({
      pais: String(pais),
      estado: String(estado),
      cidade: String(cidade),
      quantidade: qty,
      tipo_loja: String(tipo_loja),
      status: 'PENDENTE',
    })
    .select('id')
    .single()

  if (dbError) {
    return NextResponse.json({ error: 'Erro ao salvar busca' }, { status: 500 })
  }

  const webhookUrl = process.env.N8N_WEBHOOK_URL
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          search_id: search.id,
          pais: String(pais),
          estado: String(estado),
          cidade: String(cidade),
          quantidade: qty,
          tipo_loja: String(tipo_loja),
        }),
      })
    } catch {
      // Webhook falhou mas busca já foi salva — não bloquear o usuário
    }
  }

  return NextResponse.json({ id: search.id, status: 'PENDENTE' }, { status: 201 })
}
