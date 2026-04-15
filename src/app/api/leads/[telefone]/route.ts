import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { LeadStatus } from '@/types'

const VALID_STATUSES: LeadStatus[] = [
  'LOCALIZADOS', 'PROSPECTAR', 'PROSPECTADOS', 'INTERESSE', 'TRANSFERIDOS', 'DESCARTADOS',
]

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ telefone: string }> }
) {
  const { telefone } = await params

  // Autenticação dupla: API key (n8n) OU sessão Supabase
  const apiKey = request.headers.get('x-api-key')
  const isApiKey = apiKey && apiKey === process.env.N8N_API_KEY

  let supabase
  if (isApiKey) {
    supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  } else {
    supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { status } = body as Record<string, unknown>

  if (!status || !VALID_STATUSES.includes(status as LeadStatus)) {
    return NextResponse.json(
      { error: `Status inválido. Use: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  const { data, error: dbError } = await supabase
    .from('leads')
    .update({ status: status as LeadStatus })
    .eq('telefone', telefone)
    .select('id, empresa, telefone, status')
    .single()

  if (dbError) {
    return NextResponse.json({ error: 'Erro ao atualizar lead' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
  }

  return NextResponse.json(data)
}
