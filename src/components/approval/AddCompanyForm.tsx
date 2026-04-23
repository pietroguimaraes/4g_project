'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface AddCompanyFormProps {
  onSuccess?: () => void
}

export function AddCompanyForm({ onSuccess }: AddCompanyFormProps) {
  const [open, setOpen] = useState(false)
  const [empresa, setEmpresa] = useState('')
  const [telefone, setTelefone] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function sanitizePhone(value: string) {
    return value.replace(/\D/g, '')
  }

  function reset() {
    setEmpresa('')
    setTelefone('')
    setErro(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!empresa.trim()) {
      setErro('Nome da empresa é obrigatório.')
      return
    }

    const sanitized = sanitizePhone(telefone)
    if (!sanitized || sanitized.length < 10 || sanitized.length > 15) {
      setErro('Telefone inválido. Use formato +55 11 99999-8888.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa: empresa.trim(), telefone: sanitized, status: 'PROSPECTADOS', manual: true }),
      })

      if (!response.ok) {
        const data = await response.json()
        setErro(data.error === 'Erro ao salvar lead'
          ? 'Este telefone já está cadastrado.'
          : (data.error || 'Erro inesperado.'))
        return
      }

      reset()
      setOpen(false)
      onSuccess?.()
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger asChild>
        <button className="bg-white border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-md hover:bg-gray-50 transition-colors">
          + Adicionar Empresa
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Empresa Manualmente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da empresa</label>
            <input
              type="text"
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              placeholder="Ex: Petshop do João"
              disabled={loading}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
            <input
              type="text"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="+55 11 99999-8888"
              disabled={loading}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {erro && <p className="text-red-600 text-sm">{erro}</p>}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="border border-gray-300 text-gray-700 text-sm px-4 py-2 rounded-md hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
