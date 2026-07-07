'use client'

import { useCallback, useEffect, useState } from 'react'

interface ShopeeOrderRow {
  id: string
  order_sn: string
  order_status: string
  total_amount: number
  buyer_username?: string
  tracking_number?: string
  nfe_key?: string
  nfe_uploaded_at?: string
  created_at: string
}

interface ConnectionStatus {
  valid: boolean
  access_token_expires_in_seconds?: number
  refresh_token_expires_in_days?: number
  needs_refresh?: boolean
}

const STATUS_LABEL: Record<string, string> = {
  UNPAID: 'Aguardando pagamento',
  READY_TO_SHIP: 'Pronto para enviar',
  RETRY_SHIP: 'Retentar envio',
  SHIPPED: 'Enviado',
  TO_CONFIRM_RECEIVE: 'Aguardando recebimento',
  IN_CANCEL: 'Em cancelamento',
  CANCELLED: 'Cancelado',
  COMPLETED: 'Concluido',
}

const STATUS_COLOR: Record<string, string> = {
  UNPAID: 'bg-gray-700 text-gray-300',
  READY_TO_SHIP: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40',
  RETRY_SHIP: 'bg-orange-500/20 text-orange-300',
  SHIPPED: 'bg-blue-500/20 text-blue-300',
  TO_CONFIRM_RECEIVE: 'bg-cyan-500/20 text-cyan-300',
  IN_CANCEL: 'bg-red-500/20 text-red-400',
  CANCELLED: 'bg-red-900/30 text-red-400',
  COMPLETED: 'bg-green-500/20 text-green-300',
}

