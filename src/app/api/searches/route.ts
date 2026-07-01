import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { pais, estado, cidade, tipo_loja, quantidade, fonte, municipio_id, bairro, min_funcionarios } = body as Record<string, unknown>

  const isLinkedIn = fonte === 'linkedin'

  if (!isLinkedIn && (!pais || !estado || !cidade || !tipo_loja)) {
    return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 })
  }

  const qty = quantidade ? Number(quantidade) : 10
  const minFunc = min_funcionarios ? Number(min_funcionarios) : 0
  const fonteValida = (['google_maps', 'instagram', 'ambos', 'linkedin'] as const).includes(fonte as 'google_maps' | 'instagram' | 'ambos' | 'linkedin')
    ? (fonte as 'google_maps' | 'instagram' | 'ambos' | 'linkedin')
    : 'google_maps'

  const { data: search, error: dbError } = await supabase
    .from('searches')
    .insert({
      pais: isLinkedIn ? 'Brasil' : String(pais),
      estado: isLinkedIn ? 'Nacional' : String(estado),
      cidade: isLinkedIn ? 'Nacional' : String(cidade),
      quantidade: qty,
      tipo_loja: isLinkedIn ? 'linkedin' : String(tipo_loja),
      fonte: fonteValida,
      status: 'PENDENTE',
      municipio_id: municipio_id ? Number(municipio_id) : null,
      bairro: bairro ? String(bairro) : null,
      min_funcionarios: minFunc,
    })
    .select('id')
    .single()

  if (dbError) {
    return NextResponse.json({ error: 'Erro ao salvar busca' }, { status: 500 })
  }

  const webhookUrl = isLinkedIn
    ? process.env.N8N_WEBHOOK_LINKEDIN_URL
    : process.env.N8N_WEBHOOK_URL

  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          search_id: search.id,
          pais: isLinkedIn ? 'Brasil' : String(pais),
          estado: isLinkedIn ? 'Nacional' : String(estado),
          cidade: isLinkedIn ? 'Nacional' : String(cidade),
          quantidade: qty,
          tipo_loja: isLinkedIn ? 'linkedin' : String(tipo_loja),
          fonte: fonteValida,
          municipio_id: municipio_id ? Number(municipio_id) : null,
          bairro: bairro ? String(bairro) : null,
          min_funcionarios: minFunc,
        }),
      })
    } catch {
      // Webhook falhou mas busca já foi salva — não bloquear o usuário
    }
  }

  return NextResponse.json({ id: search.id, status: 'PENDENTE' }, { status: 201 })
}
