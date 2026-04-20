export type LeadStatus =
  | 'LOCALIZADOS'
  | 'PROSPECTAR'
  | 'PROSPECTADOS'
  | 'INTERESSE'
  | 'TRANSFERIDOS'
  | 'DESCARTADOS'

export type LeadCategoria = 'DOMÉSTICOS' | 'ESPORTIVOS' | 'MISTO'

export type SearchStatus = 'PENDENTE' | 'CONCLUÍDA' | 'ERRO'

export interface Lead {
  id: string
  empresa: string
  telefone: string
  website?: string
  cidade?: string
  estado?: string
  pais?: string
  status: LeadStatus
  categoria?: LeadCategoria
  nota?: number
  data_coleta: string
  data_resposta?: string
  data_followup?: string
  qtd_reengajamentos: number
  search_id?: string
  created_at: string
  updated_at: string
}

export interface Search {
  id: string
  pais: string
  estado: string
  cidade: string
  tipo_loja?: string
  quantidade: number
  status: SearchStatus
  total_encontrados?: number
  created_at: string
}
