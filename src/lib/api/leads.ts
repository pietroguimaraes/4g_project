import type { Lead, LeadStatus } from '@/types'

export async function getLeadsByStatus(status: LeadStatus): Promise<Lead[]> {
  const response = await fetch(`/api/leads?status=${status}`)
  if (!response.ok) {
    throw new Error('Erro ao buscar leads')
  }
  return response.json()
}

export async function updateLeadStatus(
  telefone: string,
  status: LeadStatus
): Promise<{ id: string; empresa: string; telefone: string; status: LeadStatus }> {
  const response = await fetch(`/api/leads/${encodeURIComponent(telefone)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Erro ao atualizar lead')
  }

  return response.json()
}

export async function bulkApproveLeads(): Promise<{ updated: number }> {
  const response = await fetch('/api/leads/bulk-approve', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Erro ao aprovar em lote')
  }

  return response.json()
}
