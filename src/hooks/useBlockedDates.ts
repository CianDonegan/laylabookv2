import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface UseBlockedDatesReturn {
  dates: string[]
  loading: boolean
  error: string | null
}

export function useBlockedDates(): UseBlockedDatesReturn {
  const [dates, setDates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase.from('blocked_dates').select('date')
        if (error) throw error
        setDates((data || []).map((b: { date: string }) => b.date))
      } catch {
        setError('Could not load availability. Please refresh.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  return { dates, loading, error }
}
