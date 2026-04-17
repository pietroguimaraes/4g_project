'use client'

import { useState, useEffect } from 'react'
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

const ESTADOS = [
  { uf: 'AC', nome: 'Acre' },
  { uf: 'AL', nome: 'Alagoas' },
  { uf: 'AP', nome: 'Amapá' },
  { uf: 'AM', nome: 'Amazonas' },
  { uf: 'BA', nome: 'Bahia' },
  { uf: 'CE', nome: 'Ceará' },
  { uf: 'DF', nome: 'Distrito Federal' },
  { uf: 'ES', nome: 'Espírito Santo' },
  { uf: 'GO', nome: 'Goiás' },
  { uf: 'MA', nome: 'Maranhão' },
  { uf: 'MT', nome: 'Mato Grosso' },
  { uf: 'MS', nome: 'Mato Grosso do Sul' },
  { uf: 'MG', nome: 'Minas Gerais' },
  { uf: 'PA', nome: 'Pará' },
  { uf: 'PB', nome: 'Paraíba' },
  { uf: 'PR', nome: 'Paraná' },
  { uf: 'PE', nome: 'Pernambuco' },
  { uf: 'PI', nome: 'Piauí' },
  { uf: 'RJ', nome: 'Rio de Janeiro' },
  { uf: 'RN', nome: 'Rio Grande do Norte' },
  { uf: 'RS', nome: 'Rio Grande do Sul' },
  { uf: 'RO', nome: 'Rondônia' },
  { uf: 'RR', nome: 'Roraima' },
  { uf: 'SC', nome: 'Santa Catarina' },
  { uf: 'SP', nome: 'São Paulo' },
  { uf: 'SE', nome: 'Sergipe' },
  { uf: 'TO', nome: 'Tocantins' },
]

export function SearchForm() {
  const [estado, setEstado] = useState('')
  const [cidade, setCidade] = useState('')
  const [cidades, setCidades] = useState<string[]>([])
  const [loadingCidades, setLoadingCidades] = useState(false)
  const [quantidade, setQuantidade] = useState('')
  const [tipoLoja, setTipoLoja] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ tipo: 'erro' | 'sucesso'; mensagem: string } | null>(null)

  useEffect(() => {
    if (!estado) {
      setCidades([])
      setCidade('')
      return
    }
    setLoadingCidades(true)
    setCidade('')
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estado}/municipios?orderBy=nome`)
      .then(r => r.json())
      .then((data: { nome: string }[]) => setCidades(data.map(m => m.nome)))
      .catch(() => setCidades([]))
      .finally(() => setLoadingCidades(false))
  }, [estado])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFeedback(null)

    if (!estado) {
      setFeedback({ tipo: 'erro', mensagem: 'Selecione o estado.' })
      return
    }
    if (!cidade) {
      setFeedback({ tipo: 'erro', mensagem: 'Selecione a cidade.' })
      return
    }
    if (!tipoLoja) {
      setFeedback({ tipo: 'erro', mensagem: 'Selecione o tipo de loja.' })
      return
    }
    const qty = Number(quantidade)
    if (!quantidade || qty < 1 || qty > 100) {
      setFeedback({ tipo: 'erro', mensagem: 'A quantidade deve ser entre 1 e 100.' })
      return
    }

    setLoading(true)
    try {
      await createSearch({ pais: 'Brasil', estado, cidade, quantidade: qty, tipo_loja: tipoLoja })
      const estadoNome = ESTADOS.find(e => e.uf === estado)?.nome ?? estado
      setFeedback({
        tipo: 'sucesso',
        mensagem: `Busca disparada com sucesso! O n8n vai procurar ${qty} empresa${qty > 1 ? 's' : ''} do tipo "${tipoLoja}" em ${cidade}, ${estadoNome}.`,
      })
      setEstado('')
      setCidade('')
      setQuantidade('')
      setTipoLoja('')
    } catch (err) {
      const motivo = err instanceof Error ? err.message : 'Erro desconhecido.'
      setFeedback({ tipo: 'erro', mensagem: `Não foi possível iniciar a busca. Motivo: ${motivo}` })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 shadow-sm max-w-lg">
      <h2 className="font-semibold text-gray-800 mb-4">Nova Busca de Empresas</h2>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            disabled={loading}
          >
            <option value="">Selecione...</option>
            {ESTADOS.map((e) => (
              <option key={e.uf} value={e.uf}>{e.uf} — {e.nome}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
          <select
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:text-gray-400"
            disabled={loading || loadingCidades || !estado}
          >
            <option value="">
              {!estado ? 'Selecione o estado primeiro' : loadingCidades ? 'Carregando cidades...' : 'Selecione...'}
            </option>
            {cidades.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
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

      {feedback && (
        <div className={`mt-4 p-3 rounded-md text-sm ${
          feedback.tipo === 'sucesso'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {feedback.tipo === 'sucesso' ? '✅ ' : '❌ '}{feedback.mensagem}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || loadingCidades}
        className="mt-4 w-full bg-blue-600 text-white rounded-md py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Iniciando busca...' : 'Iniciar Busca'}
      </button>
    </form>
  )
}
