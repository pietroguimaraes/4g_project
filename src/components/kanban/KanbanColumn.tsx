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
      className={`rounded-xl border-t-4 ${headerColor} shadow-lg flex flex-col transition-colors ${isOver ? 'bg-gray-800' : 'bg-gray-900'}`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h2 className="font-semibold text-sm text-gray-100">{title}</h2>
        <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full font-medium">
          {leads.length}
        </span>
      </div>
      <div className="flex flex-col gap-2 p-3 flex-1 min-h-[80px]">
        {leads.length === 0 ? (
          <p className="text-gray-500 text-xs">Nenhum lead nesta etapa.</p>
        ) : (
          leads.map((lead) => (
            <KanbanCard key={lead.id} lead={lead} borderColor={borderColor} onDeleted={onLeadDeleted} isPequenos={isPequenos} />
          ))
        )}
      </div>
    </div>
  )
}
