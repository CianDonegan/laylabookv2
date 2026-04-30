import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { WaitlistPayload, WaitlistPosition, WaitlistStatus } from '../types'

interface UseWaitlistReturn {
  join: (payload: WaitlistPayload) => Promise<string>
  leave: (id: string, phone: string) => Promise<boolean>
  getPosition: (id: string) => Promise<WaitlistPosition>
  loading: boolean
  error: string | null
  waitlistId: string | null
}

function getWaitlistErrorMessage(err: unknown) {
  const fallback = 'Waitlist action failed'
  const message =
    err instanceof Error
      ? err.message
      : (err as { message?: string })?.message ?? fallback
  const normalized = message.toLowerCase()

  if (normalized.includes('already on') || normalized.includes('duplicate')) {
    return "You're already on the waitlist for this slot."
  }

  if (normalized.includes('past') || normalized.includes('future')) {
    return 'Please pick a future date.'
  }

  return message
}

export function useWaitlist(): UseWaitlistReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [waitlistId, setWaitlistId] = useState<string | null>(null)

  const join = async (payload: WaitlistPayload): Promise<string> => {
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.rpc('join_waitlist', {
        p_name: payload.name.trim(),
        p_phone: payload.phone.trim(),
        p_email: payload.email.trim(),
        p_service_id: payload.serviceId,
        p_addon_service_ids: payload.addonServiceIds,
        p_preferred_date: payload.preferredDate,
        p_earliest_time: payload.earliestTime,
        p_latest_time: payload.latestTime,
      })

      if (error) throw error
      if (!data) throw new Error('No waitlist ID returned')

      setWaitlistId(data)
      return data
    } catch (err) {
      const msg = getWaitlistErrorMessage(err)
      setError(msg)
      throw new Error(msg, { cause: err })
    } finally {
      setLoading(false)
    }
  }

  const leave = async (id: string, phone: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('leave_waitlist', {
        p_waitlist_id: id,
        p_phone: phone.trim(),
      })

      if (error) throw error
      return Boolean(data)
    } catch (err) {
      const msg = getWaitlistErrorMessage(err)
      throw new Error(msg, { cause: err })
    }
  }

  const getPosition = async (id: string): Promise<WaitlistPosition> => {
    try {
      const { data, error } = await supabase.rpc('get_waitlist_position', {
        p_waitlist_id: id,
      })

      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      if (!row) throw new Error('Waitlist entry not found')

      return {
        position: Number(row.position),
        aheadCount: Number(row.ahead_count),
        status: row.status as WaitlistStatus,
      }
    } catch (err) {
      const msg = getWaitlistErrorMessage(err)
      throw new Error(msg, { cause: err })
    }
  }

  return { join, leave, getPosition, loading, error, waitlistId }
}
