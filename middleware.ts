/**
 * Next.js Edge Middleware — admin route protection.
 *
 * This is a UX convenience layer only.
 * Defense-in-depth requires requireAdmin() / requireAdminAction() be called
 * inside every admin RSC and Server Action (CVE-2025-29927).
 *
 * Matcher: /admin/:path* — excludes /admin/login so the login page is always
 * accessible without a valid session.
 *
 * Runtime: Edge (no Node APIs). Uses Web Crypto via verifySession which
 * already uses globalThis.crypto.subtle.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'

export const config = {
  matcher: ['/admin/:path*'],
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // Always allow access to the login page itself — avoid redirect loop
  if (pathname === '/admin/login') {
    return NextResponse.next()
  }

  const token = request.cookies.get('qh_admin')?.value

  if (token) {
    const result = await verifySession(token)
    if (result.status === 'valid') {
      return NextResponse.next()
    }
  }

  // No token or invalid/expired — redirect to login
  const loginUrl = new URL('/admin/login', request.url)
  return NextResponse.redirect(loginUrl)
}
