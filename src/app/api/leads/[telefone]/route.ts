import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { LeadStatus, LeadCategoria } from '@/types'

const VALID_CATEGORIAS: LeadCategoria[] = ['SUPERMERCADO', 'ATACADISTA', 'DISTRIBUIDORA']

const VALID_STATUSES: LeadStatus[] = [
  'LOCALIZADOS', 'PROSPECTAR', 'PROSPECTADOS', 'INTERESSE', 'TRANSFERIDOS', 'DESCARTADOS', 'NAO_RESPONDERAM', 'PEQUENOS',
]

// GET /api/leads/[telefone] — n8n busca tipo_loja para selecionar catálogo
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ telefone: string }> }
) {
  const apiKey = request.headers.get('x-api-key')
  if (apiKey !== process.env.N8N_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { telefone } = await params
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data } = await supabase
    .from('leads')
    .select('id, empresa, telefone, tipo_loja, categoria, status')
    .eq('telefone', decodeURIComponent(telefone))
    .single()

  // Retorna dados do lead ou objeto vazio — nunca retorna erro para não travar o n8n
  return NextResponse.json(data ?? { tipo_loja: null })
}

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

  const { status, categoria, nota, data_resposta, data_followup, qtd_reengajamentos, pequeno } = body as Record<string, unknown>

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
    .select('id, empresa, telefone, status, email')
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

  // Envia email de prospecção quando lead é aprovado no painel
  if (status === 'PROSPECTAR') {
    const resendKey = process.env.RESEND_API_KEY
    const leadEmail = (data as Record<string, unknown>).email as string | null
    if (resendKey && leadEmail) {
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? 'onboarding@resend.dev',
          to: [leadEmail],
          subject: `Proposta de distribuição de pizza — ${data!.empresa}`,
          html: buildProspeccaoEmail(String(data!.empresa)),
        }),
      }).catch(() => {}) // Fire-and-forget, nao bloqueia o response
    }
  }

  // Dispara webhook do n8n quando lead entra em PROSPECTADOS (novo ou follow-up)
  if (status === 'PROSPECTADOS') {
    const prospectuarUrl = process.env.N8N_PROSPECTAR_URL
    if (prospectuarUrl) {
      try {
        await fetch(prospectuarUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telefone: data.telefone, empresa: data.empresa }),
        })
      } catch {
        // Webhook falhou mas status já foi atualizado — segue em frente
      }
    }
  }

  // Dispara webhook do n8n quando lead é transferido para Anderson
  // pequeno=true → mensagem diferente indicando cliente pequeno (< R$3k)
  if (status === 'TRANSFERIDOS') {
    const transferirUrl = process.env.N8N_TRANSFERIR_URL
    if (transferirUrl) {
      try {
        await fetch(transferirUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telefone: data.telefone,
            empresa: data.empresa,
            pequeno: pequeno === true,
          }),
        })
      } catch {
        // Webhook falhou mas status já foi atualizado — segue em frente
      }
    }
  }

  return NextResponse.json(data)
}

function buildProspeccaoEmail(empresa: string): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h2 style="color: #c0392b;">Proposta de parceria — Pizza Premium</h2>
  <p>Ol&aacute;, equipe da <strong>${empresa}</strong>,</p>
  <p>Meu nome &eacute; Victor e represento uma distribuidora especializada em pizzas congeladas e resfriadas, com atua&ccedil;&atilde;o em SP, PR, RS e SC.</p>
  <p><strong>Por que trabalhar com a gente?</strong></p>
  <ul>
    <li>Pizza congelada e resfriada em m&uacute;ltiplos sabores e formatos</li>
    <li>Entregas programadas com prazo garantido</li>
    <li>Condi&ccedil;&otilde;es especiais para redes e supermercados</li>
    <li>Alta margem para o ponto de venda</li>
  </ul>
  <p>Gostaria de agendar uma conversa r&aacute;pida para apresentar nosso cat&aacute;logo e condi&ccedil;&otilde;es comerciais.</p>
  <p>Responda este email ou entre em contato para agendarmos.</p>
  <br>
  <p>Atenciosamente,<br><strong>Victor</strong><br>Distribuidora de Pizza</p>
</body>
</html>`
}
