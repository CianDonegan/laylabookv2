import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useWorkingHours } from '../useWorkingHours'
import { makeQueryChain } from '../../test/supabaseMock'
import type { WorkingHours } from '../../types'

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

const { supabase } = await import('../../lib/supabase')

const MOCK_HOURS: WorkingHours[] = [
  { day_of_week: 1, day_name: 'Monday', is_open: true, start_time: '09:00', end_time: '17:00', slot_interval_minutes: 30 },
  { day_of_week: 0, day_name: 'Sunday', is_open: false, start_time: '09:00', end_time: '17:00', slot_interval_minutes: 30 },
]

describe('useWorkingHours', () => {
  beforeEach(() => vi.clearAllMocks())

  it('starts with loading=true and empty hours', () => {
    ;(supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue(new Promise(() => {})) }),
    })

    const { result } = renderHook(() => useWorkingHours())

    expect(result.current.loading).toBe(true)
    expect(result.current.hours).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('returns working hours array on success', async () => {
    ;(supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      makeQueryChain({ data: MOCK_HOURS, error: null })
    )

    const { result } = renderHook(() => useWorkingHours())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.hours).toEqual(MOCK_HOURS)
    expect(result.current.error).toBeNull()
  })

  it('sets error message and clears loading on Supabase error', async () => {
    ;(supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      makeQueryChain({ data: null, error: { message: 'relation does not exist' } })
    )

    const { result } = renderHook(() => useWorkingHours())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.hours).toEqual([])
    expect(result.current.error).toBe('Could not load working hours. Please refresh.')
  })

  it('sets error message on network exception', async () => {
    ;(supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockRejectedValue(new Error('timeout')),
      }),
    })

    const { result } = renderHook(() => useWorkingHours())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('Could not load working hours. Please refresh.')
  })
})
