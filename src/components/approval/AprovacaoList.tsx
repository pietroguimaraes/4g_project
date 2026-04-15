'use client'

import { useLocalizados } from '@/hooks/useLocalizados'
import { LeadCard } from './LeadCard'

export function AprovacaoList() {
  const { leads, count, loading } = useLocalizados()

  if (loading) {
    return <p className="text-gray-400 text-sm">Carregando empresas...</p>
  }

  return (
    <div>
      <p className="text-sm text-gray-600 mb-4 font-medium">
        {count > 0 ? `${count} empresa${count > 1 ? 's' : ''} aguardando revisão` : 'Nenhuma empresa para revisar no momento.'}
      </p>
      {count > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      )}
    </div>
  )
}
