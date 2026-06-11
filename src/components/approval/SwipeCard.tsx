'use client'

import { useState, useRef } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { Lead } from '@/types'

const CATEGORIA_BADGE: Record<string, { label: string; color: string }> = {
  'SUPERMERCADO':  { label: 'Supermercado',  color: 'bg-blue-100 text-blue-700' },
  'ATACADISTA':    { label: 'Atacadista',    color: 'bg-green-100 text-green-700' },
  'DISTRIBUIDORA': { label: 'Distribuidora', color: 'bg-yellow-100 text-yellow-700' },
}

const FONTE_BADGE: Record<string, { label: string; color: string }> = {
  'ia_pessoal':    { label: 'WhatsApp pessoal', color: 'bg-emerald-100 text-emerald-700' },
  'maps_fallback': { label: 'Número comercial', color: 'bg-amber-100 text-amber-700' },
}

interface SwipeCardProps {
  lead: Lead
  onApprove: (lead: Lead) => void
  onDiscard: (lead: Lead) => void
}

const THRESHOLD = 80

export function SwipeCard({ lead, onApprove, onDiscard }: SwipeCardProps) {
  const [decided, setDecided] = useState(false)
  const [tapFlash, setTapFlash] = useState<'approve' | 'discard' | null>(null)
  const lastTapRef = useRef<{ time: number; side: 'left' | 'right' } | null>(null)

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.telefone,
  })

  const deltaX = transform?.x ?? 0

  const isApproving = deltaX > THRESHOLD
  const isDiscarding = deltaX < -THRESHOLD

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${deltaX}px, ${transform.y}px, 0)` : undefined,
    transition: isDragging ? 'none' : 'transform 0.3s ease, opacity 0.3s ease',
    opacity: decided ? 0 : 1,
  }

  let cardClass = 'bg-white border-gray-200'
  let label = ''
  if (isApproving || tapFlash === 'approve') {
    cardClass = 'bg-green-50 border-green-400'
    label = '✓ Aprovar'
  } else if (isDiscarding || tapFlash === 'discard') {
    cardClass = 'bg-red-50 border-red-400'
    label = '✗ Descartar'
  }

  function handleDoubleTap(e: React.MouseEvent<HTMLDivElement>) {
    if (decided || isDragging) return
    const rect = e.currentTarget.getBoundingClientRect()
    const side = e.clientX < rect.left + rect.width / 2 ? 'left' : 'right'
    const now = Date.now()

    if (lastTapRef.current && now - lastTapRef.current.time < 350 && lastTapRef.current.side === side) {
      lastTapRef.current = null
      if (side === 'right') {
        setTapFlash('approve')
        setDecided(true)
        setTimeout(() => onApprove(lead), 300)
      } else {
        setTapFlash('discard')
        setDecided(true)
        setTimeout(() => onDiscard(lead), 300)
      }
    } else {
      lastTapRef.current = { time: now, side }
    }
  }

  function handleDragEnd() {
    if (isApproving && !decided) {
      setDecided(true)
      setTimeout(() => onApprove(lead), 300)
    } else if (isDiscarding && !decided) {
      setDecided(true)
      setTimeout(() => onDiscard(lead), 300)
    }
  }

  const badge = lead.categoria ? CATEGORIA_BADGE[lead.categoria] : null
  const fonte = lead.fonte_telefone ? FONTE_BADGE[lead.fonte_telefone] : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onPointerUp={handleDragEnd}
      onClick={handleDoubleTap}
      className={`relative rounded-lg border-2 p-4 shadow-sm cursor-grab active:cursor-grabbing select-none transition-colors ${cardClass}`}
    >
      {label && (
        <span className={`absolute top-2 right-2 text-xs font-bold ${isApproving ? 'text-green-700' : 'text-red-700'}`}>
          {label}
        </span>
      )}
      <p className="font-semibold text-gray-900 text-sm truncate pr-16">{lead.empresa}</p>
      <div className="flex flex-wrap gap-1 mt-1">
        {badge && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
            {badge.label}
          </span>
        )}
        {fonte && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${fonte.color}`}>
            {fonte.label}
          </span>
        )}
      </div>
      <p className="text-gray-500 text-xs mt-1">{lead.telefone}</p>
      {lead.email && (
        <p className="text-blue-500 text-xs mt-0.5">{lead.email}</p>
      )}
      {lead.cidade && (
        <p className="text-gray-400 text-xs mt-0.5">{lead.cidade}</p>
      )}
      <p className="text-gray-300 text-xs mt-2">← descartar · aprovar → <span className="sm:hidden">(duplo toque)</span></p>
    </div>
  )
}
