'use client'

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { bulkApproveLeads } from '@/lib/api/leads'

interface BulkApproveButtonProps {
  count: number
  onSuccess: (updated: number) => void
}

export function BulkApproveButton({ count, onSuccess }: BulkApproveButtonProps) {
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  if (count === 0) return null

  async function handleConfirm() {
    setLoading(true)
    try {
      const { updated } = await bulkApproveLeads()
      setOpen(false)
      onSuccess(updated)
    } catch {
      // erro tratado pelo componente pai
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button className="bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-green-700 transition-colors">
          Aprovar Todos ({count})
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Aprovar {count} empresa{count > 1 ? 's' : ''}?</AlertDialogTitle>
          <AlertDialogDescription>
            Todas serão enviadas para prospecção via WhatsApp. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={loading}>
            {loading ? 'Aprovando...' : 'Confirmar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
