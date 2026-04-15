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
  const badge = lead.categoria ? CATEGORIA_BADGE[lead.categoria] : null

  return (
    <div className={`bg-white rounded-lg border border-gray-200 border-l-4 ${borderColor} p-3 shadow-sm`}>
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
    </div>
  )
}
