import type { Lead, LeadStatus } from '@/types'

export async function getLeadsByStatus(status: LeadStatus): Promise<Lead[]> {
  const response = await fetch(`/api/leads?status=${status}`)
  if (!response.ok) {
    throw new Error('Erro ao buscar leads')
  }
  return response.json()
}
