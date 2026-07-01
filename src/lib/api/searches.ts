export interface CreateSearchData {
  pais: string
  estado: string
  cidade: string
  quantidade: number
  tipo_loja: string
  fonte?: 'google_maps' | 'instagram' | 'ambos' | 'linkedin'
  municipio_id?: number
  bairro?: string
  min_funcionarios?: number
}

export async function createSearch(data: CreateSearchData): Promise<{ id: string; status: string }> {
  const response = await fetch('/api/searches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Erro ao criar busca')
  }

  return response.json()
}
