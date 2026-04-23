import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { LeadStatus } from '@/types'

const VALID_STATUSES: LeadStatus[] = [
  'LOCALIZADOS', 'PROSPECTAR', 'PROSPECTADOS', 'INTERESSE', 'TRANSFERIDOS', 'DESCARTADOS', 'NAO_RESPONDERAM',
]

export async function POST(request: NextRequest) {
  // Autenticação dupla: API key (n8n) OU sessão Supabase (Anderson)
  const apiKey = request.headers.get('x-api-key')
  const isApiKey = apiKey && apiKey === process.env.N8N_API_KEY

  let supabase
  if (isApiKey) {
    // n8n usa service role para bypass de RLS
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

  const { empresa, telefone, website, cidade, estado, pais, search_id, status, manual } = body as Record<string, unknown>

  if (!empresa || !telefone) {
    return NextResponse.json({ error: 'Campos obrigatórios: empresa, telefone' }, { status: 400 })
  }

  const leadStatus: LeadStatus = (status && VALID_STATUSES.includes(status as LeadStatus))
    ? (status as LeadStatus)
    : 'LOCALIZADOS'

  const { data, error: dbError } = await supabase
    .from('leads')
    .upsert(
      {
        empresa: String(empresa),
        telefone: String(telefone),
        website: website ? String(website) : null,
        cidade: cidade ? String(cidade) : null,
        estado: estado ? String(estado) : null,
        pais: pais ? String(pais) : null,
        search_id: search_id ? String(search_id) : null,
        status: leadStatus,
        manual: manual === true,
      },
      { onConflict: 'telefone', ignoreDuplicates: true }
    )
    .select('id, empresa, telefone, status, manual')
    .single()

  if (dbError) {
    return NextResponse.json({ error: 'Erro ao salvar lead' }, { status: 500 })
  }

  // Dispara webhook do n8n quando lead é criado diretamente em PROSPECTADOS
  if (leadStatus === 'PROSPECTADOS') {
    const prospectuarUrl = process.env.N8N_PROSPECTAR_URL
    if (prospectuarUrl) {
      fetch(prospectuarUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: String(telefone), empresa: String(empresa) }),
      }).catch(() => {})
    }
  }

  return NextResponse.json(data, { status: 201 })
}

export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const statuses = searchParams.get('statuses')

  let query = supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(500)
  if (statuses) {
    query = query.in('status', statuses.split(','))
  } else if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: 'Erro ao buscar leads' }, { status: 500 })
  }

  return NextResponse.json(data)
}
