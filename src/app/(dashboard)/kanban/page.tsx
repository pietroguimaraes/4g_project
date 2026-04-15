const COLUNAS = [
  { status: 'PROSPECTADOS', cor: 'border-blue-400', titulo: 'Prospectados' },
  { status: 'INTERESSE', cor: 'border-orange-400', titulo: 'Interesse' },
  { status: 'TRANSFERIDOS', cor: 'border-green-400', titulo: 'Transferidos' },
  { status: 'DESCARTADOS', cor: 'border-gray-400', titulo: 'Descartados' },
]

export default function KanbanPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Kanban de Funil</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLUNAS.map((coluna) => (
          <div
            key={coluna.status}
            className={`bg-white rounded-lg border-t-4 ${coluna.cor} p-4 shadow-sm`}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm text-gray-700">{coluna.titulo}</h2>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                0
              </span>
            </div>
            <p className="text-gray-400 text-xs">Nenhum lead nesta etapa.</p>
          </div>
        ))}
      </div>
    </div>
  )
}
