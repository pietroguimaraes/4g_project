'use client'

import { useDroppable } from '@dnd-kit/core'
import type { Lead } from '@/types'
import { KanbanCard } from './KanbanCard'

interface KanbanColumnProps {
  status: string
  title: string
  leads: Lead[]
  borderColor: string
  headerColor: string
  onLeadDeleted: (id: string) => void
  isPequenos?: boolean
}

export function KanbanColumn({ status, title, leads, borderColor, headerColor, onLeadDeleted, isPequenos }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border-t-4 ${headerColor} shadow-sm flex flex-col transition-colors ${isOver ? 'bg-gray-50' : 'bg-white'}`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-sm text-gray-700">{title}</h2>
        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
          {leads.length}
        </span>
      </div>
      <div className="flex flex-col gap-2 p-3 flex-1 min-h-[80px]">
        {leads.length === 0 ? (
          <p className="text-gray-400 text-xs">Nenhum lead nesta etapa.</p>
        ) : (
          leads.map((lead) => (
            <KanbanCard key={lead.id} lead={lead} borderColor={borderColor} onDeleted={onLeadDeleted} isPequenos={isPequenos} />
          ))
        )}
      </div>
    </div>
  )
}
