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
  const hasRequiredInput = Boolean(date && durationMinutes)

  useEffect(() => {
    if (!hasRequiredInput) return

    let cancelled = false

    async function fetch() {
      setLoading(true)
      setError(null)
      try {
        const { data, error } = await supabase.rpc('get_available_slots', {
          p_date: date,
          p_duration_minutes: durationMinutes,
        })
        if (error) throw error
        if (cancelled) return
        setSlots((data || []).map((row: { slot_time: string }) => row.slot_time.slice(0, 5)))
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load slots')
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetch()

    return () => {
      cancelled = true
    }
  }, [date, durationMinutes, hasRequiredInput])

  return { slots: hasRequiredInput ? slots : [], loading: hasRequiredInput ? loading : false, error }
}
