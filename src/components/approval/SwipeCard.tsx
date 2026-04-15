'use client'

import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { Lead } from '@/types'

interface SwipeCardProps {
  lead: Lead
  onApprove: (lead: Lead) => void
  onDiscard: (lead: Lead) => void
}

const THRESHOLD = 80

export function SwipeCard({ lead, onApprove, onDiscard }: SwipeCardProps) {
  const [decided, setDecided] = useState(false)

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
  if (isApproving) {
    cardClass = 'bg-green-50 border-green-400'
    label = '✓ Aprovar'
  } else if (isDiscarding) {
    cardClass = 'bg-red-50 border-red-400'
    label = '✗ Descartar'
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onPointerUp={handleDragEnd}
      className={`relative rounded-lg border-2 p-4 shadow-sm cursor-grab active:cursor-grabbing select-none transition-colors ${cardClass}`}
    >
      {label && (
        <span className={`absolute top-2 right-2 text-xs font-bold ${isApproving ? 'text-green-700' : 'text-red-700'}`}>
          {label}
        </span>
      )}
      <p className="font-semibold text-gray-900 text-sm truncate pr-16">{lead.empresa}</p>
      <p className="text-gray-500 text-xs mt-1">{lead.telefone}</p>
      {lead.cidade && (
        <p className="text-gray-400 text-xs mt-0.5">{lead.cidade}</p>
      )}
      <p className="text-gray-300 text-xs mt-2">← descartar · aprovar →</p>
    </div>
  )
}
