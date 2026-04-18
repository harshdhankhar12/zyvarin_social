"use client"
import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { AlertTriangle, CheckCircle2, Clock, Loader2, Play, Shield, Sparkles, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const templates = [
  {
    name: 'Platform upgrade',
    title: 'Platform Upgrade',
    message: 'We are upgrading the platform to improve stability, reliability, and overall performance.',
    durationHours: 4,
    tone: 'Infrastructure'
  },
  {
    name: 'Security patch',
    title: 'Security Maintenance',
    message: 'We are applying security updates and hardening the platform. Some actions may be temporarily limited.',
    durationHours: 2,
    tone: 'Security'
  },
  {
    name: 'Database optimization',
    title: 'Database Optimization',
    message: 'We are optimizing database performance to keep the app fast and responsive.',
    durationHours: 3,
    tone: 'Performance'
  },
  {
    name: 'Emergency hotfix',
    title: 'Emergency Hotfix',
    message: 'We are applying an urgent fix to restore service stability as quickly as possible.',
    durationHours: 1,
    tone: 'Urgent'
  },
  {
    name: 'API provider maintenance',
    title: 'Third-Party API Maintenance',
    message: 'An external provider is experiencing maintenance. Some connected actions may be unavailable.',
    durationHours: 2,
    tone: 'Integration'
  },
  {
    name: 'Billing window',
    title: 'Billing Maintenance Window',
    message: 'We are performing billing system updates. Payment actions may be briefly unavailable.',
    durationHours: 2,
    tone: 'Billing'
  }
]

const statusStyles: Record<string, string> = {
  SCHEDULED: 'bg-amber-50 text-amber-700 border-amber-200',
  ONGOING: 'bg-blue-50 text-blue-700 border-blue-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELED: 'bg-rose-50 text-rose-700 border-rose-200'
}

const statusIcon = (status: string) => {
  if (status === 'SCHEDULED') return <Clock className="w-4 h-4" />
  if (status === 'ONGOING') return <Play className="w-4 h-4" />
  if (status === 'COMPLETED') return <CheckCircle2 className="w-4 h-4" />
  return <XCircle className="w-4 h-4" />
}

const toLocalInputValue = (date: Date) => {
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

const addHours = (date: Date, hours: number) => new Date(date.getTime() + hours * 60 * 60 * 1000)

const MaintenanceManager = ({ maintenances }: { maintenances: any[] }) => {
  const now = useMemo(() => new Date(), [])
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [form, setForm] = useState({
    template: templates[0].name,
    title: templates[0].title,
    message: templates[0].message,
    status: 'SCHEDULED',
    startsAt: toLocalInputValue(addHours(now, 1)),
    endsAt: toLocalInputValue(addHours(now, 5))
  })

  const activeMaintenance = useMemo(() => {
    const currentTime = Date.now()
    return maintenances.find(m => {
      if (m.status !== 'ONGOING') return false
      const start = new Date(m.startsAt).getTime()
      const end = m.endsAt ? new Date(m.endsAt).getTime() : start + 2 * 60 * 60 * 1000
      return currentTime >= start && currentTime <= end
    })
  }, [maintenances])

  const templateCount = templates.length
  const activeCount = maintenances.filter(m => m.status === 'ONGOING').length
  const scheduledCount = maintenances.filter(m => m.status === 'SCHEDULED').length

  const request = async (url: string, method: string, body?: any) => {
    setLoading(true)
    setStatusMessage('')
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      setStatusMessage(data.message || 'Updated')
      setTimeout(() => window.location.reload(), 700)
    } catch (err: any) {
      setStatusMessage(err.message || 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  const applyTemplate = (templateName: string) => {
    const template = templates.find(item => item.name === templateName)
    if (!template) return
    setForm(current => ({
      ...current,
      template: templateName,
      title: template.title,
      message: template.message,
      endsAt: toLocalInputValue(addHours(new Date(current.startsAt), template.durationHours))
    }))
  }

  const setStartNow = () => {
    const current = new Date()
    const template = templates.find(item => item.name === form.template)
    setForm(currentForm => ({
      ...currentForm,
      status: 'ONGOING',
      startsAt: toLocalInputValue(current),
      endsAt: toLocalInputValue(addHours(current, template?.durationHours || 2))
    }))
  }

  const createMaintenance = () => {
    if (!form.title.trim()) {
      setStatusMessage('Title is required')
      return
    }

    const startDate = form.status === 'ONGOING' ? new Date() : new Date(form.startsAt)
    const endDate = form.endsAt ? new Date(form.endsAt) : null

    request('/api/admin/maintenance', 'POST', {
      title: form.title.trim(),
      message: form.message.trim(),
      status: form.status,
      startsAt: startDate.toISOString(),
      endsAt: endDate ? endDate.toISOString() : null
    })
  }

  const updateStatus = (id: string, status: string) => {
    request('/api/admin/maintenance', 'PATCH', { id, status })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
              <Shield className="w-3.5 h-3.5" />
              Maintenance Control
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Maintenance Mode</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-300">
              Create scheduled windows, start maintenance immediately, and keep users informed with a consistent status flow.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Templates</div>
              <div className="mt-2 text-2xl font-semibold">{templateCount}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Active</div>
              <div className="mt-2 text-2xl font-semibold">{activeCount}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Scheduled</div>
              <div className="mt-2 text-2xl font-semibold">{scheduledCount}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.45fr_0.85fr]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">Choose a template</p>
                <h2 className="text-xl font-semibold text-slate-900">Fast setup for common scenarios</h2>
              </div>
              {loading && <Loader2 className="h-5 w-5 animate-spin text-slate-500" />}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {templates.map(template => {
                const isSelected = template.name === form.template
                return (
                  <button
                    key={template.name}
                    type="button"
                    onClick={() => applyTemplate(template.name)}
                    className={`rounded-2xl border p-4 text-left transition-all ${isSelected ? 'border-slate-900 bg-slate-950 text-white shadow-lg' : 'border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300 hover:bg-white'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>{template.tone}</p>
                        <h3 className="mt-2 text-sm font-semibold">{template.title}</h3>
                      </div>
                      <Sparkles className={`h-4 w-4 ${isSelected ? 'text-sky-300' : 'text-slate-400'}`} />
                    </div>
                    <p className={`mt-3 text-sm leading-6 ${isSelected ? 'text-slate-300' : 'text-slate-600'}`}>{template.message}</p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">Create maintenance window</p>
                <h2 className="text-xl font-semibold text-slate-900">Schedule or start immediately</h2>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={setStartNow} disabled={loading}>
                  Start now
                </Button>
                <Button onClick={createMaintenance} disabled={loading}>
                  Save maintenance
                </Button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Status</label>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-slate-900"
                  value={form.status}
                  onChange={(e) => setForm(current => ({ ...current, status: e.target.value }))}
                >
                  <option value="SCHEDULED">Scheduled</option>
                  <option value="ONGOING">Start now</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Template</label>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-slate-900"
                  value={form.template}
                  onChange={(e) => applyTemplate(e.target.value)}
                >
                  {templates.map(template => (
                    <option key={template.name} value={template.name}>{template.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Start date & time</label>
                <Input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm(current => ({ ...current, startsAt: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">End date & time</label>
                <Input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm(current => ({ ...current, endsAt: e.target.value }))}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Title</label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm(current => ({ ...current, title: e.target.value }))}
                  placeholder="Maintenance title"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Message</label>
                <textarea
                  className="min-h-32 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm(current => ({ ...current, message: e.target.value }))}
                  placeholder="What users should know"
                />
              </div>
            </div>

            {statusMessage && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {statusMessage}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <h3 className="text-lg font-semibold text-slate-900">Current status</h3>
            </div>

            <div className="mt-5 space-y-4">
              {activeMaintenance ? (
                <>
                  <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[activeMaintenance.status]}`}>
                    {statusIcon(activeMaintenance.status)}
                    {activeMaintenance.status}
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-900">{activeMaintenance.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{activeMaintenance.message}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                    Ends {activeMaintenance.endsAt ? format(new Date(activeMaintenance.endsAt), 'PPpp') : 'open-ended'}
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                  No active maintenance right now.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-slate-600" />
              <h3 className="text-lg font-semibold text-slate-900">Recent schedule</h3>
            </div>

            <div className="space-y-3">
              {maintenances.length === 0 && <p className="text-sm text-slate-500">No maintenance entries yet.</p>}
              {maintenances.slice(0, 6).map(item => (
                <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[item.status]}`}>
                      {statusIcon(item.status)}
                      {item.status}
                    </div>
                    <div className="text-xs text-slate-500">{format(new Date(item.startsAt), 'PPpp')}</div>
                  </div>
                  <div className="mt-3">
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.message}</p>
                    <p className="mt-2 text-xs text-slate-500">{format(new Date(item.startsAt), 'PPpp')} → {item.endsAt ? format(new Date(item.endsAt), 'PPpp') : 'open-ended'}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.status !== 'ONGOING' && item.status !== 'COMPLETED' && (
                      <Button variant="outline" size="sm" onClick={() => updateStatus(item.id, 'ONGOING')} disabled={loading}>
                        <Play className="mr-1 h-4 w-4" /> Start now
                      </Button>
                    )}
                    {item.status !== 'COMPLETED' && item.status !== 'CANCELED' && (
                      <Button variant="ghost" size="sm" onClick={() => updateStatus(item.id, 'COMPLETED')} disabled={loading}>
                        <CheckCircle2 className="mr-1 h-4 w-4" /> Complete
                      </Button>
                    )}
                    {item.status !== 'COMPLETED' && item.status !== 'CANCELED' && (
                      <Button variant="ghost" size="sm" onClick={() => updateStatus(item.id, 'CANCELED')} disabled={loading}>
                        <XCircle className="mr-1 h-4 w-4" /> Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="fixed bottom-4 right-4 rounded-2xl bg-slate-950 px-4 py-3 text-sm text-white shadow-xl">
          {statusMessage}
        </div>
      )}
    </div>
  )
}

export default MaintenanceManager
