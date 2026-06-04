import type { Lead } from '@/types'

const CATEGORIA_BADGE: Record<string, { label: string; color: string }> = {
  'SUPERMERCADO':  { label: 'Supermercado',  color: 'bg-blue-100 text-blue-700' },
  'ATACADISTA':    { label: 'Atacadista',    color: 'bg-green-100 text-green-700' },
  'DISTRIBUIDORA': { label: 'Distribuidora', color: 'bg-yellow-100 text-yellow-700' },
}

interface LeadCardProps {
  lead: Lead
}

export function LeadCard({ lead }: LeadCardProps) {
  const badge = lead.categoria ? CATEGORIA_BADGE[lead.categoria] : null
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <p className="font-semibold text-gray-900 text-sm truncate">{lead.empresa}</p>
      {badge && (
        <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
          {badge.label}
        </span>
      )}
      <p className="text-gray-500 text-xs mt-1">{lead.telefone}</p>
      {lead.cidade && (
        <p className="text-gray-400 text-xs mt-0.5">{lead.cidade}</p>
      )}
    </div>
  )
}
