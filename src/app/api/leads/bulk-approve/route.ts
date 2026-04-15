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
    .update({ status: 'PROSPECTAR' })
    .eq('status', 'LOCALIZADOS')
    .select('id')

  if (error) {
    return NextResponse.json({ error: 'Erro ao aprovar leads em lote' }, { status: 500 })
  }

  return NextResponse.json({ updated: data?.length ?? 0 })
}
