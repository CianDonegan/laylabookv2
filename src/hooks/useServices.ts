import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Service } from '../types'

interface UseServicesReturn {
  services: Service[]
  loading: boolean
  error: string | null
}

export function useServices(): UseServicesReturn {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetch() {
      try {
        const { data, error } = await supabase
          .from('services')
          .select('*')
          .eq('active', true)
          .order('sort_order')
          .order('name')
        
        if (error) throw error
        setServices(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load services')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  return { services, loading, error }
}