'use client'

import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { updateLeadStatus } from '@/lib/api/leads'
import type { Lead, LeadCategoria } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

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

      <div className="mt-2 flex gap-1">
        <Dialog>
          <DialogTrigger asChild>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 text-xs bg-gray-100 text-gray-600 rounded px-2 py-1 hover:bg-gray-200 transition-colors"
            >
              Ver dados
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{lead.empresa}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-gray-500">Telefone</span>
              <span className="text-gray-800">{lead.telefone}</span>
              {lead.website && <>
                <span className="text-gray-500">Website</span>
                <span className="text-gray-800 truncate">{lead.website}</span>
              </>}
              {lead.cidade && <>
                <span className="text-gray-500">Cidade</span>
                <span className="text-gray-800">{lead.cidade}</span>
              </>}
              {lead.estado && <>
                <span className="text-gray-500">Estado</span>
                <span className="text-gray-800">{lead.estado}</span>
              </>}
              {lead.pais && <>
                <span className="text-gray-500">País</span>
                <span className="text-gray-800">{lead.pais}</span>
              </>}
              <span className="text-gray-500">Status</span>
              <span className="text-gray-800">{lead.status}</span>
              {lead.categoria && <>
                <span className="text-gray-500">Categoria</span>
                <span className="text-gray-800">{lead.categoria}</span>
              </>}
              {lead.nota != null && <>
                <span className="text-gray-500">Nota</span>
                <span className="text-gray-800">★ {lead.nota}/10</span>
              </>}
              <span className="text-gray-500">Coleta</span>
              <span className="text-gray-800">{formatDate(lead.data_coleta)}</span>
              {lead.data_resposta && <>
                <span className="text-gray-500">Resposta</span>
                <span className="text-gray-800">{formatDate(lead.data_resposta)}</span>
              </>}
              {lead.data_followup && <>
                <span className="text-gray-500">Follow-up</span>
                <span className="text-gray-800">{formatDate(lead.data_followup)}</span>
              </>}
              {lead.qtd_reengajamentos > 0 && <>
                <span className="text-gray-500">Reengajamentos</span>
                <span className="text-gray-800">{lead.qtd_reengajamentos}</span>
              </>}
            </div>
          </DialogContent>
        </Dialog>

        {lead.status === 'INTERESSE' && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); handleTransfer() }}
            disabled={transferring}
            className="flex-1 text-xs bg-green-600 text-white rounded px-2 py-1 hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {transferring ? 'Transferindo...' : 'Transferir'}
          </button>
        )}
      </div>
    </div>
  )
}
