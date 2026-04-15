'use client'

import { useState } from 'react'
import { DndContext, DragEndEvent } from '@dnd-kit/core'
import { useKanban } from '@/hooks/useKanban'
import { KanbanColumn } from '@/components/kanban/KanbanColumn'
import { updateLeadStatus } from '@/lib/api/leads'
import type { Lead, LeadStatus } from '@/types'

const COLUNAS = [
  { status: 'PROSPECTADOS' as const, titulo: 'Prospectados', headerColor: 'border-blue-400', borderColor: 'border-l-blue-400' },
  { status: 'INTERESSE' as const, titulo: 'Interesse', headerColor: 'border-orange-400', borderColor: 'border-l-orange-400' },
  { status: 'TRANSFERIDOS' as const, titulo: 'Transferidos', headerColor: 'border-green-400', borderColor: 'border-l-green-400' },
  { status: 'DESCARTADOS' as const, titulo: 'Descartados', headerColor: 'border-gray-400', borderColor: 'border-l-gray-400' },
]

export default function KanbanPage() {
  const { kanban, loading } = useKanban()
  const [localKanban, setLocalKanban] = useState<typeof kanban | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const displayKanban = localKanban ?? kanban

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const telefone = active.id as string
    const newStatus = over.id as LeadStatus
    const lead = active.data.current?.lead as Lead | undefined
    if (!lead) return

    const oldStatus = lead.status
    if (oldStatus === newStatus) return

    // Optimistic update
    setLocalKanban((prev) => {
      const base = prev ?? kanban
      const fromList = base[oldStatus].filter((l) => l.telefone !== telefone)
      const toList = [{ ...lead, status: newStatus }, ...base[newStatus]]
      return { ...base, [oldStatus]: fromList, [newStatus]: toList }
    })

    try {
      await updateLeadStatus(telefone, newStatus)
      setErro(null)
    } catch {
      // Reverter
      setLocalKanban((prev) => {
        const base = prev ?? kanban
        const fromList = base[newStatus].filter((l) => l.telefone !== telefone)
        const toList = [lead, ...base[oldStatus]]
        return { ...base, [newStatus]: fromList, [oldStatus]: toList }
      })
      setErro('Não foi possível mover o lead. Tente novamente.')
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Kanban de Funil</h1>
        <p className="text-gray-400 text-sm">Carregando leads...</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Kanban de Funil</h1>
      {erro && <p className="text-red-600 text-sm mb-4">{erro}</p>}
      <DndContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUNAS.map((col) => (
            <KanbanColumn
              key={col.status}
              status={col.status}
              title={col.titulo}
              leads={displayKanban[col.status]}
              headerColor={col.headerColor}
              borderColor={col.borderColor}
            />
          ))}
        </div>
      </DndContext>
    </div>
  )
}
