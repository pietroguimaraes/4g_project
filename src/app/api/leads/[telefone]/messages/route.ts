import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/leads/[telefone]/messages — dashboard busca conversa (sessão) ou n8n (x-api-key)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ telefone: string }> }
) {
  const apiKey = req.headers.get('x-api-key')
  if (apiKey !== process.env.N8N_API_KEY) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { telefone } = await params

  const { data, error } = await serviceClient()
    .from('messages')
    .select('id, role, conteudo, created_at')
    .eq('telefone', decodeURIComponent(telefone))
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/leads/[telefone]/messages — n8n salva cada mensagem
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ telefone: string }> }
) {
  const apiKey = req.headers.get('x-api-key')
  if (apiKey !== process.env.N8N_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { telefone } = await params
  const body = await req.json()
  const { role, conteudo } = body as { role: string; conteudo: string }

  if (!role || !conteudo?.trim()) {
    return NextResponse.json({ error: 'role e conteudo são obrigatórios' }, { status: 400 })
  }

  const { error } = await serviceClient()
    .from('messages')
    .insert({ telefone: decodeURIComponent(telefone), role, conteudo: conteudo.trim() })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