export default function ShopeePage() {
  const [orders, setOrders] = useState<ShopeeOrderRow[]>([])
  const [connection, setConnection] = useState<ConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [labelLoading, setLabelLoading] = useState<string | null>(null)
  const [nfeInputs, setNfeInputs] = useState<Record<string, string>>({})
  const [nfeLoading, setNfeLoading] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const showMsg = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 4000)
  }

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/shopee/orders')
      const json = await res.json()
      setOrders(json.orders ?? [])
    } catch {
      showMsg('err', 'Erro ao buscar pedidos')
    }
  }, [])

  const fetchConnection = useCallback(async () => {
    try {
      const res = await fetch('/api/shopee/auth?status=1')
      const json = await res.json()
      setConnection(json)
    } catch {
      setConnection({ valid: false })
    }
  }, [])

  useEffect(() => {
    Promise.all([fetchOrders(), fetchConnection()]).finally(() => setLoading(false))
  }, [fetchOrders, fetchConnection])

  async function syncOrders() {
    setSyncing(true)
    try {
      const statuses = ['READY_TO_SHIP', 'SHIPPED', 'COMPLETED', 'UNPAID']
      for (const status of statuses) {
        await fetch('/api/shopee/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        })
      }
      await fetchOrders()
      showMsg('ok', 'Pedidos sincronizados com sucesso')
    } catch {
      showMsg('err', 'Erro ao sincronizar pedidos')
    } finally {
      setSyncing(false)
    }
  }

  async function downloadLabel(orderSn: string) {
    setLabelLoading(orderSn)
    try {
      const res = await fetch('/api/shopee/orders/label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_sn: orderSn }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      // Converte base64 para PDF e abre no navegador
      const binary = atob(json.label_base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')

      await fetchOrders()
      showMsg('ok', `Etiqueta gerada — rastreio: ${json.tracking_number}`)
    } catch (e: unknown) {
      showMsg('err', `Erro ao gerar etiqueta: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLabelLoading(null)
    }
  }

  async function uploadNfe(orderSn: string) {
    const key = nfeInputs[orderSn] ?? ''
    if (key.length !== 44) {
      showMsg('err', 'Chave NF-e deve ter exatamente 44 digitos')
      return
    }
    setNfeLoading(orderSn)
    try {
      const res = await fetch('/api/shopee/orders/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_sn: orderSn, access_key: key }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setNfeInputs((prev) => ({ ...prev, [orderSn]: '' }))
      await fetchOrders()
      showMsg('ok', 'NF-e enviada com sucesso')
    } catch (e: unknown) {
      showMsg('err', `Erro ao enviar NF-e: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setNfeLoading(null)
    }
  }

  const readyToShip = orders.filter((o) => o.order_status === 'READY_TO_SHIP')
  const others = orders.filter((o) => o.order_status !== 'READY_TO_SHIP')

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Shopee</h1>
          <p className="text-sm text-gray-400 mt-0.5">Pedidos e gestao da loja</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Status da conexao */}
          {connection && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${connection.valid ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${connection.valid ? 'bg-green-400' : 'bg-red-400'}`} />
              {connection.valid
                ? `Conectado — token expira em ${Math.floor((connection.access_token_expires_in_seconds ?? 0) / 60)} min`
                : 'Desconectado — reconectar necessario'}
            </div>
          )}
          <button
            onClick={syncOrders}
            disabled={syncing}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {syncing ? 'Sincronizando...' : 'Sincronizar pedidos'}
          </button>
        </div>
      </div>

      {/* Mensagem feedback */}
      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${msg.type === 'ok' ? 'bg-green-500/15 text-green-300 border border-green-500/30' : 'bg-red-500/15 text-red-300 border border-red-500/30'}`}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg font-medium">Nenhum pedido ainda</p>
          <p className="text-sm mt-1">Clique em Sincronizar pedidos para buscar da Shopee</p>
        </div>
      ) : (
        <>
          {/* Pedidos que precisam de acao */}
          {readyToShip.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-yellow-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                Prontos para enviar ({readyToShip.length})
              </h2>
              <div className="space-y-3">
                {readyToShip.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    nfeValue={nfeInputs[order.order_sn] ?? ''}
                    onNfeChange={(v) => setNfeInputs((prev) => ({ ...prev, [order.order_sn]: v }))}
                    onLabel={() => downloadLabel(order.order_sn)}
                    onNfe={() => uploadNfe(order.order_sn)}
                    labelLoading={labelLoading === order.order_sn}
                    nfeLoading={nfeLoading === order.order_sn}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Demais pedidos */}
          {others.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Outros pedidos ({others.length})
              </h2>
              <div className="space-y-2">
                {others.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    nfeValue={nfeInputs[order.order_sn] ?? ''}
                    onNfeChange={(v) => setNfeInputs((prev) => ({ ...prev, [order.order_sn]: v }))}
                    onLabel={() => downloadLabel(order.order_sn)}
                    onNfe={() => uploadNfe(order.order_sn)}
                    labelLoading={labelLoading === order.order_sn}
                    nfeLoading={nfeLoading === order.order_sn}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function OrderCard({
  order,
  nfeValue,
  onNfeChange,
  onLabel,
  onNfe,
  labelLoading,
  nfeLoading,
}: {
  order: ShopeeOrderRow
  nfeValue: string
  onNfeChange: (v: string) => void
  onLabel: () => void
  onNfe: () => void
  labelLoading: boolean
  nfeLoading: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const isReadyToShip = order.order_status === 'READY_TO_SHIP'

  return (
    <div className={`bg-gray-900 border rounded-xl overflow-hidden ${isReadyToShip ? 'border-yellow-500/30' : 'border-gray-800'}`}>
      {/* Row principal */}
      <div
        className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm text-white font-medium">{order.order_sn}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[order.order_status] ?? 'bg-gray-700 text-gray-300'}`}>
              {STATUS_LABEL[order.order_status] ?? order.order_status}
            </span>
            {order.nfe_uploaded_at && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                NF-e enviada
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
            {order.buyer_username && <span>{order.buyer_username}</span>}
            {order.tracking_number && <span>Rastreio: {order.tracking_number}</span>}
            <span>{new Date(order.created_at).toLocaleDateString('pt-BR')}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-white font-semibold">
            {order.total_amount != null
              ? `R$ ${Number(order.total_amount).toFixed(2).replace('.', ',')}`
              : '—'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{expanded ? 'Fechar' : 'Detalhes'}</p>
        </div>
      </div>

      {/* Detalhes expandidos */}
      {expanded && (
        <div className="border-t border-gray-800 px-4 py-4 space-y-4">
          {/* Etiqueta */}
          {(isReadyToShip || order.order_status === 'RETRY_SHIP') && (
            <div>
              <p className="text-xs text-gray-400 mb-2 font-medium">ETIQUETA DE ENVIO</p>
              <button
                onClick={(e) => { e.stopPropagation(); onLabel() }}
                disabled={labelLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {labelLoading ? 'Gerando...' : 'Gerar etiqueta (PDF)'}
              </button>
            </div>
          )}

          {/* NF-e */}
          {!order.nfe_uploaded_at ? (
            <div>
              <p className="text-xs text-gray-400 mb-2 font-medium">NOTA FISCAL (NF-e)</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Chave NF-e (44 digitos)"
                  value={nfeValue}
                  onChange={(e) => onNfeChange(e.target.value.replace(/\D/g, '').slice(0, 44))}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                  maxLength={44}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); onNfe() }}
                  disabled={nfeLoading || nfeValue.length !== 44}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                >
                  {nfeLoading ? 'Enviando...' : 'Enviar NF-e'}
                </button>
              </div>
              {nfeValue.length > 0 && nfeValue.length < 44 && (
                <p className="text-xs text-yellow-400 mt-1">{44 - nfeValue.length} digitos restantes</p>
              )}
            </div>
          ) : (
            <div>
              <p className="text-xs text-gray-400 mb-1 font-medium">NOTA FISCAL</p>
              <p className="text-xs text-green-400">Enviada em {new Date(order.nfe_uploaded_at).toLocaleDateString('pt-BR')}</p>
              <p className="text-xs text-gray-500 font-mono mt-0.5">{order.nfe_key}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
