'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Lead, LeadStatus } from '@/types'

const KANBAN_STATUSES: LeadStatus[] = ['PROSPECTADOS', 'NAO_RESPONDERAM', 'INTERESSE', 'TRANSFERIDOS', 'DESCARTADOS']

type KanbanMap = Record<LeadStatus, Lead[]>

function emptyMap(): KanbanMap {
  return {
    LOCALIZADOS: [],
    PROSPECTAR: [],
    PROSPECTADOS: [],
    NAO_RESPONDERAM: [],
    INTERESSE: [],
    TRANSFERIDOS: [],
    DESCARTADOS: [],
    RESERVA: [],
  }
}

function groupByStatus(leads: Lead[]): KanbanMap {
  const map = emptyMap()
  for (const lead of leads) {
    if (map[lead.status]) {
      map[lead.status].push(lead)
    }
  }
  return map
}

export function useKanban() {
  const [kanban, setKanban] = useState<KanbanMap>(emptyMap())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/leads?statuses=${KANBAN_STATUSES.join(',')}`)
      .then((r) => r.json())
      .then((leads: Lead[]) => setKanban(groupByStatus(leads)))
      .finally(() => setLoading(false))

    const supabase = createClient()
    const channel = supabase
      .channel('kanban-leads')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const lead = payload.new as Lead
            setKanban((prev) => ({
              ...prev,
              [lead.status]: [lead, ...prev[lead.status]],
            }))
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Lead
            const old = payload.old as { status: LeadStatus; id: string }
            setKanban((prev) => {
              const oldStatus = old.status
              const newStatus = updated.status
              const fromList = prev[oldStatus].filter((l) => l.id !== updated.id)
              const toList = oldStatus === newStatus
                ? prev[newStatus].map((l) => (l.id === updated.id ? updated : l))
                : [updated, ...prev[newStatus]]
              return {
                ...prev,
                [oldStatus]: fromList,
                [newStatus]: toList,
              }
            })
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id
            // Realtime não envia status no DELETE — busca em todas as colunas
            setKanban((prev) => {
              const next = { ...prev }
              for (const status of Object.keys(next) as LeadStatus[]) {
                next[status] = next[status].filter((l) => l.id !== deletedId)
              }
              return next
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { kanban, loading, KANBAN_STATUSES }
}
