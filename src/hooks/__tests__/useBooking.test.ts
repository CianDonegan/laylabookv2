import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useBooking } from '../useBooking'
import type { BookingPayload } from '../../types'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}))

const { supabase } = await import('../../lib/supabase')

const PAYLOAD: BookingPayload = {
  name: 'Test User',
  email: 'test@example.com',
  phone: '0851234567',
  startTime: '2026-06-01T10:00:00',
  endTime: '2026-06-01T11:00:00',
  totalPrice: 50,
  services: [{ service_id: '1', is_primary: true, price: 50, name: 'Gel Nails' }],
}

describe('useBooking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null })
  })

  describe('successful booking', () => {
    beforeEach(() => {
      ;(supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: 'booking-abc', error: null })
    })

    it('returns the booking id and sets bookingId state', async () => {
      const { result } = renderHook(() => useBooking())
      let id = ''
      await act(async () => { id = await result.current.submit(PAYLOAD) })

      expect(id).toBe('booking-abc')
      expect(result.current.bookingId).toBe('booking-abc')
      expect(result.current.error).toBeNull()
    })

    it('calls create_booking with trimmed name and phone', async () => {
      const { result } = renderHook(() => useBooking())
      await act(async () => { await result.current.submit({ ...PAYLOAD, name: '  Alice ', phone: ' 0851234567 ' }) })

      expect(supabase.rpc).toHaveBeenCalledWith('create_booking', expect.objectContaining({
        p_client_name: 'Alice',
        p_client_phone: '0851234567',
      }))
    })

    it('calls save_booking_email with phone and email after booking', async () => {
      const { result } = renderHook(() => useBooking())
      await act(async () => { await result.current.submit(PAYLOAD) })

      expect(supabase.rpc).toHaveBeenCalledWith('save_booking_email', {
        p_phone: '0851234567',
        p_email: 'test@example.com',
      })
    })

    it('invokes send-booking-confirmation with correct fields', async () => {
      const { result } = renderHook(() => useBooking())
      await act(async () => { await result.current.submit(PAYLOAD) })

      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'send-booking-confirmation',
        expect.objectContaining({
          body: expect.objectContaining({
            clientName: 'Test User',
            clientEmail: 'test@example.com',
            startTime: PAYLOAD.startTime,
            totalPrice: 50,
          }),
        })
      )
    })

    it('resets loading to false after success', async () => {
      const { result } = renderHook(() => useBooking())
      await act(async () => { await result.current.submit(PAYLOAD) })

      expect(result.current.loading).toBe(false)
    })
  })

  describe('failed booking', () => {
    it('sets error and throws on RPC error', async () => {
      ;(supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null, error: { message: 'Database connection failed' },
      })

      const { result } = renderHook(() => useBooking())
      await act(async () => {
        await expect(result.current.submit(PAYLOAD)).rejects.toThrow()
      })

      expect(result.current.error).toBe('Database connection failed')
      expect(result.current.bookingId).toBeNull()
    })

    it('does not call save_booking_email or edge function on failure', async () => {
      ;(supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null, error: { message: 'error' },
      })

      const { result } = renderHook(() => useBooking())
      await act(async () => {
        try { await result.current.submit(PAYLOAD) } catch { /* expected */ }
      })

      // rpc is called once (create_booking) but not save_booking_email
      expect(supabase.rpc).toHaveBeenCalledTimes(1)
      expect(supabase.functions.invoke).not.toHaveBeenCalled()
    })

    it('shows availability message for overlap errors', async () => {
      ;(supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null, error: { message: 'Time slot overlap with existing booking' },
      })

      const { result } = renderHook(() => useBooking())
      await act(async () => {
        try { await result.current.submit(PAYLOAD) } catch { /* expected */ }
      })

      expect(result.current.error).toBe(
        'That appointment time is no longer available. Please choose another time.'
      )
    })

    it('shows availability message for "unavailable" errors', async () => {
      ;(supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null, error: { message: 'slot unavailable' },
      })

      const { result } = renderHook(() => useBooking())
      await act(async () => {
        try { await result.current.submit(PAYLOAD) } catch { /* expected */ }
      })

      expect(result.current.error).toBe(
        'That appointment time is no longer available. Please choose another time.'
      )
    })

    it('shows availability message for "already booked" errors', async () => {
      ;(supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null, error: { message: 'This slot is already booked' },
      })

      const { result } = renderHook(() => useBooking())
      await act(async () => {
        try { await result.current.submit(PAYLOAD) } catch { /* expected */ }
      })

      expect(result.current.error).toBe(
        'That appointment time is no longer available. Please choose another time.'
      )
    })

    it('resets loading to false after failure', async () => {
      ;(supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null, error: { message: 'error' },
      })

      const { result } = renderHook(() => useBooking())
      await act(async () => {
        try { await result.current.submit(PAYLOAD) } catch { /* expected */ }
      })

      expect(result.current.loading).toBe(false)
    })
  })
})
