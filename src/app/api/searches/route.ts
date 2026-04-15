import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  const { pais, estado, cidade, quantidade } = body as Record<string, unknown>

  if (!pais || !estado || !cidade || quantidade === undefined) {
    return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 })
  }

  const qty = Number(quantidade)
  if (!Number.isInteger(qty) || qty < 1 || qty > 100) {
    return NextResponse.json({ error: 'Quantidade deve ser entre 1 e 100' }, { status: 400 })
  }

  const { data: search, error: dbError } = await supabase
    .from('searches')
    .insert({
      pais: String(pais),
      estado: String(estado),
      cidade: String(cidade),
      quantidade: qty,
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
        }),
      })
    } catch {
      // Webhook falhou mas busca já foi salva — não bloquear o usuário
    }
  }

  return NextResponse.json({ id: search.id, status: 'PENDENTE' }, { status: 201 })
}
