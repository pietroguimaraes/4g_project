import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { LeadStatus, LeadCategoria } from '@/types'

const VALID_CATEGORIAS: LeadCategoria[] = ['DOMÉSTICOS', 'ESPORTIVOS', 'MISTO']

const VALID_STATUSES: LeadStatus[] = [
  'LOCALIZADOS', 'PROSPECTAR', 'PROSPECTADOS', 'INTERESSE', 'TRANSFERIDOS', 'DESCARTADOS', 'NAO_RESPONDERAM',
]

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ telefone: string }> }
) {
  const { telefone } = await params

  // Verifica sessão do usuário
  const supabaseUser = await createClient()
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // Usa service role para garantir que o DELETE não seja bloqueado por RLS
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('telefone', telefone)

  if (error) {
    return NextResponse.json({ error: 'Erro ao excluir lead' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

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

  const { status, categoria, nota, data_resposta, data_followup, qtd_reengajamentos } = body as Record<string, unknown>

  if (!status || !VALID_STATUSES.includes(status as LeadStatus)) {
    return NextResponse.json(
      { error: `Status inválido. Use: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  const updates: Record<string, unknown> = {
    status: status as LeadStatus,
    updated_at: new Date().toISOString(),
  }

  if (categoria && VALID_CATEGORIAS.includes(categoria as LeadCategoria)) {
    updates.categoria = categoria as LeadCategoria
  }

  if (nota !== undefined && nota !== null) {
    const notaNum = parseInt(String(nota), 10)
    if (!isNaN(notaNum) && notaNum >= 0 && notaNum <= 10) {
      updates.nota = notaNum
    }
  }

  if (data_resposta) {
    const parsed = new Date(data_resposta as string)
    if (!isNaN(parsed.getTime())) {
      updates.data_resposta = parsed.toISOString()
    }
  }

  if (data_followup) {
    const parsed = new Date(data_followup as string)
    if (!isNaN(parsed.getTime())) {
      updates.data_followup = parsed.toISOString()
    }
  }

  if (qtd_reengajamentos !== undefined && qtd_reengajamentos !== null) {
    const qtd = parseInt(String(qtd_reengajamentos), 10)
    if (!isNaN(qtd) && qtd >= 0 && qtd <= 32767) {
      updates.qtd_reengajamentos = qtd
    }
  }

  const { data, error: dbError } = await supabase
    .from('leads')
    .update(updates)
    .eq('telefone', telefone)
    .select('id, empresa, telefone, status')
    .single()

  if (dbError) {
    console.error('[PATCH /api/leads] Supabase error:', dbError.code, dbError.message)
    if (dbError.code === 'PGRST116') {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Erro ao atualizar lead' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
  }

  // Dispara webhook do n8n quando lead entra em PROSPECTADOS (novo ou follow-up)
  if (status === 'PROSPECTADOS') {
    const prospectuarUrl = process.env.N8N_PROSPECTAR_URL
    if (prospectuarUrl) {
      fetch(prospectuarUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: data.telefone, empresa: data.empresa }),
      }).catch(() => {})
    }
  }

  return NextResponse.json(data)
}
