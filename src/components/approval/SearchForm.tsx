'use client'

import { useState, useEffect, useRef } from 'react'
import { createSearch } from '@/lib/api/searches'
import type { Search } from '@/types'

const TIPOS_LOJA = [
  'Supermercados',
  'Atacadistas e atacarejos',
  'Distribuidoras',
]

const CAPITAIS: Record<string, string> = {
  AC: 'Rio Branco',      AL: 'Maceió',          AP: 'Macapá',
  AM: 'Manaus',          BA: 'Salvador',         CE: 'Fortaleza',
  DF: 'Brasília',        ES: 'Vitória',          GO: 'Goiânia',
  MA: 'São Luís',        MT: 'Cuiabá',           MS: 'Campo Grande',
  MG: 'Belo Horizonte',  PA: 'Belém',            PB: 'João Pessoa',
  PR: 'Curitiba',        PE: 'Recife',            PI: 'Teresina',
  RJ: 'Rio de Janeiro',  RN: 'Natal',            RS: 'Porto Alegre',
  RO: 'Porto Velho',     RR: 'Boa Vista',        SC: 'Florianópolis',
  SP: 'São Paulo',       SE: 'Aracaju',          TO: 'Palmas',
}

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

const TRIAL_MAX = 3

interface SearchFormProps {
  onSearchComplete?: () => void
}

export function SearchForm({ onSearchComplete }: SearchFormProps) {
  const [estado, setEstado] = useState('')
  const [cidade, setCidade] = useState('')
  const [cidades, setCidades] = useState<string[]>([])
  const [loadingCidades, setLoadingCidades] = useState(false)
  const [tipoLoja, setTipoLoja] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ tipo: 'erro' | 'sucesso' | 'progresso'; mensagem: string } | null>(null)
  const [trialCount, setTrialCount] = useState<number | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const activeSearchRef = useRef<{ id: string; quantidade: number } | null>(null)

  useEffect(() => {
    return () => stopPolling()
  }, [])

  useEffect(() => {
    fetch('/api/searches')
      .then(r => r.json())
      .then((d: { count: number }) => setTrialCount(d.count))
      .catch(() => setTrialCount(0))
  }, [])

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

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  function startPolling(searchId: string, quantidadePedida: number) {
    activeSearchRef.current = { id: searchId, quantidade: quantidadePedida }
    const startedAt = Date.now()
    const MAX_POLL_MS = 10 * 60 * 1000 // 10 minutos

    pollingRef.current = setInterval(async () => {
      if (Date.now() - startedAt > MAX_POLL_MS) {
        stopPolling()
        setFeedback({ tipo: 'erro', mensagem: 'A busca está demorando muito. Verifique o n8n.' })
        setLoading(false)
        return
      }

      try {
        const res = await fetch(`/api/searches/${searchId}`)
        if (!res.ok) return
        const search: Search = await res.json()

        if (search.status === 'CONCLUÍDA') {
          stopPolling()
          setLoading(false)
          const entregues = search.quantidade_entregue ?? 0
          const rodadas = search.num_rodadas ?? 1
          const sufixoRodadas = rodadas > 1 ? ` (${rodadas} rodadas)` : ''
          setFeedback({
            tipo: 'sucesso',
            mensagem: `Busca concluída! ${entregues} empresa${entregues !== 1 ? 's' : ''} encontrada${entregues !== 1 ? 's' : ''}${sufixoRodadas} e enviadas para aprovação.`,
          })
          onSearchComplete?.()
        } else if (search.status === 'ERRO') {
          stopPolling()
          setLoading(false)
          setFeedback({ tipo: 'erro', mensagem: 'Nenhuma empresa encontrada. Essa cidade pode ter poucos resultados no Google Maps para esse tipo de loja. Tente outra cidade ou tipo.' })
        }
        // PENDENTE: continua polling
      } catch {
        // erro de rede temporário — continua polling
      }
    }, 3000)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFeedback(null)

    if ((trialCount ?? 0) >= TRIAL_MAX) return

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

    stopPolling()
    setLoading(true)
    try {
      const result = await createSearch({ pais: 'Brasil', estado, cidade, quantidade: TRIAL_MAX, tipo_loja: tipoLoja })
      setTrialCount(prev => (prev ?? 0) + 1)
      setFeedback({
        tipo: 'progresso',
        mensagem: `Buscando empresas do tipo "${tipoLoja}" em ${cidade}... Isso pode levar alguns minutos.`,
      })
      setEstado('')
      setCidade('')
      setTipoLoja('')
      startPolling(result.id, TRIAL_MAX)
    } catch (err) {
      const motivo = err instanceof Error ? err.message : 'Erro desconhecido.'
      setFeedback({ tipo: 'erro', mensagem: `Não foi possível iniciar a busca. Motivo: ${motivo}` })
      setLoading(false)
    }
  }

  const limitReached = (trialCount ?? 0) >= TRIAL_MAX
  const isFormDisabled = loading || loadingCidades || limitReached

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 shadow-sm max-w-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-800">Nova Busca de Empresas</h2>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
          limitReached
            ? 'bg-red-100 text-red-700'
            : 'bg-blue-50 text-blue-700'
        }`}>
          {trialCount === null ? '...' : `${trialCount} de ${TRIAL_MAX} buscas usadas`}
        </span>
      </div>

      {limitReached && (
        <div className="mb-4 p-3 rounded-md text-sm bg-amber-50 text-amber-800 border border-amber-200">
          Limite do período de teste atingido. Entre em contato para continuar usando o sistema.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:text-gray-400"
            disabled={isFormDisabled}
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
            disabled={isFormDisabled || !estado}
          >
            <option value="">
              {!estado ? 'Selecione o estado primeiro' : loadingCidades ? 'Carregando cidades...' : 'Selecione...'}
            </option>
            {[...cidades]
              .sort((a, b) => {
                const capital = CAPITAIS[estado]
                if (a === capital) return -1
                if (b === capital) return 1
                return 0
              })
              .map((c) => {
                const isCapital = CAPITAIS[estado] === c
                return (
                  <option
                    key={c}
                    value={c}
                    style={isCapital ? { color: '#b8860b', fontWeight: '700' } : undefined}
                  >
                    {isCapital ? `★ ${c}` : c}
                  </option>
                )
              })}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de loja</label>
          <select
            value={tipoLoja}
            onChange={(e) => setTipoLoja(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:text-gray-400"
            disabled={isFormDisabled}
          >
            <option value="">Selecione...</option>
            {TIPOS_LOJA.map((tipo) => (
              <option key={tipo} value={tipo}>{tipo}</option>
            ))}
          </select>
        </div>
      </div>

      {feedback && (
        <div className={`mt-4 p-3 rounded-md text-sm ${
          feedback.tipo === 'sucesso'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : feedback.tipo === 'progresso'
            ? 'bg-blue-50 text-blue-700 border border-blue-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {feedback.mensagem}
        </div>
      )}

      <button
        type="submit"
        disabled={isFormDisabled}
        className="mt-4 w-full bg-blue-600 text-white rounded-md py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Iniciando busca...' : limitReached ? 'Limite atingido' : 'Iniciar Busca'}
      </button>
    </form>
  )
}
