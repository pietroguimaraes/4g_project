'use client'

import { useKanban } from '@/hooks/useKanban'
import { KanbanColumn } from '@/components/kanban/KanbanColumn'

const COLUNAS = [
  { status: 'PROSPECTADOS' as const, titulo: 'Prospectados', headerColor: 'border-blue-400', borderColor: 'border-l-blue-400' },
  { status: 'INTERESSE' as const, titulo: 'Interesse', headerColor: 'border-orange-400', borderColor: 'border-l-orange-400' },
  { status: 'TRANSFERIDOS' as const, titulo: 'Transferidos', headerColor: 'border-green-400', borderColor: 'border-l-green-400' },
  { status: 'DESCARTADOS' as const, titulo: 'Descartados', headerColor: 'border-gray-400', borderColor: 'border-l-gray-400' },
]

export default function KanbanPage() {
  const { kanban, loading } = useKanban()

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Kanban de Funil</h1>
        <p className="text-gray-400 text-sm">Carregando leads...</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Kanban de Funil</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLUNAS.map((col) => (
          <KanbanColumn
            key={col.status}
            title={col.titulo}
            leads={kanban[col.status]}
            headerColor={col.headerColor}
            borderColor={col.borderColor}
          />
        ))}
      </div>
    </div>
  )
}
