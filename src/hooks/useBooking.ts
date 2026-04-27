import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { BookingPayload } from '../types'

interface UseBookingReturn {
  submit: (payload: BookingPayload) => Promise<string>
  loading: boolean
  error: string | null
  bookingId: string | null
}

function getBookingErrorMessage(err: unknown) {
  const fallback = 'Booking failed'
  const message = err instanceof Error ? err.message : fallback
  const normalized = message.toLowerCase()

  if (
    normalized.includes('available') ||
    normalized.includes('unavailable') ||
    normalized.includes('overlap') ||
    normalized.includes('conflict') ||
    normalized.includes('already booked')
  ) {
    return 'That appointment time is no longer available. Please choose another time.'
  }

  return message
}

export function useBooking(): UseBookingReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bookingId, setBookingId] = useState<string | null>(null)

  const submit = async (payload: BookingPayload): Promise<string> => {
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.rpc('create_booking', {
        p_client_name: payload.name.trim(),
        p_client_phone: payload.phone.trim(),
        p_start_time: payload.startTime,
        p_end_time: payload.endTime,
        p_total_price: payload.totalPrice,
        p_services: payload.services,
      })

      if (error) throw error
      if (!data) throw new Error('No booking ID returned')

      setBookingId(data)

      // Fire-and-forget — email failure must never break the booking flow.
      void supabase.functions.invoke('send-booking-confirmation', {
        body: {
          clientName: payload.name.trim(),
          clientEmail: payload.email.trim(),
          startTime: payload.startTime,
          services: payload.services,
          totalPrice: payload.totalPrice,
        },
      })

      return data
    } catch (err) {
      const msg = getBookingErrorMessage(err)
      setError(msg)
      throw new Error(msg, { cause: err })
    } finally {
      setLoading(false)
    }
  }

  return { submit, loading, error, bookingId }
}
