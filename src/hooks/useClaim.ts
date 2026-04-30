import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ClaimOffer, ClaimOfferService, WaitlistStatus } from '../types'

interface UseClaimReturn {
  fetchOffer: (token: string) => Promise<ClaimOffer | null>
  claimSlot: (token: string) => Promise<string>
  loading: boolean
  error: string | null
}

function getClaimErrorMessage(err: unknown) {
  const fallback = 'Could not complete that request.'
  const message =
    err instanceof Error
      ? err.message
      : (err as { message?: string })?.message ?? fallback
  return message || fallback
}

function normalizeServices(snapshot: unknown): ClaimOfferService[] {
  if (!Array.isArray(snapshot)) return []
  return snapshot
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry) => ({
      service_id: String(entry.service_id ?? ''),
      name: String(entry.name ?? ''),
      price: Number(entry.price ?? 0),
      is_primary: Boolean(entry.is_primary),
    }))
}

export function useClaim(): UseClaimReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchOffer = useCallback(async (token: string): Promise<ClaimOffer | null> => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: rpcError } = await supabase.rpc('get_waitlist_by_token', {
        p_token: token,
      })

      if (rpcError) throw rpcError

      const row = Array.isArray(data) ? data[0] : data
      if (!row) return null

      return {
        waitlistId: String(row.waitlist_id),
        clientName: String(row.client_name),
        status: row.status as WaitlistStatus,
        offeredStartTime: String(row.offered_start_time),
        offeredEndTime: String(row.offered_end_time),
        expiresAt: String(row.expires_at),
        totalPrice: Number(row.total_price ?? 0),
        services: normalizeServices(row.services_snapshot),
      }
    } catch (err) {
      const msg = getClaimErrorMessage(err)
      setError(msg)
      throw new Error(msg, { cause: err })
    } finally {
      setLoading(false)
    }
  }, [])

  const claimSlot = useCallback(async (token: string): Promise<string> => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: rpcError } = await supabase.rpc('claim_waitlist_slot', {
        p_token: token,
      })

      if (rpcError) throw rpcError
      if (!data) throw new Error('No booking ID returned')

      return String(data)
    } catch (err) {
      const msg = getClaimErrorMessage(err)
      setError(msg)
      throw new Error(msg, { cause: err })
    } finally {
      setLoading(false)
    }
  }, [])

  return { fetchOffer, claimSlot, loading, error }
}
