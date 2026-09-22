import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()

  // 1. Verify Authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/auth/login')
  }

  // 2. Verify Admin Role (Server-side logic mirrored from page.tsx)
  let isAuthorized = false
  try {
    // First check: RPC call
    const { data: isAdminRpc } = await supabase.rpc('is_admin')
    if (isAdminRpc) {
      isAuthorized = true
    } else {
      // Second check: admin_users table
      const { data: adminRow } = await supabase
        .from('admin_users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      if (adminRow) {
        isAuthorized = true
      }
    }
  } catch (e) {
    console.error('Admin verification error:', e)
  }

  if (!isAuthorized) {
    redirect('/dashboard')
  }

  return <>{children}</>
}
