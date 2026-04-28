import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Endpoint para o n8n verificar a reserva antes de chamar o Apify
// Sempre retorna 1 item JSON (nunca array) para o n8n não parar o fluxo
// GET /api/leads/reserve-count?cidade=X&tipo_loja=Y

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.N8N_API_KEY) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const cidade = searchParams.get('cidade')
  const tipo_loja = searchParams.get('tipo_loja')

  if (!cidade || !tipo_loja) {
    return NextResponse.json({ count: 0, leads: [] })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase
    .from('leads')
    .select('id, empresa, telefone, cidade, tipo_loja')
    .eq('status', 'RESERVA')
    .ilike('cidade', cidade)
    .eq('tipo_loja', tipo_loja)
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) {
    return NextResponse.json({ count: 0, leads: [] })
  }

  return NextResponse.json({ count: data?.length ?? 0, leads: data ?? [] })
}
