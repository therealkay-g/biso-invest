import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ztoetlxicdkglvwjdxqt.supabase.co'
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  const {
    data: { user },
  } = await (supabase.auth as any).getUser()

  const pathname = request.nextUrl.pathname

  // Routes protégées côté serveur
  const protectedPrefixes = [
    '/dashboard',
    '/wallet',
    '/investments',
    '/team',
    '/vip',
    '/service',
    '/profile',
    '/admin',
    '/invest',
  ]

  const isProtected = protectedPrefixes.some(prefix => pathname.startsWith(prefix))

  if (!user && isProtected) {
    const redirectUrl = new URL('/auth/login', request.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Si l'utilisateur est déjà connecté et visite la page de connexion ou inscription
  if (user && pathname.startsWith('/auth') && !pathname.includes('logout')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/wallet/:path*',
    '/investments/:path*',
    '/team/:path*',
    '/vip/:path*',
    '/service/:path*',
    '/profile/:path*',
    '/admin/:path*',
    '/invest/:path*',
    '/auth/:path*',
  ],
}
