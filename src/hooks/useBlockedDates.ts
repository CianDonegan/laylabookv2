import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface UseBlockedDatesReturn {
  dates: string[]
  loading: boolean
}

export function useBlockedDates(): UseBlockedDatesReturn {
  const [dates, setDates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('blocked_dates')
      .select('date')
      .then(({ data }) => {
        setDates((data || []).map((b: { date: string }) => b.date))
        setLoading(false)
      })
  }, [])

  return { dates, loading }
}