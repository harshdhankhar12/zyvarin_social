import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const allowPrefixes = ['/api', '/_next', '/static', '/favicon.ico', '/robots.txt', '/sitemap.xml']
const allowExact = ['/signin', '/maintenance']

export async function middleware(req: NextRequest) {
  const { pathname, origin } = req.nextUrl

  if (allowPrefixes.some(p => pathname.startsWith(p)) || allowExact.includes(pathname)) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  try {
    const res = await fetch(`${origin}/api/maintenance/active`, { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      if (data.active) {
        const maintenanceUrl = req.nextUrl.clone()
        maintenanceUrl.pathname = '/maintenance'
        return NextResponse.redirect(maintenanceUrl)
      }
    }
  } catch (error) {
    return NextResponse.next()
  }

  return NextResponse.next()
}
