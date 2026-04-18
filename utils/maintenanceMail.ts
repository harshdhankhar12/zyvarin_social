type MaintenanceEmailType = 'scheduled' | 'started' | 'completed' | 'canceled'

type BuildMaintenanceEmailInput = {
    type: MaintenanceEmailType
    title: string
    message?: string | null
    startsAt?: Date | string | null
    endsAt?: Date | string | null
    baseUrl?: string
}

const themeByType: Record<MaintenanceEmailType, { label: string; accent: string; border: string; background: string; subject: string; heading: string }> = {
    scheduled: {
        label: 'Scheduled',
        accent: '#d97706',
        border: '#fbbf24',
        background: '#fffbeb',
        subject: 'Scheduled maintenance notice - Zyvarin',
        heading: 'Maintenance Scheduled'
    },
    started: {
        label: 'In progress',
        accent: '#2563eb',
        border: '#93c5fd',
        background: '#eff6ff',
        subject: 'Maintenance is now in progress - Zyvarin',
        heading: 'Maintenance Now in Progress'
    },
    completed: {
        label: 'Completed',
        accent: '#059669',
        border: '#6ee7b7',
        background: '#ecfdf5',
        subject: 'Maintenance completed - Zyvarin',
        heading: 'Maintenance Completed'
    },
    canceled: {
        label: 'Canceled',
        accent: '#dc2626',
        border: '#fca5a5',
        background: '#fef2f2',
        subject: 'Maintenance update - Zyvarin',
        heading: 'Maintenance Canceled'
    }
}

const formatDate = (value?: Date | string | null) => {
    if (!value) return 'Until further notice'
    const date = typeof value === 'string' ? new Date(value) : value
    return date.toLocaleString()
}

export const buildMaintenanceEmail = ({ type, title, message, startsAt, endsAt, baseUrl }: BuildMaintenanceEmailInput) => {
    const theme = themeByType[type]
    const windowText = type === 'scheduled'
        ? `Starts ${formatDate(startsAt)} and ends ${formatDate(endsAt)}`
        : type === 'started'
            ? `Started ${formatDate(startsAt)} and ends ${formatDate(endsAt)}`
            : type === 'completed'
                ? `Completed at ${formatDate(endsAt || startsAt)}`
                : 'This maintenance update has been canceled.'

    const subject = theme.subject

    const htmlContent = `
    <div style="margin:0; padding:0; background:#f8fafc; font-family: Inter, Arial, sans-serif;">
      <div style="max-width:640px; margin:0 auto; padding:32px 16px;">
        <div style="background:linear-gradient(180deg, #0f172a 0%, #111827 100%); border-radius:24px; padding:32px; color:#e5e7eb; box-shadow:0 24px 80px rgba(15,23,42,0.22);">
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:24px;">
            <div style="width:44px; height:44px; border-radius:14px; background:${theme.accent}; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800; letter-spacing:0.02em;">Z</div>
            <div>
              <div style="font-size:13px; color:#94a3b8; letter-spacing:0.08em; text-transform:uppercase;">Zyvarin Status</div>
              <div style="font-size:20px; font-weight:700; color:#fff;">${theme.heading}</div>
            </div>
          </div>

          <div style="display:inline-flex; align-items:center; gap:8px; padding:7px 12px; border-radius:999px; background:${theme.background}; color:${theme.accent}; font-size:12px; font-weight:700; border:1px solid ${theme.border}; margin-bottom:18px;">
            ${theme.label}
          </div>

          <h1 style="margin:0 0 12px; font-size:28px; line-height:1.2; color:#fff;">${title}</h1>

          ${message ? `<p style="margin:0 0 18px; font-size:16px; line-height:1.7; color:#cbd5e1;">${message}</p>` : ''}

          <div style="display:grid; gap:12px; margin-top:18px;">
            <div style="padding:16px; border-radius:16px; background:rgba(255,255,255,0.04); border:1px solid rgba(148,163,184,0.18);">
              <div style="font-size:12px; text-transform:uppercase; letter-spacing:0.08em; color:#94a3b8; margin-bottom:6px;">Window</div>
              <div style="font-size:15px; color:#f8fafc; font-weight:600;">${windowText}</div>
            </div>
            <div style="padding:16px; border-radius:16px; background:rgba(255,255,255,0.04); border:1px solid rgba(148,163,184,0.18);">
              <div style="font-size:12px; text-transform:uppercase; letter-spacing:0.08em; color:#94a3b8; margin-bottom:6px;">What to expect</div>
              <div style="font-size:15px; color:#cbd5e1; line-height:1.7;">Some or all product actions may be temporarily unavailable while we complete this work safely.</div>
            </div>
          </div>

          <div style="margin-top:22px; padding-top:18px; border-top:1px solid rgba(148,163,184,0.18); display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between;">
            <div style="font-size:13px; color:#94a3b8;">If you need help, reply to this email or revisit the status page.</div>
            ${baseUrl ? `<a href="${baseUrl}/maintenance" style="display:inline-flex; align-items:center; justify-content:center; padding:11px 16px; border-radius:12px; background:${theme.accent}; color:#fff; text-decoration:none; font-weight:700; font-size:14px;">View status page</a>` : ''}
          </div>
        </div>
      </div>
    </div>
  `

    return { subject, htmlContent }
}
