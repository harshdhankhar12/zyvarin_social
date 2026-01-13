"use client"
import { useEffect, useState } from 'react'
import { Shield, Clock, AlertTriangle } from 'lucide-react'

const formatRemaining = (target?: string | null) => {
  if (!target) return 'Until further notice'
  const end = new Date(target).getTime()
  const now = Date.now()
  const diff = end - now
  if (diff <= 0) return 'Wrapping up now'
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s remaining`
}

const MaintenanceNotice = ({ maintenance }: { maintenance: { title: string; message?: string | null; endsAt?: string | null } }) => {
  const [remaining, setRemaining] = useState(formatRemaining(maintenance.endsAt))

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining(formatRemaining(maintenance.endsAt))
    }, 1000)
    return () => clearInterval(timer)
  }, [maintenance.endsAt])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white flex items-center justify-center px-4">
      <div className="max-w-3xl w-full bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-4 text-amber-300">
          <Shield className="w-6 h-6" />
          <p className="text-sm font-semibold uppercase tracking-wide">Maintenance Mode</p>
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">{maintenance.title}</h1>
        <p className="text-lg text-slate-200 mb-6">{maintenance.message || 'We are performing scheduled maintenance. Services will be back shortly.'}</p>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2 bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100">
            <Clock className="w-4 h-4" />
            <span>{remaining}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <AlertTriangle className="w-4 h-4 text-amber-300" />
            <span>Only sign-in and admin pages remain accessible.</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MaintenanceNotice
