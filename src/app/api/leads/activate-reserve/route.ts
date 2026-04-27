import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Endpoint exclusivo para o n8n: ativa leads da RESERVA → LOCALIZADOS
// Body: { cidade, tipo_loja, quantidade }
// Retorna os leads ativados

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.N8N_API_KEY) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { cidade, tipo_loja, quantidade } = body as Record<string, unknown>
  if (!cidade || !tipo_loja || quantidade === undefined) {
    return NextResponse.json({ error: 'Campos obrigatórios: cidade, tipo_loja, quantidade' }, { status: 400 })
  }

  const qty = Number(quantidade)
  const supabase = getServiceClient()

  // Buscar os primeiros N leads em RESERVA para essa cidade+tipo_loja
  const { data: reservaLeads, error: fetchError } = await supabase
    .from('leads')
    .select('id')
    .eq('status', 'RESERVA')
    .ilike('cidade', String(cidade))
    .eq('tipo_loja', String(tipo_loja))
    .order('created_at', { ascending: true })
    .limit(qty)

  if (fetchError) {
    return NextResponse.json({ error: 'Erro ao buscar reserva' }, { status: 500 })
  }

  if (!reservaLeads || reservaLeads.length === 0) {
    return NextResponse.json({ ativados: 0, leads: [] })
  }

  const ids = reservaLeads.map(l => l.id)

  // Mudar status de RESERVA → LOCALIZADOS
  const { data: ativados, error: updateError } = await supabase
    .from('leads')
    .update({ status: 'LOCALIZADOS', updated_at: new Date().toISOString() })
    .in('id', ids)
    .select('id, empresa, telefone, cidade, status')

  if (updateError) {
    return NextResponse.json({ error: 'Erro ao ativar reserva' }, { status: 500 })
  }

  return NextResponse.json({ ativados: ativados?.length ?? 0, leads: ativados })
}
