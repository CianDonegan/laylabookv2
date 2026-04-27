import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { WorkingHours } from '../types'

interface UseWorkingHoursReturn {
  hours: WorkingHours[]
  loading: boolean
  error: string | null
}

export function useWorkingHours(): UseWorkingHoursReturn {
  const [hours, setHours] = useState<WorkingHours[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from('working_hours')
          .select('*')
          .order('day_of_week')
        if (error) throw error
        setHours(data || [])
      } catch {
        setError('Could not load working hours. Please refresh.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  return { hours, loading, error }
}
