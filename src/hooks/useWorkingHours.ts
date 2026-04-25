import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { WorkingHours } from '../types'

interface UseWorkingHoursReturn {
  hours: WorkingHours[]
  loading: boolean
}

export function useWorkingHours(): UseWorkingHoursReturn {
  const [hours, setHours] = useState<WorkingHours[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('working_hours')
      .select('*')
      .order('day_of_week')
      .then(({ data }) => {
        setHours(data || [])
        setLoading(false)
      })
  }, [])

  return { hours, loading }
}