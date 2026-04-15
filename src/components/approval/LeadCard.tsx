import type { Lead } from '@/types'

interface LeadCardProps {
  lead: Lead
}

export function LeadCard({ lead }: LeadCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <p className="font-semibold text-gray-900 text-sm truncate">{lead.empresa}</p>
      <p className="text-gray-500 text-xs mt-1">{lead.telefone}</p>
      {lead.cidade && (
        <p className="text-gray-400 text-xs mt-0.5">{lead.cidade}</p>
      )}
    </div>
  )
}
