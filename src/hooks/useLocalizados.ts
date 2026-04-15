'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getLeadsByStatus } from '@/lib/api/leads'
import type { Lead } from '@/types'

export function useLocalizados() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getLeadsByStatus('LOCALIZADOS')
      .then(setLeads)
      .finally(() => setLoading(false))

    const supabase = createClient()
    const channel = supabase
      .channel('leads-localizados')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads', filter: 'status=eq.LOCALIZADOS' },
        (payload) => {
          setLeads((prev) => [payload.new as Lead, ...prev])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { leads, count: leads.length, loading }
}
