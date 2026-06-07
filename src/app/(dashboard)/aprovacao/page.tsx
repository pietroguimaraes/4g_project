'use client'

import { useState, useEffect } from 'react'
import { SearchForm } from '@/components/approval/SearchForm'
import { AprovacaoList } from '@/components/approval/AprovacaoList'
import { AddCompanyForm } from '@/components/approval/AddCompanyForm'

const TRIAL_BANNER_KEY = 'trial_welcome_dismissed'

export default function AprovacaoPage() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(TRIAL_BANNER_KEY)) {
      setShowBanner(true)
    }
  }, [])

  function dismissBanner() {
    localStorage.setItem(TRIAL_BANNER_KEY, '1')
    setShowBanner(false)
  }

  return (
    <div>
      {showBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Bem-vindo ao período de teste</h2>
            <p className="text-sm text-gray-500 mb-4">Oriental Limpeza — versão demonstração</p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 space-y-2 mb-5">
              <p>Esta é uma versão de teste do sistema. Para que você possa avaliar o produto sem esgotar os recursos, aplicamos os seguintes limites:</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li><strong>3 buscas</strong> no total</li>
                <li><strong>5 empresas</strong> por busca</li>
              </ul>
              <p className="mt-2">Após o período de teste, esses limites são removidos e o sistema opera em plena capacidade.</p>
            </div>
            <button
              onClick={dismissBanner}
              className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Entendi, quero testar
            </button>
          </div>
        </div>
      )}

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
        <SearchForm onSearchComplete={() => setRefreshKey(k => k + 1)} />
      </div>
      <div className="mt-8">
        <AprovacaoList key={refreshKey} />
      </div>
    </div>
  )
}
