import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

// Loads every transaction this user may see (row-level security decides which)
// and refreshes live whenever one changes.
export function useTransactions(channelName) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1000)
    if (error) setError(error.message)
    else {
      setRows(data)
      setError(null)
    }
  }, [])

  useEffect(() => {
    reload()
    let timer
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        clearTimeout(timer)
        timer = setTimeout(reload, 250)
      })
      .subscribe()
    const onFocus = () => reload()
    window.addEventListener('focus', onFocus)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('focus', onFocus)
      supabase.removeChannel(channel)
    }
  }, [reload, channelName])

  return { rows, error, reload }
}
