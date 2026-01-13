"use client"
import { useMemo, useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Shield, Clock, CheckCircle2, XCircle, AlertTriangle, Loader2, Play, PauseCircle, Calendar as CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const templates = [
  {
    name: 'Platform upgrade',
    title: 'Scheduled Platform Upgrade',
    message: 'We are upgrading our infrastructure to improve stability and performance. Access will be temporarily unavailable during this window.',
    durationDays: 1
  },
  {
    name: 'Security patch',
    title: 'Security Maintenance',
    message: 'We are applying critical security updates. Services may be intermittently unavailable while we complete this maintenance.',
    durationDays: 1
  },
  {
    name: 'Database optimization',
    title: 'Database Optimization',
    message: 'We are optimizing databases to improve query performance. A brief downtime is expected during the maintenance window.',
    durationDays: 2
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

const toDateInput = (date: Date) => date.toISOString().slice(0, 10)

const nextNineAm = () => {
  const now = new Date()
  const target = new Date(now)
  target.setHours(9, 0, 0, 0)
  if (target <= now) {
    target.setDate(target.getDate() + 1)
  }
  return target
}

const defaultStart = () => toDateInput(nextNineAm())

const defaultEnd = (start: string, days = 1) => {
  const d = new Date(start)
  d.setHours(9, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return toDateInput(d)
}

const MaintenanceManager = ({ maintenances }: { maintenances: any[] }) => {
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [form, setForm] = useState({
    template: templates[0].name,
    title: templates[0].title,
    message: templates[0].message,
    status: 'SCHEDULED',
    startsAt: defaultStart(),
    endsAt: defaultEnd(defaultStart(), templates[0].durationDays)
  })

  useEffect(() => {
    setForm(f => ({
      ...f,
      endsAt: defaultEnd(f.startsAt, templates.find(t => t.name === f.template)?.durationDays || 1)
    }))
  }, [form.startsAt, form.template])

  const onTemplateChange = (templateName: string) => {
    const tpl = templates.find(t => t.name === templateName)
    if (!tpl) return
    setForm(f => ({
      ...f,
      template: templateName,
      title: tpl.title,
      message: tpl.message,
      endsAt: defaultEnd(f.startsAt, tpl.durationDays)
    }))
  }

  const activeMaintenance = useMemo(() => {
    const now = Date.now()
    return maintenances.find(m => {
      if (m.status !== 'ONGOING') return false
      const start = new Date(m.startsAt).getTime()
      const end = m.endsAt ? new Date(m.endsAt).getTime() : start + 2 * 60 * 60 * 1000
      return now >= start && now <= end
    })
  }, [maintenances])

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
      setTimeout(() => window.location.reload(), 800)
    } catch (err: any) {
      setStatusMessage(err.message || 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  const createMaintenance = () => {
    if (!form.title.trim()) {
      setStatusMessage('Title is required')
      return
    }
    request('/api/admin/maintenance', 'POST', {
      title: form.title.trim(),
      message: form.message.trim(),
      status: form.status,
      startsAt: `${form.startsAt}T09:00:00`,
      endsAt: form.endsAt ? `${form.endsAt}T09:00:00` : null
    })
  }

  const updateStatus = (id: string, status: string) => {
    request('/api/admin/maintenance', 'PATCH', { id, status })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Maintenance Control</p>
          <h1 className="text-2xl font-semibold text-slate-900">Maintenance Mode</h1>
        </div>
        {activeMaintenance && (
          <div className="px-4 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-sm flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Active until {activeMaintenance.endsAt ? format(new Date(activeMaintenance.endsAt), 'PPpp') : 'further notice'}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Create maintenance window</p>
              <h2 className="text-lg font-semibold text-slate-900">Schedule or start now</h2>
            </div>
            {loading && <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-600">Template</label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                value={form.template}
                onChange={(e) => onTemplateChange(e.target.value)}
              >
                {templates.map(t => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-600">Status</label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                value={form.status}
                onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}
              >
                <option value="SCHEDULED">Scheduled</option>
                <option value="ONGOING">Start now</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-600">Start date (time locked to 9:00)</label>
              <Input
                type="date"
                value={form.startsAt}
                onChange={(e) => setForm(f => ({ ...f, startsAt: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-600">End date (time locked to 9:00)</label>
              <Input
                type="date"
                value={form.endsAt}
                onChange={(e) => setForm(f => ({ ...f, endsAt: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-600">Title</label>
            <Input
              value={form.title}
              onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Maintenance title"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-600">Message</label>
            <textarea
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              rows={4}
              value={form.message}
              onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder="What users should know"
            />
          </div>

          {statusMessage && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
              {statusMessage}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={createMaintenance} disabled={loading}>Save maintenance</Button>
            <span className="text-sm text-slate-500">System will block non-admin pages during ongoing window</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-900">Current status</h3>
          </div>
          {activeMaintenance ? (
            <div className="space-y-2">
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs ${statusStyles[activeMaintenance.status]}`}>
                {statusIcon(activeMaintenance.status)}
                {activeMaintenance.status}
              </div>
              <p className="text-sm text-slate-700">{activeMaintenance.title}</p>
              <p className="text-sm text-slate-500">{activeMaintenance.message}</p>
              <p className="text-sm text-slate-500">Ends {activeMaintenance.endsAt ? format(new Date(activeMaintenance.endsAt), 'PPpp') : 'open-ended'}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No active maintenance.</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <CalendarIcon className="w-5 h-5 text-slate-600" />
          <h3 className="text-lg font-semibold text-slate-900">Maintenance schedule</h3>
        </div>
        <div className="space-y-3">
          {maintenances.length === 0 && <p className="text-sm text-slate-500">No maintenance entries yet.</p>}
          {maintenances.map(item => (
            <div key={item.id} className="p-4 border border-slate-200 rounded-lg flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`px-3 py-1 rounded-full border text-xs ${statusStyles[item.status]}`}>
                  <div className="flex items-center gap-2">
                    {statusIcon(item.status)}
                    {item.status}
                  </div>
                </div>
                <div>
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <p className="text-sm text-slate-600">{item.message}</p>
                  <p className="text-xs text-slate-500 mt-1">{format(new Date(item.startsAt), 'PPpp')} → {item.endsAt ? format(new Date(item.endsAt), 'PPpp') : 'open-ended'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {item.status !== 'ONGOING' && item.status !== 'COMPLETED' && (
                  <Button variant="outline" size="sm" onClick={() => updateStatus(item.id, 'ONGOING')} disabled={loading}>
                    <Play className="w-4 h-4 mr-1" /> Start now
                  </Button>
                )}
                {item.status !== 'COMPLETED' && item.status !== 'CANCELED' && (
                  <Button variant="ghost" size="sm" onClick={() => updateStatus(item.id, 'COMPLETED')} disabled={loading}>
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Complete
                  </Button>
                )}
                {item.status !== 'COMPLETED' && item.status !== 'CANCELED' && (
                  <Button variant="ghost" size="sm" onClick={() => updateStatus(item.id, 'CANCELED')} disabled={loading}>
                    <XCircle className="w-4 h-4 mr-1" /> Cancel
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {statusMessage && (
        <div className="fixed bottom-4 right-4 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm">
          {statusMessage}
        </div>
      )}
    </div>
  )
}

export default MaintenanceManager
