import { SearchForm } from '@/components/approval/SearchForm'

export default function AprovacaoPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Painel de Aprovação</h1>
      <p className="text-gray-500 text-sm mb-6">
        Revise as empresas encontradas e decida quem vai receber o WhatsApp.
      </p>
      <SearchForm />
      <p className="text-gray-400 mt-6">Nenhuma empresa para revisar no momento.</p>
    </div>
  )
}
