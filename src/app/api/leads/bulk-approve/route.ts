import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('leads')
    .update({ status: 'PROSPECTADOS' })
    .eq('status', 'LOCALIZADOS')
    .select('id, telefone, empresa')

  if (error) {
    return NextResponse.json({ error: 'Erro ao aprovar leads em lote' }, { status: 500 })
  }

  // Dispara webhook do n8n para cada lead aprovado
  const prospectuarUrl = process.env.N8N_PROSPECTAR_URL
  if (prospectuarUrl && data?.length) {
    for (const lead of data) {
      fetch(prospectuarUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: lead.telefone, empresa: lead.empresa }),
      }).catch(() => {})
    }
  }

  return NextResponse.json({ updated: data?.length ?? 0 })
}
