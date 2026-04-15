'use client'

import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { updateLeadStatus } from '@/lib/api/leads'
import type { Lead, LeadCategoria } from '@/types'

interface KanbanCardProps {
  lead: Lead
  borderColor: string
}

const CATEGORIA_BADGE: Record<LeadCategoria, { label: string; color: string }> = {
  'DOMÉSTICOS': { label: 'Domésticos', color: 'bg-blue-100 text-blue-700' },
  'ESPORTIVOS': { label: 'Esportivos', color: 'bg-green-100 text-green-700' },
  'MISTO': { label: 'Misto', color: 'bg-yellow-100 text-yellow-700' },
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

export function KanbanCard({ lead, borderColor }: KanbanCardProps) {
  const [transferring, setTransferring] = useState(false)
  const isDraggable = lead.status !== 'TRANSFERIDOS'

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.telefone,
    disabled: !isDraggable,
    data: { lead },
  })

  const badge = lead.categoria ? CATEGORIA_BADGE[lead.categoria] : null

  async function handleTransfer() {
    setTransferring(true)
    try {
      await updateLeadStatus(lead.telefone, 'TRANSFERIDOS')
    } catch {
      // erro tratado via Realtime — card não se move se API falhar
    } finally {
      setTransferring(false)
    }
  }

  return (
    <div
      ref={setNodeRef}
      {...(isDraggable ? { ...listeners, ...attributes } : {})}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className={`bg-white rounded-lg border border-gray-200 border-l-4 ${borderColor} p-3 shadow-sm ${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''} select-none`}
    >
      <p className="font-semibold text-gray-900 text-sm truncate">{lead.empresa}</p>
      <p className="text-gray-500 text-xs mt-1">{lead.telefone}</p>
      {lead.cidade && <p className="text-gray-400 text-xs">{lead.cidade}</p>}

      <div className="flex items-center justify-between mt-2">
        {badge ? (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
            {badge.label}
          </span>
        ) : (
          <span />
        )}
        <span className="text-xs text-gray-400">
          {lead.nota != null ? `★ ${lead.nota}/10` : 'Sem nota'}
        </span>
      </div>

      <p className="text-gray-300 text-xs mt-1">{formatDate(lead.data_coleta)}</p>

      {lead.status === 'INTERESSE' && (
        <button
          onClick={handleTransfer}
          disabled={transferring}
          className="mt-2 w-full text-xs bg-green-600 text-white rounded px-2 py-1 hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {transferring ? 'Transferindo...' : 'Transferir para Closer'}
        </button>
      )}
    </div>
  )
}
