import { formatInTimeZone } from 'date-fns-tz'

const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland'
]

export function isValidTimezone(timezone: string): boolean {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone })
    formatter.format(new Date())
    return true
  } catch {
    return false
  }
}

export function getTimezoneLabel(timezone: string): string {
  if (!timezone) return 'UTC'
  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    })
    const parts = formatter.formatToParts(now)
    const tzName = parts.find(p => p.type === 'timeZoneName')?.value || timezone
    return `${timezone} (${tzName})`
  } catch {
    return timezone
  }
}

export function convertToUserTimezone(date: Date, timezone: string | null): string {
  if (!timezone || !isValidTimezone(timezone)) {
    return date.toISOString()
  }
  try {
    return formatInTimeZone(date, timezone, 'PPpp')
  } catch {
    return date.toISOString()
  }
}

export function convertToUTC(localDate: Date, timezone: string): Date {
  if (!timezone || !isValidTimezone(timezone)) {
    return localDate
  }
  return new Date(localDate.toLocaleString('en-US', { timeZone: 'UTC' }))
}

export function validateScheduleTime(
  scheduledFor: string | null,
  userTimezone: string | null
): { valid: boolean; error?: string } {
  if (!scheduledFor) {
    return { valid: false, error: 'Schedule time is required' }
  }

  if (!userTimezone || !isValidTimezone(userTimezone)) {
    return { valid: false, error: 'Please set your timezone in settings first' }
  }

  const scheduledDate = new Date(scheduledFor)
  const now = new Date()

  if (isNaN(scheduledDate.getTime())) {
    return { valid: false, error: 'Invalid date format' }
  }

  if (scheduledDate <= now) {
    return { valid: false, error: 'Cannot schedule posts in the past' }
  }

  const maxFutureDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
  if (scheduledDate > maxFutureDate) {
    return { valid: false, error: 'Cannot schedule more than 90 days in advance' }
  }

  return { valid: true }
}
