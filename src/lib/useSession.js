import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// session: undefined while loading, null when signed out.
export function useSession() {
  const [session, setSession] = useState(undefined)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return { session, recovery, clearRecovery: () => setRecovery(false) }
}
