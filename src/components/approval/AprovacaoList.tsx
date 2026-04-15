'use client'

import { useState } from 'react'
import { DndContext } from '@dnd-kit/core'
import { useLocalizados } from '@/hooks/useLocalizados'
import { SwipeCard } from './SwipeCard'
import { BulkApproveButton } from './BulkApproveButton'
import { updateLeadStatus } from '@/lib/api/leads'
import type { Lead } from '@/types'

export function AprovacaoList() {
  const { leads: initialLeads, loading } = useLocalizados()
  const [leads, setLeads] = useState<Lead[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  // Usa leads do hook até o primeiro swipe, depois usa estado local
  const displayLeads = leads ?? initialLeads

  function removeLeadFromList(telefone: string) {
    setLeads((prev) => (prev ?? initialLeads).filter((l) => l.telefone !== telefone))
  }

  async function handleApprove(lead: Lead) {
    try {
      await updateLeadStatus(lead.telefone, 'PROSPECTAR')
      removeLeadFromList(lead.telefone)
    } catch {
      setErro('Erro ao aprovar. Tente novamente.')
    }
  }

  async function handleDiscard(lead: Lead) {
    try {
      await updateLeadStatus(lead.telefone, 'DESCARTADOS')
      removeLeadFromList(lead.telefone)
    } catch {
      setErro('Erro ao descartar. Tente novamente.')
    }
  }

  function handleBulkSuccess(updated: number) {
    setLeads([])
    setSucesso(`${updated} empresa${updated > 1 ? 's' : ''} aprovada${updated > 1 ? 's' : ''} para prospecção!`)
  }

  if (loading) {
    return <p className="text-gray-400 text-sm">Carregando empresas...</p>
  }

  const count = displayLeads.length

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600 font-medium">
          {count > 0
            ? `${count} empresa${count > 1 ? 's' : ''} aguardando revisão`
            : 'Nenhuma empresa para revisar no momento.'}
        </p>
        <BulkApproveButton count={count} onSuccess={handleBulkSuccess} />
      </div>

      {erro && <p className="text-red-600 text-sm mb-3">{erro}</p>}
      {sucesso && <p className="text-green-600 text-sm mb-3">{sucesso}</p>}

      {count > 0 && (
        <DndContext>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {displayLeads.map((lead) => (
              <SwipeCard
                key={lead.telefone}
                lead={lead}
                onApprove={handleApprove}
                onDiscard={handleDiscard}
              />
            ))}
          </div>
        </DndContext>
      )}
    </div>
  )
}
