import Link from 'next/link'
import { LogoutButton } from '@/components/ui/LogoutButton'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <span className="font-bold text-lg text-gray-900">4G Dashboard</span>
          <div className="flex gap-4">
            <Link
              href="/aprovacao"
              className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
            >
              Painel de Aprovação
            </Link>
            <Link
              href="/kanban"
              className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
            >
              Kanban
            </Link>
            <Link
              href="/manual"
              className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
            >
              Manual
            </Link>
          </div>
        </div>
        <LogoutButton />
      </nav>
      <main className="p-6">{children}</main>
    </div>
  )
}
