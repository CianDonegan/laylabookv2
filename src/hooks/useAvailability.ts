import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface UseAvailabilityReturn {
  slots: string[]
  loading: boolean
  error: string | null
}

export function useAvailability(date: string, durationMinutes: number): UseAvailabilityReturn {
  const [slots, setSlots] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!date || !durationMinutes) {
      setSlots([])
      return
    }

    async function fetch() {
      setLoading(true)
      setError(null)
      try {
        const { data, error } = await supabase.rpc('get_available_slots', {
          p_date: date,
          p_duration_minutes: durationMinutes,
        })
        if (error) throw error
        setSlots((data || []).map((row: { slot_time: string }) => row.slot_time.slice(0, 5)))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load slots')
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [date, durationMinutes])

  return { slots, loading, error }
}