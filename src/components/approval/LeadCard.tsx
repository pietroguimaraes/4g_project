import type { Lead } from '@/types'

function formatarCNPJ(cnpj: string) {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

const CATEGORIA_BADGE: Record<string, { label: string; color: string }> = {
  'SUPERMERCADO':  { label: 'Supermercado',  color: 'bg-blue-100 text-blue-700' },
  'ATACADISTA':    { label: 'Atacadista',    color: 'bg-green-100 text-green-700' },
  'DISTRIBUIDORA': { label: 'Distribuidora', color: 'bg-yellow-100 text-yellow-700' },
}

const FONTE_BADGE: Record<string, { label: string; color: string }> = {
  'ia_pessoal':    { label: 'WhatsApp pessoal', color: 'bg-emerald-100 text-emerald-700' },
  'maps_fallback': { label: 'Número comercial', color: 'bg-amber-100 text-amber-700' },
}

const ORIGEM_BADGE: Record<string, { label: string; color: string }> = {
  'google_maps': { label: '🗺️ Google Maps', color: 'bg-blue-50 text-blue-600' },
  'instagram':   { label: '📸 Instagram',   color: 'bg-pink-50 text-pink-600' },
}

interface LeadCardProps {
  lead: Lead
}

export function LeadCard({ lead }: LeadCardProps) {
  const badge = lead.categoria ? CATEGORIA_BADGE[lead.categoria] : null
  const fonte = lead.fonte_telefone ? FONTE_BADGE[lead.fonte_telefone] : null
  const origem = lead.fonte ? ORIGEM_BADGE[lead.fonte] : null
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <p className="font-semibold text-gray-900 text-sm truncate">{lead.empresa}</p>
      <div className="flex flex-wrap gap-1 mt-1">
        {badge && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
            {badge.label}
          </span>
        )}
        {origem && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${origem.color}`}>
            {origem.label}
          </span>
        )}
        {fonte && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${fonte.color}`}>
            {fonte.label}
          </span>
        )}
      </div>
      <p className="text-gray-500 text-xs mt-1">{lead.telefone}</p>
      {lead.email && (
        <p className="text-blue-600 text-xs mt-0.5">{lead.email}</p>
      )}
      {lead.cnpj && (
        <p className="text-gray-500 text-xs mt-0.5">CNPJ: {formatarCNPJ(lead.cnpj)}</p>
      )}
      {lead.instagram_handle && (
        <p className="text-pink-500 text-xs mt-0.5">
          @{lead.instagram_handle}
          {lead.instagram_followers ? ` · ${lead.instagram_followers.toLocaleString('pt-BR')} seguidores` : ''}
        </p>
      )}
      {lead.cidade && (
        <p className="text-gray-400 text-xs mt-0.5">{lead.cidade}</p>
      )}
      {lead.bairro && (
        <p className="text-gray-400 text-xs mt-0.5">{lead.bairro}</p>
      )}
      {lead.endereco && (
        <p className="text-gray-400 text-xs mt-0.5">{lead.endereco}</p>
      )}
    </div>
  )
}
