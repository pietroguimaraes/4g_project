import { SearchForm } from '@/components/approval/SearchForm'
import { AprovacaoList } from '@/components/approval/AprovacaoList'
import { AddCompanyForm } from '@/components/approval/AddCompanyForm'

export default function AprovacaoPage() {
  return (
    <div>
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold">Painel de Aprovação</h1>
          <p className="text-gray-500 text-sm mt-1">
            Revise as empresas encontradas e decida quem vai receber o WhatsApp.
          </p>
        </div>
        <AddCompanyForm />
      </div>
      <div className="mt-6">
        <SearchForm />
      </div>
      <div className="mt-8">
        <AprovacaoList />
      </div>
    </div>
  )
}
