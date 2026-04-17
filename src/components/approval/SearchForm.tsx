'use client'

import { useState } from 'react'
import { createSearch } from '@/lib/api/searches'

const TIPOS_LOJA = [
  'Todos os tipos',
  'Loja de brinquedos',
  'Artigos esportivos',
  'Bazar e variedades',
  'Sacoleiro / Atacadista',
  'Loja de presentes',
  'Comércio',
]

export function SearchForm() {
  const [pais, setPais] = useState('')
  const [estado, setEstado] = useState('')
  const [cidade, setCidade] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [tipoLoja, setTipoLoja] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setSucesso(false)

    const qty = Number(quantidade)
    if (!pais.trim() || !estado.trim() || !cidade.trim()) {
      setErro('Todos os campos são obrigatórios.')
      return
    }
    if (!tipoLoja) {
      setErro('Selecione o tipo de loja.')
      return
    }
    if (!quantidade || qty < 1 || qty > 100) {
      setErro('Quantidade deve ser entre 1 e 100.')
      return
    }

    setLoading(true)
    try {
      await createSearch({ pais: pais.trim(), estado: estado.trim(), cidade: cidade.trim(), quantidade: qty, tipo_loja: tipoLoja })
      setSucesso(true)
      setPais('')
      setEstado('')
      setCidade('')
      setQuantidade('')
      setTipoLoja('')
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 shadow-sm max-w-lg">
      <h2 className="font-semibold text-gray-800 mb-4">Nova Busca de Empresas</h2>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">País</label>
          <input
            type="text"
            value={pais}
            onChange={(e) => setPais(e.target.value)}
            placeholder="Ex: Brasil"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
          <input
            type="text"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            placeholder="Ex: SP"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
          <input
            type="text"
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            placeholder="Ex: São Paulo"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de loja</label>
          <select
            value={tipoLoja}
            onChange={(e) => setTipoLoja(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            disabled={loading}
          >
            <option value="">Selecione...</option>
            {TIPOS_LOJA.map((tipo) => (
              <option key={tipo} value={tipo}>{tipo}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade de empresas (1–100)</label>
          <input
            type="number"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            min={1}
            max={100}
            placeholder="Ex: 50"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>
      </div>

      {erro && (
        <p className="mt-3 text-sm text-red-600">{erro}</p>
      )}

      {sucesso && (
        <p className="mt-3 text-sm text-green-600">Busca iniciada com sucesso! O n8n está processando.</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-4 w-full bg-blue-600 text-white rounded-md py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Iniciando busca...' : 'Iniciar Busca'}
      </button>
    </form>
  )
}
