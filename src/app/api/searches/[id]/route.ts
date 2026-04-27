import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function isApiKeyValid(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  return apiKey && apiKey === process.env.N8N_API_KEY
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Auth: sessão Supabase (dashboard) OU API key (n8n)
  if (isApiKeyValid(request)) {
    const supabase = getServiceClient()
    const { data, error } = await supabase
      .from('searches')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Busca não encontrada' }, { status: 404 })
    }
    return NextResponse.json(data)
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('searches')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Busca não encontrada' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Auth: API key (n8n) OU sessão Supabase
  const useServiceRole = isApiKeyValid(request)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { status, quantidade_bruta, quantidade_entregue, num_rodadas } = body as Record<string, unknown>

  const updates: Record<string, unknown> = {}
  if (status !== undefined) {
    const validStatuses = ['PENDENTE', 'CONCLUÍDA', 'ERRO']
    if (!validStatuses.includes(String(status))) {
      return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
    }
    updates.status = String(status)
  }
  if (quantidade_bruta !== undefined) updates.quantidade_bruta = Number(quantidade_bruta)
  if (quantidade_entregue !== undefined) updates.quantidade_entregue = Number(quantidade_entregue)
  if (num_rodadas !== undefined) updates.num_rodadas = Number(num_rodadas)

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
  }

  if (useServiceRole) {
    const supabase = getServiceClient()
    const { data, error } = await supabase
      .from('searches')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Erro ao atualizar busca' }, { status: 500 })
    }
    return NextResponse.json(data)
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('searches')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Erro ao atualizar busca' }, { status: 500 })
  }

  return NextResponse.json(data)
}
