'use client'

import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { updateLeadStatus, deleteLead } from '@/lib/api/leads'
import type { Lead, LeadCategoria } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface KanbanCardProps {
  lead: Lead
  borderColor: string
  onDeleted: (id: string) => void
  isPequenos?: boolean
}

const CATEGORIA_BADGE: Record<LeadCategoria, { label: string; color: string }> = {
  'DOMÉSTICOS': { label: 'Domésticos', color: 'bg-blue-100 text-blue-700' },
  'ESPORTIVOS': { label: 'Esportivos', color: 'bg-green-100 text-green-700' },
  'MISTO': { label: 'Misto', color: 'bg-yellow-100 text-yellow-700' },
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

export function KanbanCard({ lead, borderColor, onDeleted, isPequenos }: KanbanCardProps) {
  const [transferring, setTransferring] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const isDraggable = lead.status !== 'TRANSFERIDOS'

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.telefone,
    disabled: !isDraggable,
    data: { lead },
  })

  const badge = lead.categoria ? CATEGORIA_BADGE[lead.categoria] : null

  async function handleTransfer(pequeno = false) {
    setTransferring(true)
    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(lead.telefone)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'TRANSFERIDOS', pequeno }),
      })
      if (!response.ok) throw new Error()
    } catch {
      // erro tratado via Realtime
    } finally {
      setTransferring(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteLead(lead.telefone)
      onDeleted(lead.id)
    } catch {
      setDeleting(false)
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
      {lead.manual && (
        <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">
          Manual
        </span>
      )}

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
          <DialogContent showCloseButton={false} className="max-w-sm">
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
                <span className="text-gray-800">{badge?.label ?? lead.categoria}</span>
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
            <DialogFooter className="flex-row gap-2 justify-between">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    disabled={deleting}
                    className="text-xs text-red-600 border border-red-200 rounded px-3 py-1.5 hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    {deleting ? 'Excluindo...' : 'Excluir lead'}
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir {lead.empresa}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Este lead será removido permanentemente do CRM. Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <DialogClose asChild>
                <button className="text-xs bg-gray-100 text-gray-700 rounded px-3 py-1.5 hover:bg-gray-200 transition-colors">
                  Fechar
                </button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {lead.status === 'INTERESSE' && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); handleTransfer(false) }}
            disabled={transferring}
            className="flex-1 text-xs bg-green-600 text-white rounded px-2 py-1 hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {transferring ? 'Transferindo...' : 'Transferir'}
          </button>
        )}

        {isPequenos && lead.status === 'PEQUENOS' && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); handleTransfer(true) }}
            disabled={transferring}
            className="flex-1 text-xs bg-purple-600 text-white rounded px-2 py-1 hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {transferring ? 'Transferindo...' : 'Transferir'}
          </button>
        )}
      </div>
    </div>
  )
}
