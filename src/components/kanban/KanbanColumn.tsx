import type { Lead } from '@/types'
import { KanbanCard } from './KanbanCard'

interface KanbanColumnProps {
  title: string
  leads: Lead[]
  borderColor: string
  headerColor: string
}

export function KanbanColumn({ title, leads, borderColor, headerColor }: KanbanColumnProps) {
  return (
    <div className={`bg-white rounded-lg border-t-4 ${headerColor} shadow-sm flex flex-col`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-sm text-gray-700">{title}</h2>
        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
          {leads.length}
        </span>
      </div>
      <div className="flex flex-col gap-2 p-3 flex-1">
        {leads.length === 0 ? (
          <p className="text-gray-400 text-xs">Nenhum lead nesta etapa.</p>
        ) : (
          leads.map((lead) => (
            <KanbanCard key={lead.id} lead={lead} borderColor={borderColor} />
          ))
        )}
      </div>
    </div>
  )
}
